// Live check of a deployed server: node scripts/smoke.mjs [url]
// Legacy handshake, the modern discover, tools/list and one call per tool.
const url = process.argv[2] || 'https://formquote-mcp.chen-yu-d1.workers.dev/mcp';
const headers = { 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream', 'User-Agent': 'formquote-mcp-smoke/1.0' };
let id = 0;
async function rpc(method, params, extra = {}) {
  const res = await fetch(url, { method: 'POST', headers: { ...headers, ...extra }, body: JSON.stringify({ jsonrpc: '2.0', id: ++id, method, params }) });
  const body = await res.json();
  if (!res.ok || body.error) throw new Error(`${method}: HTTP ${res.status} ${JSON.stringify(body.error)}`);
  return body.result;
}
const ok = (cond, msg) => {
  if (!cond) throw new Error(msg);
  console.log(`ok  ${msg}`);
};

const init = await rpc('initialize', { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'formquote-mcp-smoke', version: '1' } });
ok(init.serverInfo?.name === 'formquote', `initialize → ${init.serverInfo?.title} ${init.serverInfo?.version} (${init.protocolVersion})`);
await fetch(url, { method: 'POST', headers: { ...headers, 'MCP-Protocol-Version': '2025-06-18' }, body: JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' }) });
const pv = '2026-07-28';
const disc = await rpc('server/discover', { _meta: { 'io.modelcontextprotocol/protocolVersion': pv } }, { 'MCP-Protocol-Version': pv, 'Mcp-Method': 'server/discover' });
ok(disc.supportedVersions?.includes(pv), `server/discover → ${disc.supportedVersions.join(', ')}`);
const list = await rpc('tools/list', {}, { 'MCP-Protocol-Version': '2025-06-18' });
ok(list.tools.length === 4, `tools/list → ${list.tools.map((t) => t.name).join(', ')}`);
const calls = [
  ['compare_email_verification_prices', { emails: 25000 }],
  ['compare_sound_effects_licenses', { intent: 'ui' }],
  ['compare_font_licenses', { license_use: 'web', monthly_pageviews: 10000 }],
  ['list_formquote_catalog', { category: 'email_verification' }],
];
for (const [name, args] of calls) {
  const r = await rpc('tools/call', { name, arguments: args }, { 'MCP-Protocol-Version': '2025-06-18' });
  ok(!r.isError && r.content?.[0]?.text && r.structuredContent, `${name} → ${r.content[0].text.split('\n')[0]} (${r.content[0].text.length} chars)`);
}
const bad = await rpc('tools/call', { name: 'compare_email_verification_prices', arguments: { emails: 0 } }, { 'MCP-Protocol-Version': '2025-06-18' });
ok(bad.isError === true, `invalid input → ${bad.content[0].text}`);
