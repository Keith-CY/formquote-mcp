import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import worker from '../src/index.js';
import { SERVER_INFO } from '../src/server.js';
import { createClient } from '../src/formquote.js';
import { callTool, toolList, validate, quoteRequest } from '../src/tools.js';
import { rowOf, clientFamily, counter, CLIENTS, OUTCOMES } from '../src/counts.js';

const fixture = (name) => JSON.parse(readFileSync(new URL(`./fixtures/${name}`, import.meta.url), 'utf8'));
const BASE = 'https://pcba-quote-lab.pages.dev';

// A fetch that answers like the Formquote API from recorded live responses.
function fakeApi({ status = 200, body } = {}) {
  const calls = [];
  const impl = async (url, init) => {
    calls.push({ url, method: init.method, body: init.body ? JSON.parse(init.body) : null, headers: init.headers });
    if (status !== 200) return new Response(JSON.stringify(body ?? { error: { code: 'x', message: 'nope' } }), { status });
    if (url.includes('/api/v2/catalog')) return Response.json(fixture('catalog.json'));
    const req = JSON.parse(init.body);
    const file = { email_verification: 'quote-email.json', sound_effects: 'quote-sound.json', font_license: 'quote-font.json' }[req.categoryId];
    return Response.json(fixture(file));
  };
  return { impl, calls };
}

function rpc(method, params = {}, { headers = {}, id = 1 } = {}) {
  return new Request('https://formquote-mcp.example.workers.dev/mcp', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream', ...headers },
    body: JSON.stringify({ jsonrpc: '2.0', id, method, params }),
  });
}

test('legacy initialize answers with server info and instructions', async () => {
  const res = await worker.fetch(rpc('initialize', { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'test', version: '1' } }), {}, {});
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.result.protocolVersion, '2025-06-18');
  assert.equal(body.result.serverInfo.name, 'formquote');
  assert.match(body.result.instructions, /not live checkout quotes/);
  assert.deepEqual(body.result.capabilities, { tools: { listChanged: false } });
});

test('modern server/discover checks headers against the body', async () => {
  const meta = { _meta: { 'io.modelcontextprotocol/protocolVersion': '2026-07-28' } };
  const ok = await worker.fetch(rpc('server/discover', meta, { headers: { 'MCP-Protocol-Version': '2026-07-28', 'Mcp-Method': 'server/discover' } }), {}, {});
  const body = await ok.json();
  assert.equal(body.result.resultType, 'complete');
  assert.ok(body.result.supportedVersions.includes('2025-06-18'));
  const bad = await worker.fetch(rpc('server/discover', meta, { headers: { 'MCP-Protocol-Version': '2025-06-18', 'Mcp-Method': 'server/discover' } }), {}, {});
  assert.equal(bad.status, 400);
});

test('tools/list: four read-only tools with closed input schemas', async () => {
  const res = await worker.fetch(rpc('tools/list'), {}, {});
  const { result } = await res.json();
  assert.deepEqual(result.tools.map((t) => t.name), ['compare_email_verification_prices', 'compare_sound_effects_licenses', 'compare_font_licenses', 'list_formquote_catalog']);
  for (const t of result.tools) {
    assert.equal(t.annotations.readOnlyHint, true);
    assert.equal(t.annotations.destructiveHint, false);
    assert.equal(t.inputSchema.additionalProperties, false);
    assert.ok(t.title && t.description.length > 200 && t.description.length < 1100, t.name);
  }
});

test('GET, OPTIONS and foreign plain-http origins', async () => {
  assert.equal((await worker.fetch(new Request('https://x.dev/mcp'), {}, {})).status, 405);
  assert.equal((await worker.fetch(new Request('https://x.dev/mcp', { method: 'OPTIONS', headers: { Origin: 'https://claude.ai' } }), {}, {})).status, 204);
  const evil = rpc('tools/list', {}, { headers: { Origin: 'http://evil.example' } });
  assert.equal((await worker.fetch(evil, {}, {})).status, 403);
  const page = await worker.fetch(new Request('https://formquote-mcp.example.workers.dev/'), {}, {});
  assert.match(await page.text(), /https:\/\/formquote-mcp\.example\.workers\.dev\/mcp/);
  const card = await (await worker.fetch(new Request('https://formquote-mcp.example.workers.dev/.well-known/mcp/server-card.json'), {}, {})).json();
  assert.equal(card.remotes[0].url, 'https://formquote-mcp.example.workers.dev/mcp');
  assert.equal(card.tools.length, 4);
});

