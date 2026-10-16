# Anonymous counts

The server keeps daily totals so its owner can see whether the connector is
used, without collecting anything about the people using it. The code is
[`src/counts.js`](src/counts.js); `src/mcp.js` calls it after each request,
and the write happens after the response has gone (`waitUntil`), so it never
slows or fails a request.

## What a row holds

| Column | Values |
|---|---|
| `day` | The date in UTC, `YYYY-MM-DD` |
| `kind` | `connect` (initialize or server/discover), `list` (tools/list), `call` (tools/call) |
| `tool` | The tool name for a call, from the server's own list; empty otherwise |
| `category` | `email_verification`, `sound_effects`, `font_license` or `catalog` for a call; empty otherwise |
| `outcome` | `ok`, `no_match` (nothing listed fits), `invalid_input`, `busy`, `upstream_error`, `error` |
| `client` | `chatgpt`, `claude`, `cursor`, `vscode`, `gemini`, `windsurf`, `inspector`, `scanner` (directory crawlers) or `other`, matched from the client's own name or User-Agent |
| `n` | How many requests that day had exactly these values |

Nothing else is stored: no IP address, no user, session or request id, no
tool input (not even the number of emails), no User-Agent string, no time
finer than the day, no cookies. Workers Logs and traces are off
(`observability.enabled: false` in `wrangler.jsonc`).

## Where it is stored

A Cloudflare D1 database, `formquote-mcp-counts`, bound to the Worker as
`MCP_COUNTS`. The table is created on first use. Each request is one
`INSERT … ON CONFLICT DO UPDATE SET n = n + 1`, so a day has one row per
combination, not one per request.

## Reading the counts

With the Cloudflare login that owns the Worker:

```sh
# Calls per day, tool and client over the last 4 weeks (people only)
npx wrangler d1 execute formquote-mcp-counts --remote --command "
  SELECT day, tool, client, outcome, SUM(n) AS n FROM mcp_counts
  WHERE kind = 'call' AND client NOT IN ('scanner', 'inspector') AND day >= date('now', '-28 days')
  GROUP BY day, tool, client, outcome ORDER BY day DESC, n DESC"

# Connections and tool lists by client family, per week
npx wrangler d1 execute formquote-mcp-counts --remote --command "
  SELECT strftime('%Y-W%W', day) AS week, kind, client, SUM(n) AS n FROM mcp_counts
  GROUP BY week, kind, client ORDER BY week DESC, n DESC"

# Which tools are picked, and how often they find something
npx wrangler d1 execute formquote-mcp-counts --remote --command "
  SELECT tool, outcome, SUM(n) AS n FROM mcp_counts WHERE kind = 'call'
  GROUP BY tool, outcome ORDER BY tool, n DESC"
```

Or in the dashboard: Storage & databases → D1 → formquote-mcp-counts → Console.

## Turning it off

Remove the `d1_databases` entry from `wrangler.jsonc` and deploy again; the
code then writes nothing. Deleting the database removes the totals.
