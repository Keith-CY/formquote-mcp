<p align="center"><img src="assets/icon-512.png" width="96" alt="Formquote"></p>

<h1 align="center">Formquote — MCP 服务器</h1>

<p align="center"><a href="README.md">English</a> · <b>中文</b></p>

在 AI 助手里直接问：「验证 25,000 个邮箱要多少钱？」「我已经有 5,000 个 Reoon 额度，验证 30 万个邮箱哪家最便宜？」「GT Cinetype 能不能用在每月 5 万浏览量的网站上，授权多少钱？」——回答来自 [Formquote](https://pcba-quote-lab.pages.dev/zh/) 收录的公开价格，每一条都带着核对日期、来源链接，以及还没确认的事项。

```
https://formquote-mcp.chen-yu-d1.workers.dev/mcp
```

不用注册，不用 API 密钥，不用登录。只读。Streamable HTTP。ChatGPT、Claude、Cursor、VS Code 等所有支持 MCP 的客户端都能用。

## 覆盖范围

Formquote 比较的是**公开**价格和授权条款，都经过人工核对，每条附来源和日期。目录不大，工具说明里也如实写明：

| 品类 | 供应商 | 条目 |
|---|---|---|
| 邮箱验证额度 | MillionVerifier、Reoon、DeBounce、Emailable | 13 个额度包和月方案 |
| 音效素材包 | SoundMorph、HISSandaROAR、Thomas Rex Beverly Audio | 8 个包（界面音效、动态图形、沙漠环境声、火车、水壶） |
| 字体授权 | Pangram Pangram、Fontwerk、Grilli Type、Fontfabric | 6 个方案（Font Starter Packs、Push、GT Cinetype、Nexa） |

价格是在标注日期观察到的公开标价，**不是实时结账报价**。除非商家写明，税费和结账附加费用都按「待确认」处理。通过这个服务器不能下单或付款。Formquote 的 PCB 估价需要操作员密钥，不在此列。

## 工具

四个工具都是只读的（`readOnlyHint: true`、`destructiveHint: false`、`idempotentHint: true`、`openWorldHint: false`）。

| 工具 | 输入 | 返回 |
|---|---|---|
| `compare_email_verification_prices` | `emails`（1–10,000,000）、`existing_credits?`（各家已有额度）、`goal?`、`lang?` | 在可比较的分组里排序（一次性包 / 月方案，按币种）：本次需求的价格、需要几个包、分摊到本次任务的成本、待确认事项、核对日期、商家链接 |
| `compare_sound_effects_licenses` | `intent`（`ui`、`motion`、`nature`、`train`、`kettle`、`any`）、`seats?`、`ai_use?`、`commercial_use?`、`standalone_resale?`、`pure_sfx_percent?`、`goal?`、`lang?` | 每个包的价格、授权是否适用（适用 / 有条件 / 不适用），以及需要向商家确认的条款 |
| `compare_font_licenses` | `license_use`（`web`、`desktop`、`both`）、`seats?`、`websites?`、`monthly_pageviews?`、`traffic_metric?`（`pv`/`uv`）、`term_years?`、`medium?` 等 | 哪些方案适用、适用时的公开价格、不满足或待确认的条件（浏览量上限、PV 与 UV、需在字体商处选择字重）、字体商链接 |
| `list_formquote_catalog` | `category?`、`lang?` | 全部条目的标价、计费周期、核对日期和商家页面 |

`goal` 可选 `lowest_cash_now`（现在付钱最少）、`lowest_job_cost`（分摊到本次任务最省）、`best_requirement_fit`（最符合需求）。`lang`（`en`、`zh`、`ja`、`fr`、`de`）决定回答里链接的 Formquote 页面语言；Formquote 记录的备注保持原文（多为中文）。

每个结果都有一段简短的文字回答，同样的数据也放在 `structuredContent` 里。发送前会先检查输入：只接受数量和用途，不接受邮箱地址或文件。

## 接入方法

### ChatGPT

1. chatgpt.com：**设置 → 应用 → 添加（自定义 MCP 服务器）**。视套餐不同，可能在开发者模式里。
2. URL：`https://formquote-mcp.chen-yu-d1.workers.dev/mcp`。认证：**无**。
3. 试着问：「用 Formquote 查一下验证 4 万个邮箱要多少钱。」

### Claude（claude.ai、桌面版、手机）

1. **Customize → Connectors → Add custom connector**。所有套餐都能加自定义连接器，免费版可以加一个。
2. 名称：`Formquote`。URL：`https://formquote-mcp.chen-yu-d1.workers.dev/mcp`。无需登录。
3. 试着问：「用 Formquote 比较一下验证 10 万个邮箱的价格。」

### Claude Code

```sh
claude mcp add --transport http formquote https://formquote-mcp.chen-yu-d1.workers.dev/mcp
```

### Cursor

`~/.cursor/mcp.json`（或项目里的 `.cursor/mcp.json`）：

```json
{
  "mcpServers": {
    "formquote": { "url": "https://formquote-mcp.chen-yu-d1.workers.dev/mcp" }
  }
}
```

### VS Code（GitHub Copilot）

`.vscode/mcp.json`：

```json
{
  "servers": {
    "formquote": { "type": "http", "url": "https://formquote-mcp.chen-yu-d1.workers.dev/mcp" }
  }
}
```

### Windsurf

`~/.codeium/windsurf/mcp_config.json`：

```json
{ "mcpServers": { "formquote": { "serverUrl": "https://formquote-mcp.chen-yu-d1.workers.dev/mcp" } } }
```

### Codex CLI

`~/.codex/config.toml`：

```toml
[mcp_servers.formquote]
url = "https://formquote-mcp.chen-yu-d1.workers.dev/mcp"
```

### Gemini CLI

`~/.gemini/settings.json`：

```json
{ "mcpServers": { "formquote": { "httpUrl": "https://formquote-mcp.chen-yu-d1.workers.dev/mcp" } } }
```

### 其他客户端

- 支持 Streamable HTTP 的客户端：直接填上面的 URL。
- 只能运行本地（stdio）服务器的客户端：用 [`mcp-remote`](https://www.npmjs.com/package/mcp-remote) 桥接（[`examples/clients/stdio-bridge.json`](examples/clients/stdio-bridge.json)）。
- 直接用 HTTP：见 [`examples/curl.sh`](examples/curl.sh)。

服务器支持 MCP 2026-07-28（无状态，`server/discover`）以及更早的握手版本（2025-11-25、2025-06-18、2025-03-26）。没有会话，每个请求独立。

## 背后的接口

这个服务器是 Formquote 公开报价接口的一层薄包装，接口文档见 [pcba-quote-lab.pages.dev/zh/developers](https://pcba-quote-lab.pages.dev/zh/developers)（[OpenAPI 3.1](https://pcba-quote-lab.pages.dev/openapi.json)）：三个公开品类使用 `GET /api/v2/catalog` 和 `POST /api/v2/quotes`。相同请求会缓存几分钟，慢请求会超时，失败时绝不拿旧结果顶替，并设有总调用上限，避免突发流量压垮接口。

## 隐私

- 服务器不记日志，不设 cookie，没有账号，也没有会话。
- 工具输入只是数量和用途（多少个邮箱、什么授权用途），只发给 Formquote 接口用来计算答案，本服务器不保存；Formquote 接口也不保存数字报价请求内容（见其[隐私说明](https://pcba-quote-lab.pages.dev/zh/privacy)）。
- **匿名计数。**为了判断这个连接器有没有用，服务器只按天记录几个固定标签的合计：日期、是连接 / 列工具 / 调用工具、哪个工具和品类、结果（成功、无匹配、输入无效、繁忙、上游出错）、客户端类别（ChatGPT、Claude、Cursor、VS Code……目录扫描器、其他）。不记 IP，不记用户或会话编号，不记工具输入，不记 User-Agent 原文，时间只精确到天。见 [`src/counts.js`](src/counts.js) 和 [COUNTS.md](COUNTS.md)。
- 商家链接打开的是商家自己的网站，适用对方的条款和隐私政策。

## 开发

```sh
npm install
npm test                 # 用录制的接口回答跑单元测试
npx wrangler dev         # http://localhost:8787/mcp
node scripts/smoke.mjs http://localhost:8787/mcp
```

部署需要拥有该 Worker 的 Cloudflare 账号（`npx wrangler deploy`）。自己部署一份时，把 `wrangler.jsonc` 里的 `d1_databases` 删掉或换成自己的；没有它就不计数。

## 许可

服务器代码和示例：[MIT](LICENSE)。返回的目录、价格和备注来自 Formquote 接口；价格属于各商家，随时可能变化。

## 联系

biz@random-walk.co.jp · [Formquote](https://pcba-quote-lab.pages.dev/zh/) · [issues](https://github.com/Keith-CY/formquote-mcp/issues)
