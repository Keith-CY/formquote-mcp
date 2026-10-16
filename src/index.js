// Formquote MCP server: a Cloudflare Worker that puts Formquote's public
// quote API in AI chats. POST /mcp speaks MCP (Streamable HTTP, stateless).

import { handleMcp } from './mcp.js';
import { createClient, DEFAULT_BASE } from './formquote.js';
import { toolList, callTool, CATEGORY_OF } from './tools.js';
import { counter } from './counts.js';
import { VERSION, REPO, SERVER_INFO, INSTRUCTIONS } from './server.js';

const LANDING = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Formquote MCP server</title><meta name="robots" content="noindex"><style>body{font:16px/1.55 system-ui,sans-serif;max-width:40rem;margin:3rem auto;padding:0 1rem;color:#1d2a26;background:#f5f3ed}code{background:#e8e5da;padding:.1em .35em;border-radius:4px}a{color:#215f4d}</style></head><body>
<h1>Formquote MCP server</h1>
<p>Compare published prices and licence fit for email verification, sound effect packs and font licences from an AI chat (ChatGPT, Claude, Cursor, VS Code and any MCP client).</p>
<p>Endpoint: <code>https://formquote-mcp.HOST/mcp</code> (Streamable HTTP, no sign-in, read-only).</p>
<p>Set-up for each client: <a href="${REPO}">${REPO}</a> · Formquote: <a href="${DEFAULT_BASE}/en/">${DEFAULT_BASE.replace('https://', '')}</a></p>
</body></html>`;

function serverCard(origin) {
  return {
    serverInfo: { name: SERVER_INFO.name, title: SERVER_INFO.title, version: VERSION },
    description: SERVER_INFO.description,
    remotes: [{ type: 'streamable-http', url: `${origin}/mcp` }],
    authentication: { required: false },
    tools: toolList().map(({ name, title, description, inputSchema, annotations }) => ({ name, title, description, inputSchema, annotations })),
    repository: REPO,
  };
}

let shared = null; // one API client (and its short cache) per isolate

// A shared ceiling on tool calls across all users (the RATE_LIMIT binding,
// keyed by one constant, never by IP), so a burst can't overload the
// Formquote API. Without the binding every call is allowed.
async function allowed(env) {
  if (!env?.RATE_LIMIT?.limit) return true;
  try {
    return (await env.RATE_LIMIT.limit({ key: 'tools-call' })).success !== false;
  } catch {
    return true;
  }
}
const busy = (name) => ({
  content: [{ type: 'text', text: 'Formquote is receiving many requests right now. Wait a minute and try again.' }],
  isError: true,
  _count: { category: CATEGORY_OF[name] || '', outcome: 'busy' },
});

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const base = (env?.FORMQUOTE_API || DEFAULT_BASE).replace(/\/+$/, '');
    if (!shared || shared.base !== base) shared = createClient({ base });
    if (url.pathname === '/mcp' || url.pathname === '/mcp/') {
      const names = toolList().map((t) => t.name);
      const server = {
        info: SERVER_INFO,
        instructions: INSTRUCTIONS,
        tools: toolList,
        call: async (name, args) => ((await allowed(env)) ? callTool(shared, name, args) : busy(name)),
      };
      return handleMcp(request, server, counter(env, ctx, names));
    }
    if (request.method !== 'GET' && request.method !== 'HEAD') return new Response('Not found', { status: 404 });
    if (url.pathname === '/') {
      return new Response(LANDING.replace('https://formquote-mcp.HOST/mcp', `${url.origin}/mcp`), { headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'public, max-age=3600' } });
    }
    if (url.pathname === '/.well-known/mcp/server-card.json') {
      return Response.json(serverCard(url.origin), { headers: { 'Cache-Control': 'public, max-age=3600', 'Access-Control-Allow-Origin': '*' } });
    }
    if (url.pathname === '/robots.txt') return new Response('User-agent: *\nAllow: /\n', { headers: { 'Content-Type': 'text/plain' } });
    return new Response('Not found', { status: 404 });
  },
};
