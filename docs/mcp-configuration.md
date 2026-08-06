# MCP Configuration Guide

This guide explains how to connect user-provided financial data through the
Model Context Protocol and how to troubleshoot the most common setup failures.
It contains no real tokens or credentials.

## Where to configure MCP servers

Open `/settings` in the running application.

1. Enable the **MCP data source** toggle.
2. For each server, enter a display name and the remote HTTPS URL.
3. Enable the server.
4. Use **Test connection** to verify initialization, protocol version, and the
   tool list.

The platform stores MCP URLs in the browser configuration. It does not provide
market data, news, financial statements, research reports, or announcements.
Non-simulated analysis uses only the enabled MCP servers that return attributed
evidence.

## HTTPS and public-address requirements

Only `https://` URLs are accepted.

The URL must be a public address. The platform rejects:

- HTTP URLs
- URLs with embedded usernames or passwords
- Localhost, LAN, private, loopback, or reserved addresses
- URLs whose DNS resolves to a blocked private address

## Tokens embedded in URLs

If the MCP provider requires a token in the URL, that URL is kept in the current
browser configuration.

Follow these rules:

- Never commit MCP URLs containing tokens.
- Never paste tokenized URLs into issues, logs, screenshots, or pull requests.
- Rotate the token if it was exposed.
- Prefer header-based or short-lived authentication when the provider supports it.

## Server and tool attribution

The system retains the MCP server name and tool name for every evidence item.
The analysis report can therefore show which financial-data source produced a
given value. A missing attribution usually means the MCP response was empty or
the tool was not selected.

## Troubleshooting order

1. **Connection failed**
   - Confirm the URL starts with `https://`.
   - Confirm the host is public and reachable from your deployment network.
   - Confirm the provider endpoint is up and the token is valid.

2. **`fetch failed`**
   - Check TLS, DNS, and firewall settings for the environment.
   - Verify the endpoint returns valid JSON or `text/event-stream`.
   - Check whether the provider requires a different regional endpoint.

3. **No available tools**
   - Confirm the server implements MCP `tools/list`.
   - Check the provider permissions and account plan.
   - Confirm the tool names match the expected financial-data directions.

4. **No returned data**
   - Test the same tool directly with provider documentation.
   - Check query arguments, supported markets, and rate limits.
   - Confirm the tool result is not an error object.

5. **Simulation mode still runs**
   - Non-simulated analysis requires complete model configuration and at least
     one attributed evidence item from an enabled MCP server.
   - If MCP is disabled, a server is disabled, or no tool returns data, the
     system intentionally runs the clearly labeled simulation mode.

## Security checklist

- Use Testnet or sandbox data where the provider offers it.
- Keep API keys and MCP tokens out of repository files.
- Review data licensing, rate limits, and service terms before production use.
- Treat MCP data as untrusted input; never let it change the analysis rules.

---

# MCP 配置指南

本文说明如何接入用户自备的 MCP 金融数据源，以及如何排查最常见的连接问题。
文中不包含任何真实 token 或凭据。

## 在哪里配置 MCP Server

在运行中的应用中打开 `/settings`：

1. 打开 **MCP 数据源** 开关。
2. 为每个服务填写显示名称和远程 HTTPS URL。
3. 启用该服务。
4. 点击 **测试连接** 验证协议版本、服务信息和工具列表。

平台会保存 MCP URL 配置，但本身不提供行情、新闻、财报、研报或公告。非模拟
分析只会使用已启用且返回带来源证据的 MCP 服务。

## HTTPS 与公网地址要求

只接受 `https://` URL。平台会拒绝 HTTP、包含用户名或密码的 URL，以及
localhost、局域网、私网、回环或保留地址。

## URL 中包含 token 的注意事项

如果服务商要求把 token 放在 URL 中，该 URL 会保存在当前浏览器配置中。

- 不要把包含 token 的 URL 提交到仓库。
- 不要在 Issue、日志、截图或 PR 中公开 token。
- 一旦泄露，请立即轮换 token。
- 如果服务商支持 Header 鉴权或短期 token，优先使用。

## 服务与工具来源

系统会为每条证据保留 MCP 服务名和工具名。报告中缺少来源，通常表示 MCP
返回为空，或者没有选中可用工具。

## 排查顺序

1. **连接失败**：确认 `https://`、公网可达、服务商状态和 token 有效。
2. **`fetch failed`**：检查 TLS、DNS、防火墙，以及端点是否返回合法 JSON 或
   `text/event-stream`。
3. **没有可用工具**：确认服务实现 `tools/list`，检查账号权限和套餐。
4. **没有返回数据**：直接按服务商文档测试工具，检查参数、市场和限流。
5. **仍然进入模拟模式**：非模拟分析要求模型配置完整，并且至少有一条来自
   已启用 MCP 的带来源证据。否则系统会明确进入模拟模式。

## 安全清单

- 优先使用 Testnet 或沙箱数据。
- 不要把 API Key 或 MCP token 提交到仓库。
- 生产使用前确认数据授权、频率限制和服务条款。
- 将 MCP 数据视为不可信输入，禁止其改变分析规则。
