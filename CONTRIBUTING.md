# 参与贡献 · Contributing to YuanQi Alpha

感谢你关注元启Alpha。我们欢迎问题反馈、文档改进、测试补充、界面优化和功能贡献。

Thank you for your interest in YuanQi Alpha. Bug reports, documentation improvements, tests, UI enhancements, and feature contributions are welcome.

## 开始之前 · Before You Start

1. 阅读 [README](./README.md)，了解项目定位、数据边界和免责声明。
2. 搜索现有 [Issues](https://github.com/Richard-X-Lion/yuanqi-alpha/issues)，避免重复提交。
3. 对较大的功能改动，建议先创建 Issue 说明使用场景、预期行为和实现方向。
4. 不要在 Issue、截图、日志或提交中包含 API Key、MCP token、真实客户数据或未授权金融数据。

1. Read the [README](./README.md) to understand the product scope, data boundaries, and disclaimer.
2. Search existing [Issues](https://github.com/Richard-X-Lion/yuanqi-alpha/issues) before opening a new one.
3. For substantial changes, open an Issue first to describe the use case, expected behavior, and proposed approach.
4. Never include API keys, MCP tokens, real client data, or unlicensed financial data in issues, screenshots, logs, or commits.

## 本地开发 · Local Development

环境要求 / Prerequisites:

- Node.js 20+
- pnpm 9+

```bash
git clone https://github.com/Richard-X-Lion/yuanqi-alpha.git
cd yuanqi-alpha
pnpm install
pnpm dev
```

提交前请运行 / Before submitting:

```bash
pnpm test
pnpm run validate
pnpm build
```

## 贡献流程 · Contribution Workflow

1. Fork 仓库并从 `main` 创建功能分支。
2. 保持改动聚焦，一次 Pull Request 解决一个明确问题。
3. 为行为变化补充或更新测试。
4. 同步更新相关中英文文档。
5. 填写 Pull Request 模板，并说明验证结果和可能风险。

1. Fork the repository and create a feature branch from `main`.
2. Keep changes focused: one pull request should address one clearly defined problem.
3. Add or update tests for behavioral changes.
4. Update the relevant Chinese and English documentation.
5. Complete the pull request template, including validation results and potential risks.

建议的分支名称 / Suggested branch names:

```text
feat/short-description
fix/short-description
docs/short-description
test/short-description
```

## 金融 AI 项目约束 · Financial AI Project Rules

- 主持人只负责协调、证据核对和报告汇总，不得作为第四位投票者。
- A 股与港美股使用不同分析角色，修改 Agent 逻辑时必须保留市场差异。
- 非模拟分析只能使用用户提供的 MCP 数据，并保留 MCP 服务名与工具名。
- 模型或 MCP 配置不完整时，输出必须明确标记为模拟模式。
- 不得加入“保证收益、自动荐股、稳赚、精准买卖点”等宣传或交互表达。
- LLM 请求只能从服务端发起，不得将用户密钥写入前端源码或日志。

- The moderator coordinates, verifies evidence, and summarizes reports; it must not become a fourth voter.
- China A-shares and HK/U.S. equities use different analyst roles; market distinctions must be preserved.
- Non-simulated analysis may use only user-provided MCP data and must retain MCP server and tool attribution.
- Incomplete model or MCP configuration must result in an explicitly labeled simulation mode.
- Do not add claims such as guaranteed returns, automatic stock picking, certain profits, or precise buy/sell points.
- LLM requests must originate from the server. Never place user secrets in frontend source code or logs.

## Pull Request 检查清单 · Pull Request Checklist

- [ ] 改动范围清晰，没有夹带无关文件
- [ ] `pnpm test` 通过
- [ ] `pnpm run validate` 通过
- [ ] 涉及构建配置时，`pnpm build` 通过
- [ ] 新行为有相应测试或说明
- [ ] 文档与界面文案保持中英文一致
- [ ] 不包含任何密钥、token 或真实客户数据
- [ ] 投研输出仍明确标注需要人工确认且不构成投资建议

- [ ] The change is focused and contains no unrelated files
- [ ] `pnpm test` passes
- [ ] `pnpm run validate` passes
- [ ] `pnpm build` passes when build configuration is affected
- [ ] New behavior is covered by tests or clearly documented
- [ ] Chinese and English documentation remain aligned
- [ ] No secrets, tokens, or real client data are included
- [ ] Research outputs remain subject to human review and are not presented as investment advice

## 许可 · License

提交贡献即表示你同意按照本项目的 [Apache License 2.0](./LICENSE) 授权你的贡献。

By contributing, you agree that your contribution will be licensed under the project's [Apache License 2.0](./LICENSE).
