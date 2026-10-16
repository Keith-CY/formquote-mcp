// MCP over Streamable HTTP: stateless, no sessions, JSON responses (no SSE).
//
// Two eras of the protocol are answered:
//  - modern (2026-07-28): every request carries its protocol version in
//    params._meta and in the MCP-Protocol-Version / Mcp-Method / Mcp-Name
//    headers, which must match the body; `server/discover`; results carry
//    resultType and caching hints.
//  - legacy (2025-11-25, 2025-06-18, 2025-03-26): an `initialize` handshake.
//    No session id is minted, so every request stands alone.
//
// No auth, no cookies. Nothing about a request is stored or logged here; the
// optional `count` hook (counts.js) receives only fixed labels.

export const MODERN = ['2026-07-28'];
export const LEGACY = ['2025-11-25', '2025-06-18', '2025-03-26'];
export const SUPPORTED = [...MODERN, ...LEGACY];
const PV = 'io.modelcontextprotocol/protocolVersion';
const CLIENT_INFO = 'io.modelcontextprotocol/clientInfo';
const TTL = 3600000; // tools/list may be cached for an hour
const MAX_BODY = 32 * 1024;

const CORS = {
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Accept, Authorization, MCP-Protocol-Version, Mcp-Method, Mcp-Name, Mcp-Session-Id, Last-Event-ID',
  'Access-Control-Expose-Headers': 'MCP-Protocol-Version',
  'Access-Control-Max-Age': '86400',
};

// Public, read-only data with no credentials or cookies: any web origin may
// call, like the Formquote API itself (Access-Control-Allow-Origin: *). Plain
// http is refused except on localhost (the MCP Inspector).
export function originAllowed(origin) {
  if (!origin || origin === 'null') return true;
  try {
    const u = new URL(origin);
    if (u.protocol === 'https:') return true;
    return u.protocol === 'http:' && (u.hostname === 'localhost' || u.hostname === '127.0.0.1');
  } catch {
    return false;
  }
}

