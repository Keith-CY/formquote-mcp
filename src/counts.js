// Anonymous daily counts of how the MCP server is used.
//
// One row per day and combination of fixed labels, with a running total:
// day (UTC), kind (connect, list, call), tool, category, outcome, and the
// client family. Every label comes from a fixed list below, never from what
// the user typed: no IP address, no user, session or request id, no tool
// input, no User-Agent string, no time finer than the day.
//
// Stored in a Cloudflare D1 database bound as MCP_COUNTS. Without the binding
// nothing is written anywhere. COUNTS.md shows how to read the totals.

export const BINDING = 'MCP_COUNTS';
export const KINDS = ['connect', 'list', 'call'];
export const OUTCOMES = ['ok', 'no_match', 'invalid_input', 'upstream_error', 'busy', 'error'];
export const CATEGORIES = ['email_verification', 'sound_effects', 'font_license', 'catalog'];

// Client families, matched against what the client says about itself (its
// clientInfo name or User-Agent). Directory scanners are kept apart so they
// don't read as people.
const FAMILIES = [
  ['chatgpt', /openai|chatgpt/i],
  ['claude', /claude|anthropic/i],
  ['cursor', /cursor/i],
  ['vscode', /visual studio code|vscode|copilot/i],
  ['gemini', /gemini/i],
  ['windsurf', /windsurf|codeium/i],
  ['inspector', /inspector|formquote-mcp-smoke/i],
  ['scanner', /smithery|glama|pulsemcp|mcp\.so|mcpso|registry|bot\b|crawler|spider/i],
];
export const CLIENTS = [...FAMILIES.map(([f]) => f), 'other'];

export function clientFamily(text) {
  if (typeof text !== 'string' || !text) return 'other';
  for (const [family, re] of FAMILIES) if (re.test(text)) return family;
  return 'other';
}

const pick = (value, list, fallback) => (list.includes(value) ? value : fallback);

// The row for one event; tool names are checked against the server's own list.
export function rowOf(event, toolNames, now = new Date()) {
  return {
    day: now.toISOString().slice(0, 10),
    kind: pick(event.kind, KINDS, 'call'),
    tool: event.kind === 'call' ? pick(event.tool, toolNames, '') : '',
    category: event.kind === 'call' ? pick(event.category, CATEGORIES, '') : '',
    outcome: event.kind === 'call' ? pick(event.outcome, OUTCOMES, 'error') : 'ok',
    client: clientFamily(event.client),
  };
}

export const SCHEMA = `CREATE TABLE IF NOT EXISTS mcp_counts (
  day TEXT NOT NULL,
  kind TEXT NOT NULL,
  tool TEXT NOT NULL,
  category TEXT NOT NULL,
  outcome TEXT NOT NULL,
  client TEXT NOT NULL,
  n INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (day, kind, tool, category, outcome, client)
)`;
export const UPSERT = `INSERT INTO mcp_counts (day, kind, tool, category, outcome, client, n) VALUES (?1, ?2, ?3, ?4, ?5, ?6, 1)
  ON CONFLICT (day, kind, tool, category, outcome, client) DO UPDATE SET n = n + 1`;

let ready = null;
export async function addRow(db, row) {
  ready ??= db.prepare(SCHEMA).run().catch((e) => {
    ready = null;
    throw e;
  });
  await ready;
  await db.prepare(UPSERT).bind(row.day, row.kind, row.tool, row.category, row.outcome, row.client).run();
}

// A counter for one request: writes after the response has gone (waitUntil)
// and never fails a request. Without the binding it does nothing.
export function counter(env, ctx, toolNames) {
  const db = env?.[BINDING];
  if (!db || typeof db.prepare !== 'function') return () => {};
  return (event) => {
    try {
      const p = addRow(db, rowOf(event, toolNames)).catch(() => {});
      ctx?.waitUntil?.(p);
    } catch {
      // Counting never fails a call.
    }
  };
}
