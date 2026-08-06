# 安全政策 · Security Policy

元启Alpha 会处理用户配置的模型 API Key、MCP URL 和金融数据，因此安全问题应通过非公开渠道报告。

YuanQi Alpha handles user-configured model API keys, MCP URLs, and financial data. Security vulnerabilities should therefore be reported privately.

## 支持版本 · Supported Versions

| 版本 / Version | 支持状态 / Status |
|---|---|
| 最新 Release / Latest release | 支持 / Supported |
| `main` | 支持 / Supported |
| 更早版本 / Older versions | 不保证 / Not guaranteed |

## 报告漏洞 · Reporting a Vulnerability

请使用 GitHub 仓库的 **Security → Report a vulnerability** 私密报告功能。不要为尚未修复的安全问题创建公开 Issue。

Use the repository's **Security → Report a vulnerability** private reporting flow. Do not open a public Issue for an unpatched vulnerability.

报告中建议包含 / A useful report should include:

- 受影响版本或 commit SHA / Affected version or commit SHA
- 问题类型和潜在影响 / Vulnerability type and potential impact
- 可重复的最小验证步骤 / Minimal reproducible steps
- 已脱敏的请求、响应或日志 / Redacted requests, responses, or logs
- 建议修复方向（如有）/ Suggested remediation, if available

不要提交真实 API Key、MCP token、客户数据或未授权金融数据。请使用无效凭据和最小化测试数据完成验证。

Never submit real API keys, MCP tokens, client data, or unlicensed financial data. Use invalid credentials and minimal test fixtures when demonstrating an issue.

## 优先关注范围 · Priority Areas

- MCP URL 校验、SSRF、重定向和内网访问绕过
- API Key、MCP token 或日志中的敏感信息泄漏
- 鉴权、限流或资源消耗绕过
- 跨用户数据读取、历史记录泄漏或持久化异常
- 依赖或部署配置导致的远程代码执行风险

- MCP URL validation, SSRF, redirect handling, and private-network bypasses
- Exposure of API keys, MCP tokens, or sensitive log content
- Authentication, rate-limit, or resource-exhaustion bypasses
- Cross-user data access, history leakage, or unsafe persistence
- Remote-code-execution risks caused by dependencies or deployment configuration

明确标记的模拟数据、一般性的模型幻觉以及不包含安全影响的模型质量问题，不属于安全漏洞；可以通过普通 Issue 反馈。

Clearly labeled simulation data, general model hallucinations, and model-quality problems without a security impact are not security vulnerabilities and may be reported through a regular Issue.

## 处理方式 · Response Process

维护者会尽快确认报告、评估影响、准备修复并协调披露时间。修复发布前，请不要公开漏洞细节。

Maintainers will acknowledge reports, assess impact, prepare a fix, and coordinate disclosure timing as soon as reasonably possible. Please do not disclose vulnerability details before a fix is released.
