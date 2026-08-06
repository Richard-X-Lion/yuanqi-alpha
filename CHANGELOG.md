# 更新日志 · Changelog

本文件记录元启Alpha 的公开版本变化。<br>
This file records public releases of YuanQi Alpha.

## [0.1.0] - 2026-08-06

首个公开版本。<br>
Initial public release.

[在线体验 / Live Demo](https://yuanqi-alpha.vercel.app/) · [源代码 / Source Code](https://github.com/Richard-X-Lion/yuanqi-alpha)

### 核心能力 · Highlights

- 支持 A 股、港股和美股的市场差异化多 Agent 分析框架。
- 三位分析师独立分析，并在主持人引导下进行多轮交叉复核。
- 连续三轮无人改变立场时进入死锁处理。
- 使用辩论后最终立场与置信度进行一次加权投票；未达到 2/3 阈值时保持 HOLD。
- 主持人负责协调、证据核对和报告汇总，不作为第四位投票者。
- 支持用户自配置模型 API（BYOK）与金融数据 MCP（BYO MCP）。
- 保留 MCP 服务名和工具名，提供模拟模式、历史记录和多格式报告导出。
- 提供公开在线 Demo、双语 README、Apache License 2.0 和基础安全防护。

- Market-specific multi-agent frameworks for China A-shares, Hong Kong equities, and U.S. equities.
- Independent analysis by three specialist agents followed by moderator-guided multi-round cross-review.
- Deadlock handling after three consecutive rounds without a stance change.
- A single confidence-weighted vote based on final post-debate positions; HOLD is retained when the two-thirds threshold is not reached.
- A non-voting moderator responsible for coordination, evidence checks, and report synthesis.
- User-configured model APIs (BYOK) and financial-data MCP services (BYO MCP).
- MCP server/tool attribution, explicit simulation mode, analysis history, and multi-format report export.
- A public live demo, bilingual README, Apache License 2.0, and baseline security controls.

### 使用边界 · Scope and Limitations

- 非模拟分析要求三位分析师、主持人和至少一个用户 MCP 数据源均可用。
- Vercel 等 Serverless 环境可能限制完整多 Agent 流程的执行时长。
- 不同 OpenAI 兼容模型服务对参数和流式输出的支持可能存在差异。
- 本项目输出仅用于研究辅助、技术验证、产品演示或内部服务准备，不构成投资建议。

- Non-simulated analysis requires all three analysts, the moderator, and at least one functioning user MCP data source.
- Serverless platforms such as Vercel may limit execution time for a full multi-agent workflow.
- OpenAI-compatible providers may differ in parameter and streaming support.
- Outputs are for research assistance, technical evaluation, product demonstration, or internal preparation only and do not constitute investment advice.