test('email: sends only the count and credits, summarizes ranked packs', async () => {
  const api = fakeApi();
  const client = createClient({ fetchImpl: api.impl });
  const r = await callTool(client, 'compare_email_verification_prices', { emails: '25000', existing_credits: { reoon: 0 } });
  assert.equal(r.isError, undefined);
  assert.deepEqual(api.calls[0].body, { schemaVersion: 1, categoryId: 'email_verification', specifications: { count: 25000 }, purchaseContext: { creditsBySupplier: { reoon: 0 } }, comparisonGoal: 'lowest_cash_now' });
  assert.equal(api.calls[0].url, `${BASE}/api/v2/quotes`);
  assert.match(api.calls[0].headers['User-Agent'], /formquote-mcp/);
  const text = r.content[0].text;
  assert.match(text, /email verification for 25,000 emails/);
  assert.match(text, /1\. Reoon · 25,000 credits — eligible/);
  assert.match(text, /not live checkout quotes/);
  assert.match(text, /Compare on Formquote: https:\/\/pcba-quote-lab\.pages\.dev\/en\/email-verification/);
  assert.equal(r.structuredContent.offers.length, 13);
  assert.equal(r.structuredContent.groups.length, 2);
  assert.ok(text.length < 8000, `text is ${text.length} chars`);
  assert.ok(JSON.stringify(r.structuredContent).length < 20000);
  assert.deepEqual(r._count, { category: 'email_verification', outcome: 'ok' });
});

test('identical requests are served from the short cache; failures are not cached', async () => {
  const api = fakeApi();
  const client = createClient({ fetchImpl: api.impl });
  await callTool(client, 'compare_email_verification_prices', { emails: 100 });
  await callTool(client, 'compare_email_verification_prices', { emails: 100 });
  assert.equal(api.calls.length, 1);
  const down = fakeApi({ status: 502 });
  const c2 = createClient({ fetchImpl: down.impl });
  const r = await callTool(c2, 'compare_email_verification_prices', { emails: 100 });
  assert.equal(r.isError, true);
  assert.match(r.content[0].text, /do not reuse an older quote/);
  assert.equal(r._count.outcome, 'upstream_error');
  await callTool(c2, 'compare_email_verification_prices', { emails: 100 });
  assert.equal(down.calls.length, 2);
});

test('bad input is refused before any API call', async () => {
  const api = fakeApi();
  const client = createClient({ fetchImpl: api.impl });
  for (const args of [{ emails: 0 }, { emails: 10000001 }, { emails: 1.5 }, {}, { emails: 5, addresses: ['a@b.c'] }, { emails: 5, existing_credits: { gmail: 3 } }, { emails: 'many' }]) {
    const r = await callTool(client, 'compare_email_verification_prices', args);
    assert.equal(r.isError, true, JSON.stringify(args));
    assert.match(r.content[0].text, /^Invalid input:/);
    assert.equal(r._count.outcome, 'invalid_input');
  }
  const r = await callTool(client, 'compare_font_licenses', { license_use: 'logo' });
  assert.equal(r.isError, true);
  assert.equal(api.calls.length, 0);
});

test('API 400 is passed back as fixable input', async () => {
  const api = fakeApi({ status: 400, body: { error: { code: 'invalid_specification', message: 'seats out of range' } } });
  const r = await callTool(createClient({ fetchImpl: api.impl }), 'compare_sound_effects_licenses', { intent: 'ui' });
  assert.equal(r.isError, true);
  assert.match(r.content[0].text, /invalid_specification.*seats out of range/);
  assert.equal(r._count.outcome, 'invalid_input');
});

test('sound effects and fonts map to the documented request shapes', () => {
  assert.deepEqual(quoteRequest('compare_sound_effects_licenses', { intent: 'ui', pure_sfx_percent: 30 }), {
    schemaVersion: 1,
    categoryId: 'sound_effects',
    specifications: { intent: 'ui', seats: 1, aiUse: false },
    usageContext: { commercialUse: true, standaloneResale: false, supplierPureSfxTimePercent: 30 },
    comparisonGoal: 'best_requirement_fit',
  });
  assert.deepEqual(quoteRequest('compare_font_licenses', { license_use: 'web', monthly_pageviews: 10000, medium: 'website', commercial_projects: 1, requires_all_styles: false }), {
    schemaVersion: 1,
    categoryId: 'font_license',
    specifications: { licenseUse: 'web', seats: 1, websites: 1, monthlyPageviews: 10000, trafficMetric: 'pv', termYears: 1 },
    usageContext: { medium: 'website', commercialProjects: 1, requiresAllStyles: false },
    comparisonGoal: 'best_requirement_fit',
  });
});