function respond(status, body, origin, extra = {}) {
  const headers = { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', ...CORS, ...extra };
  if (origin) {
    headers['Access-Control-Allow-Origin'] = origin;
    headers.Vary = 'Origin';
  }
  if (body === null) return new Response(null, { status, headers });
  headers['Content-Type'] = 'application/json';
  return new Response(JSON.stringify(body), { status, headers });
}
const rpcError = (id, code, message, data) => ({ jsonrpc: '2.0', id: id ?? null, error: { code, message, ...(data !== undefined ? { data } : {}) } });

// The Mcp-Name header may be base64 in a sentinel (MCP: Value Encoding).
export function headerValue(v) {
  if (v == null) return null;
  const m = /^=\?base64\?([A-Za-z0-9+/=]*)\?=$/.exec(v);
  if (!m) return v;
  try {
    return new TextDecoder().decode(Uint8Array.from(atob(m[1]), (c) => c.charCodeAt(0)));
  } catch {
    return null;
  }
}

// What the client says it is (clientInfo in either era, else the
// User-Agent). Only the matching family label leaves this function.
export function clientText(request, params) {
  const info = params?._meta?.[CLIENT_INFO] ?? params?.clientInfo;
  return [info?.name, info?.title, request.headers.get('User-Agent')].filter((x) => typeof x === 'string').join(' ').slice(0, 400);
}

// server = { info, instructions, tools(): [...], call(name, args) => Promise<result> }
// count(event) is called after a response is ready; it must never throw.
export async function handleMcp(request, server, count = () => {}) {
  const origin = request.headers.get('Origin');
  if (!originAllowed(origin)) return respond(403, rpcError(null, -32600, 'Origin not allowed'), null);
  const allow = origin && origin !== 'null' ? origin : null;
  if (request.method === 'OPTIONS') return respond(204, null, allow);
  if (request.method !== 'POST') return respond(405, rpcError(null, -32600, 'Use POST (stateless Streamable HTTP; no GET stream)'), allow, { Allow: 'POST, OPTIONS' });

  let msg;
  try {
    const declared = Number(request.headers.get('Content-Length') || 0);
    if (declared > MAX_BODY) return respond(413, rpcError(null, -32600, 'Request too large'), allow);
    const raw = await request.text();
    if (raw.length > MAX_BODY) return respond(413, rpcError(null, -32600, 'Request too large'), allow);
    msg = JSON.parse(raw);
  } catch {
    return respond(400, rpcError(null, -32700, 'Parse error'), allow);
  }
  if (Array.isArray(msg)) return respond(400, rpcError(null, -32600, 'Batches are not supported'), allow);
  if (!msg || msg.jsonrpc !== '2.0' || typeof msg.method !== 'string') {
    // A JSON-RPC response from the client: nothing to do.
    if (msg && msg.jsonrpc === '2.0' && ('result' in msg || 'error' in msg)) return respond(202, null, allow);
    return respond(400, rpcError(msg?.id, -32600, 'Invalid request'), allow);
  }
  const { id, method } = msg;
  const params = msg.params && typeof msg.params === 'object' ? msg.params : {};
  // Notifications (notifications/initialized and the like) are accepted.
  if (!('id' in msg)) return respond(202, null, allow);

  const headerPV = request.headers.get('MCP-Protocol-Version');
  const bodyPV = params._meta?.[PV];
  let version;
  if (typeof bodyPV === 'string') {
    // Headers must mirror the body (MCP: Server Validation).
    if (headerPV !== bodyPV) return respond(400, rpcError(id, -32020, `Header mismatch: MCP-Protocol-Version ${headerPV ?? '(missing)'} does not match ${bodyPV}`), allow);
    if (!SUPPORTED.includes(bodyPV)) return respond(400, rpcError(id, -32022, 'Unsupported protocol version', { supported: SUPPORTED, requested: bodyPV }), allow);
    if (request.headers.get('Mcp-Method') !== method) return respond(400, rpcError(id, -32020, `Header mismatch: Mcp-Method does not match ${method}`), allow);
    if (['tools/call', 'resources/read', 'prompts/get'].includes(method)) {
      const want = method === 'resources/read' ? params.uri : params.name;
      if (headerValue(request.headers.get('Mcp-Name')) !== want) return respond(400, rpcError(id, -32020, 'Header mismatch: Mcp-Name does not match the body'), allow);
    }
    version = bodyPV;
  } else {
    if (headerPV && !SUPPORTED.includes(headerPV)) return respond(400, rpcError(id, -32600, `Unsupported protocol version ${headerPV}; supported: ${SUPPORTED.join(', ')}`), allow);
    version = headerPV ?? '2025-03-26';
  }
  const isModern = MODERN.includes(version);
  const done = (result, cache = false) => {
    const r = isModern ? { resultType: 'complete', ...result, ...(cache ? { ttlMs: TTL, cacheScope: 'public' } : {}) } : result;
    return respond(200, { jsonrpc: '2.0', id, result: r }, allow, { 'MCP-Protocol-Version': version });
  };
  const err = (code, message, data) => respond(isModern && code === -32601 ? 404 : 200, rpcError(id, code, message, data), allow);
  const client = clientText(request, params);

  const capabilities = { tools: { listChanged: false } };
  switch (method) {
    case 'initialize': {
      // Legacy handshake: answer in the client's version if we speak it.
      const asked = params.protocolVersion;
      const pv = LEGACY.includes(asked) ? asked : LEGACY[0];
      count({ kind: 'connect', client });
      return respond(200, { jsonrpc: '2.0', id, result: { protocolVersion: pv, capabilities, serverInfo: server.info, instructions: server.instructions } }, allow, { 'MCP-Protocol-Version': pv });
    }
    case 'server/discover':
      count({ kind: 'connect', client });
      return done({ supportedVersions: SUPPORTED, capabilities, _meta: { 'io.modelcontextprotocol/serverInfo': server.info }, instructions: server.instructions }, true);
    case 'ping':
      return done({});
    case 'tools/list':
      count({ kind: 'list', client });
      return done({ tools: server.tools() }, true);
    case 'resources/list':
      return done({ resources: [] }, true);
    case 'resources/templates/list':
      return done({ resourceTemplates: [] }, true);
    case 'prompts/list':
      return done({ prompts: [] }, true);
    case 'tools/call': {
      const name = params.name;
      if (!server.tools().some((t) => t.name === name)) return err(-32602, `Unknown tool: ${typeof name === 'string' ? name.slice(0, 64) : name}`);
      const args = params.arguments && typeof params.arguments === 'object' && !Array.isArray(params.arguments) ? params.arguments : {};
      const result = await server.call(name, args);
      count({ kind: 'call', tool: name, category: result._count?.category ?? '', outcome: result._count?.outcome ?? (result.isError ? 'error' : 'ok'), client });
      delete result._count;
      return done(result);
    }
    default:
      return err(-32601, `Method not found: ${typeof method === 'string' ? method.slice(0, 64) : method}`);
  }
}
