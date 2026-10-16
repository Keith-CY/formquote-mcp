<p align="center"><img src="assets/icon-512.png" width="96" alt="Formquote"></p>

<h1 align="center">Formquote — MCP server</h1>

<p align="center"><b>English</b> · <a href="README.zh-CN.md">中文</a></p>

Ask an AI assistant *“what does it cost to verify 25,000 emails?”*, *“which email verifier is cheapest for 300,000 addresses if I already have 5,000 Reoon credits?”* or *“can I use GT Cinetype on a site with 50,000 pageviews a month, and what would the licence cost?”* — and get published prices from [Formquote](https://pcba-quote-lab.pages.dev/en/), each with the date it was checked, its source, and what is still unconfirmed.

```
https://formquote-mcp.chen-yu-d1.workers.dev/mcp
```

No account, no API key, no sign-in. Read-only. Streamable HTTP. Works in ChatGPT, Claude, Cursor, VS Code and any other MCP client.

## What it covers

Formquote compares **published** prices and licence terms that it has checked by hand, with a source link and a date for each. It is a small catalogue, and the tools say so:

| Category | Suppliers | Items |
|---|---|---|
| Email verification credits | MillionVerifier, Reoon, DeBounce, Emailable | 13 credit packs and plans |
| Sound effect packs | SoundMorph, HISSandaROAR, Thomas Rex Beverly Audio | 8 packs (UI sounds, motion graphics, desert ambiences, trains, a kettle) |
| Font licences | Pangram Pangram, Fontwerk, Grilli Type, Fontfabric | 6 offers (Font Starter Packs, Push, GT Cinetype, Nexa) |

The prices are list prices observed on the dates shown, **not live checkout quotes**. Taxes and checkout fees are left unconfirmed unless the seller states them. Nothing can be ordered or paid through this server. Formquote’s PCB estimates need an operator key and are not part of it.

## Tools

All four tools are read-only (`readOnlyHint: true`, `destructiveHint: false`, `idempotentHint: true`, `openWorldHint: false`).

| Tool | Input | What it returns |
|---|---|---|
| `compare_email_verification_prices` | `emails` (1–10,000,000), `existing_credits?` by supplier, `goal?`, `lang?` | Packs and plans ranked within comparable groups (one-time vs monthly, per currency): price for this request, packs needed, cost allocated to this job, unconfirmed points, checked date, seller link |
| `compare_sound_effects_licenses` | `intent` (`ui`, `motion`, `nature`, `train`, `kettle`, `any`), `seats?`, `ai_use?`, `commercial_use?`, `standalone_resale?`, `pure_sfx_percent?`, `goal?`, `lang?` | Each pack’s price and whether its licence fits (eligible / conditional / not eligible), with the points that need the seller’s confirmation |
| `compare_font_licenses` | `license_use` (`web`, `desktop`, `both`), `seats?`, `websites?`, `monthly_pageviews?`, `traffic_metric?` (`pv`/`uv`), `term_years?`, `medium?`, … | Which offers fit the use, the published price where one applies, failing or unconfirmed requirements (pageview caps, PV vs UV, styles chosen at the foundry), foundry link |
| `list_formquote_catalog` | `category?`, `lang?` | Every item with its listed price, billing period, checked date and seller page |

`goal` is `lowest_cash_now`, `lowest_job_cost` or `best_requirement_fit`. `lang` (`en`, `zh`, `ja`, `fr`, `de`) picks the language of the Formquote page linked in the answer; notes recorded by Formquote stay in their original language (mostly Chinese), which chat models translate.

Every result has a short text answer and the same data as `structuredContent`. Input is checked before anything is sent: only counts and usage facts are accepted, never email addresses or files.

<details>
<summary>Example: <code>compare_email_verification_prices</code> with <code>{"emails": 25000}</code> (excerpt)</summary>

```
Formquote · email verification for 25,000 emails · goal: lowest cash now
13 offers from 4 suppliers: 10 eligible, 3 conditional, 0 not eligible. Result: partial.
Published prices observed by Formquote on the dates shown, not live checkout quotes. …

One-time · USD · ranked by price for this request, lowest first
1. Reoon · 25,000 credits — eligible
   USD 29.66 for this request (1 pack)
   checked 2026-10-08 (stale) · https://www.reoon.com/email-verifier/
2. Reoon · 10,000 credits — eligible
   USD 35.70 for this request (3 packs) · cost allocated to this job USD 29.75
   checked 2026-10-08 (stale) · https://www.reoon.com/email-verifier/
3. DeBounce · 5,000 credits — eligible
   USD 50.00 for this request (5 packs) · cash needed now USD 50.00 · taxes included
   …
Compare on Formquote: https://pcba-quote-lab.pages.dev/en/email-verification
```

`(stale)` marks a price past Formquote’s review window (7 days for email verification, 30 for sounds and fonts).
</details>

## Connect it

### ChatGPT

1. On chatgpt.com: **Settings → Apps → Add (custom MCP server)**. Depending on your plan this sits under developer mode.
2. URL: `https://formquote-mcp.chen-yu-d1.workers.dev/mcp`. Authentication: **None**.
3. Ask: *“Use Formquote: what does it cost to verify 40,000 emails?”*

### Claude (claude.ai, Desktop, mobile)

1. **Customize → Connectors → Add custom connector**. Custom connectors work on every plan, including Free (one connector).
2. Name: `Formquote`. URL: `https://formquote-mcp.chen-yu-d1.workers.dev/mcp`. No sign-in.
3. Ask: *“用 Formquote 比较一下验证 10 万个邮箱的价格。”*

### Claude Code

```sh
claude mcp add --transport http formquote https://formquote-mcp.chen-yu-d1.workers.dev/mcp
```

### Cursor

`~/.cursor/mcp.json` (or `.cursor/mcp.json` in a project):

```json
{
  "mcpServers": {
    "formquote": { "url": "https://formquote-mcp.chen-yu-d1.workers.dev/mcp" }
  }
}
```

### VS Code (GitHub Copilot)

`.vscode/mcp.json`:

```json
{
  "servers": {
    "formquote": { "type": "http", "url": "https://formquote-mcp.chen-yu-d1.workers.dev/mcp" }
  }
}
```

### Windsurf

`~/.codeium/windsurf/mcp_config.json`:

```json
{ "mcpServers": { "formquote": { "serverUrl": "https://formquote-mcp.chen-yu-d1.workers.dev/mcp" } } }
```

### Codex CLI

`~/.codex/config.toml`:

```toml
[mcp_servers.formquote]
url = "https://formquote-mcp.chen-yu-d1.workers.dev/mcp"
```

### Gemini CLI

`~/.gemini/settings.json`:

```json
{ "mcpServers": { "formquote": { "httpUrl": "https://formquote-mcp.chen-yu-d1.workers.dev/mcp" } } }
```

### Any other client

- Clients that speak Streamable HTTP: point them at the URL above.
- Clients that only run local (stdio) servers: bridge with [`mcp-remote`](https://www.npmjs.com/package/mcp-remote) ([`examples/clients/stdio-bridge.json`](examples/clients/stdio-bridge.json)).
- Plain HTTP: [`examples/curl.sh`](examples/curl.sh).

```sh
curl -s https://formquote-mcp.chen-yu-d1.workers.dev/mcp \
  -H 'Content-Type: application/json' \
  -H 'Accept: application/json, text/event-stream' \
  -H 'MCP-Protocol-Version: 2025-06-18' \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"compare_email_verification_prices","arguments":{"emails":25000}}}'
```

The server speaks MCP 2026-07-28 (stateless, `server/discover`) and the earlier handshake versions (2025-11-25, 2025-06-18, 2025-03-26). There are no sessions; every request stands alone.

## The API behind it

The server is a thin wrapper over Formquote’s public quote API, documented at [pcba-quote-lab.pages.dev/en/developers](https://pcba-quote-lab.pages.dev/en/developers) ([OpenAPI 3.1](https://pcba-quote-lab.pages.dev/openapi.json)): `GET /api/v2/catalog` and `POST /api/v2/quotes` for the three public categories. It caches identical requests for a few minutes, times out slow calls, never answers a failed call from an older result, and keeps a shared ceiling on calls so a burst can’t overload the API.

## Privacy

- The server keeps no logs and sets no cookies. It has no accounts and no sessions.
- Tool inputs are counts and usage facts (how many emails, which licence use). They are sent to the Formquote API to compute the answer and are not stored by this server; Formquote’s API does not persist digital quote bodies either ([privacy](https://pcba-quote-lab.pages.dev/en/privacy)).
- **Anonymous counts.** To see whether the connector is useful, it keeps daily totals with fixed labels only: the day, whether it was a connection, a tool list or a tool call, which tool and category, the outcome (ok, no match, invalid input, busy, upstream error) and the client family (ChatGPT, Claude, Cursor, VS Code, …, directory scanner, other). No IP address, no user or session id, no tool input, no User-Agent string, no time finer than the day. See [`src/counts.js`](src/counts.js) and [COUNTS.md](COUNTS.md).
- Seller links open the seller’s own site, where its terms and privacy policy apply.

## Develop

```sh
npm install
npm test                 # unit tests with recorded API answers
npx wrangler dev         # http://localhost:8787/mcp
node scripts/smoke.mjs http://localhost:8787/mcp
npx -y @modelcontextprotocol/inspector --cli http://localhost:8787/mcp --transport http --method tools/list
```

Deploying needs the Cloudflare account that owns the Worker (`npx wrangler deploy`). To run your own copy, remove or replace the `d1_databases` entry in `wrangler.jsonc`; without it nothing is counted.

## Licence

The server code and examples: [MIT](LICENSE). The catalogue, prices and notes it returns come from Formquote’s API; prices belong to their sellers and change without notice.

## Contact

biz@random-walk.co.jp · [Formquote](https://pcba-quote-lab.pages.dev/en/) · [issues](https://github.com/Keith-CY/formquote-mcp/issues)