test('sound and font summaries keep unmet requirements visible', async () => {
  const client = createClient({ fetchImpl: fakeApi().impl });
  const s = await callTool(client, 'compare_sound_effects_licenses', { intent: 'ui', lang: 'ja' });
  assert.match(s.content[0].text, /Modular UI \(SoundMorph\) — eligible/);
  assert.match(s.content[0].text, /\? commercialUse \(unknown\)/);
  assert.match(s.content[0].text, /Not eligible for this request:/);
  assert.match(s.content[0].text, /pages\.dev\/ja\/sound-effects/);
  const f = await callTool(client, 'compare_font_licenses', { license_use: 'web', monthly_pageviews: 10000 });
  assert.match(f.content[0].text, /Get Busy! \(Pangram Pangram Foundry\) — eligible/);
  assert.match(f.content[0].text, /renews at USD 69\.00\/year, not locked/);
  assert.match(f.content[0].text, /monthlyPageviews/);
});

test('catalogue lists every item with its checked date', async () => {
  const api = fakeApi();
  const r = await callTool(createClient({ fetchImpl: api.impl }), 'list_formquote_catalog', { category: 'font_license' });
  assert.equal(api.calls[0].url, `${BASE}/api/v2/catalog?categoryId=font_license`);
  assert.match(r.content[0].text, /Font Starter Pack — Get Busy! \(Pangram Pangram Foundry\): USD 69\.00\/year · checked 2026-10-08/);
  assert.equal(r.structuredContent.itemCount, 27);
});

test('tools/call through the worker, with counting', async () => {
  const rows = [];
  const db = { prepare: (sql) => ({ run: async () => ({}), bind: (...v) => ({ run: async () => rows.push(v) }) }) };
  const waits = [];
  const realFetch = globalThis.fetch;
  globalThis.fetch = fakeApi().impl;
  try {
    const res = await worker.fetch(
      rpc('tools/call', { name: 'compare_email_verification_prices', arguments: { emails: 25000 } }, { headers: { 'User-Agent': 'Claude-User/1.0' } }),
      { MCP_COUNTS: db },
      { waitUntil: (p) => waits.push(p) },
    );
    const body = await res.json();
    assert.equal(body.result.isError, undefined);
    assert.equal(body.result._count, undefined);
    assert.ok(body.result.structuredContent);
    await Promise.all(waits);
  } finally {
    globalThis.fetch = realFetch;
  }
  assert.equal(rows.length, 1);
  const [day, kind, tool, category, outcome, client] = rows[0];
  assert.match(day, /^\d{4}-\d{2}-\d{2}$/);
  assert.deepEqual([kind, tool, category, outcome, client], ['call', 'compare_email_verification_prices', 'email_verification', 'ok', 'claude']);
});

test('count rows hold only fixed labels', () => {
  const names = toolList().map((t) => t.name);
  const r = rowOf({ kind: 'call', tool: 'drop table', category: 'me@x.com', outcome: '<script>', client: 'secret 25000 emails' }, names, new Date('2026-10-16T05:00:00Z'));
  assert.deepEqual(r, { day: '2026-10-16', kind: 'call', tool: '', category: '', outcome: 'error', client: 'other' });
  assert.equal(clientFamily('openai-mcp/1.0.0'), 'chatgpt');
  assert.equal(clientFamily('claude-ai'), 'claude');
  assert.equal(clientFamily('Cursor/1.2'), 'cursor');
  assert.equal(clientFamily('SmitheryBot/1.0'), 'scanner');
  assert.equal(clientFamily('mcp-inspector'), 'inspector');
  assert.ok(CLIENTS.includes('other') && OUTCOMES.includes('no_match'));
  assert.equal(typeof counter({}, {}, names), 'function');
});

test('validate coerces integer strings and booleans', () => {
  const schema = toolList()[2].inputSchema;
  assert.deepEqual(validate(schema, { license_use: 'web', websites: '3', requires_all_styles: 'false' }).value, { license_use: 'web', websites: 3, requires_all_styles: false });
  assert.equal(SERVER_INFO.version, '1.0.0');
});

test('the shared ceiling answers busy without calling the API', async () => {
  const realFetch = globalThis.fetch;
  let called = 0;
  globalThis.fetch = async () => {
    called++;
    return new Response('{}');
  };
  try {
    const env = { RATE_LIMIT: { limit: async () => ({ success: false }) } };
    const res = await worker.fetch(rpc('tools/call', { name: 'list_formquote_catalog', arguments: {} }), env, {});
    const body = await res.json();
    assert.equal(body.result.isError, true);
    assert.match(body.result.content[0].text, /many requests/);
  } finally {
    globalThis.fetch = realFetch;
  }
  assert.equal(called, 0);
});
