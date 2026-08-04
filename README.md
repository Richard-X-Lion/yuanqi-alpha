# 元启Alpha YuanQi Alpha

> 面向券商财富管理、投顾服务和投研支持场景的多智能体 AI 投研辅助工作台。

元启Alpha 是一个用于金融机构内部投研服务准备、观点交叉复核、报告草稿生成和过程留痕的 AI 工作流系统。系统支持 A 股、港股、美股不同市场框架：A 股采用基本面、情绪面、资金面三维分析，港美股采用 Fundamental、Sentiment、Valuation 分工。

## 在线体验

[https://yuanqi-alpha.vercel.app/](https://yuanqi-alpha.vercel.app/)

> 说明：在线版本用于产品能力展示和流程体验。系统输出仅用于研究、演示、投资者教育或内部服务准备，不构成投资建议、交易指令或收益承诺。

## 产品定位

元启Alpha 通过多位专业 Agent 独立分析、主持人分歧提示、多轮辩论复核和置信度加权投票，辅助投顾或投研人员形成可人工确认、可复盘、可留痕的服务建议草稿。

## 核心亮点

- **市场框架适配**：A 股使用基本面 / 情绪面 / 资金面；港美股使用 Fundamental / Sentiment / Valuation。
- **多 Agent 独立分析**：三位分析师分别输出结构化立场、置信度、论据、证据和保留意见。
- **辩论交叉复核**：每轮辩论引入其他分析师观点和最近辩论历史，促使 Agent 复核自己的结论。
- **主持人协调机制**：主持人负责指出证据冲突、逻辑缺口和关键分歧，但不作为第四个投票者。
- **置信度加权共识**：使用辩论后的最终立场和置信度投票，达到 2/3 权重才形成团队共识。
- **BYOK + BYO MCP**：用户自行配置大模型 API Key 与金融数据 MCP；平台不提供或背书真实行情、新闻、财报与研报。
- **历史留痕与导出**：保存完整分析过程，支持历史复盘、胜率统计、图片 / PDF / JSON 导出。

## 系统流程

```text
选择市场与标的
  ↓
从用户 MCP 获取带来源标记的金融数据
  ↓
三位分析师 Agent 独立分析
  ↓
主持人提示分歧，多轮辩论交叉复核
  ↓
置信度加权投票，形成 BUY / SELL / HOLD 草稿
  ↓
主持人汇总报告，保存历史记录并支持导出
```

## 页面功能

| 路由 | 功能 |
|---|---|
| `/` | 分析工作台：市场选择、单股分析、批量分析、实时过程展示、最终报告 |
| `/settings` | API 配置：大模型 API、必填的用户 MCP 数据源 |
| `/history` | 历史战绩：分析记录、胜率统计、分析师表现 |
| `/history/[id]` | 历史详情：完整过程回放、报告导出 |
| `/api/analyze` | SSE 流式多 Agent 分析接口 |
| `/api/mcp/test` | MCP Server 连接测试接口 |

## 技术栈

| 层级 | 技术 |
|---|---|
| Framework | Next.js 16 App Router |
| UI | React 19, Tailwind CSS 4, shadcn/ui |
| Language | TypeScript 5 |
| Data Viz | Recharts |
| Export | html2canvas, jsPDF |
| LLM | OpenAI-compatible Chat Completions API |
| Data Source | 用户自行提供的 MCP（真实分析唯一数据来源） |

## 快速开始

### 安装依赖

```bash
pnpm install
```

### 本地开发

```bash
pnpm dev
```

默认本地地址：

```text
http://localhost:5000
```

### 类型检查和静态检查

```bash
pnpm run ts-check
pnpm run lint:build
```

## API Key 配置

系统采用 BYOK（Bring Your Own Key）模式。用户进入 `/settings` 后，可为四个 Agent 分别配置：

- 模型名称
- OpenAI 兼容 API Base URL
- API Key

默认模型仅作为配置示例：

| Agent | 示例模型 |
|---|---|
| 基本面 / Fundamental | `deepseek-v4-pro` |
| 情绪面 / Sentiment | `qwen3.6-plus` |
| 资金面 / Valuation | `deepseek-v4-flash` |
| 主持人 | `doubao-seed-2-0-pro-260215` |

API Key 仅保存在当前浏览器会话中；服务端不持久化用户密钥。

## MCP 数据源

真实分析必须通过 Model Context Protocol 接入用户自己的金融数据源。平台仅执行 HTTPS、公网地址与连接安全检查，并为每项数据保留 MCP 服务名和工具名。当前自动适配方向包括：

- `FinGeneralQuery`：综合金融数据查询
- `MacroIndustryData`：宏观与行业数据
- `FinancialResearchReport`：券商研报检索
- `AnnouncementData`：上市公司公告检索

未配置完整模型或可用 MCP 时，系统只运行明确标记的模拟模式。MCP token 如放在 URL 中会保存在当前用户浏览器配置里，使用者应自行确认授权、频率限制、服务条款和 token 保护方案。

## 部署

项目已提供 `vercel.json`，用于在 Vercel 环境中按 Next.js 应用构建：

```bash
pnpm next build
```

生产或演示环境可按需配置以下环境变量：

| 变量 | 说明 |
|---|---|
| `UPSTASH_REDIS_REST_URL` | 生产环境分布式限流 Redis REST 地址 |
| `UPSTASH_REDIS_REST_TOKEN` | 生产环境分布式限流 Redis REST Token |
| `TRUSTED_CLIENT_IP_HEADER` | 真实客户端 IP Header，默认 `x-forwarded-for` |
| `ALLOW_IN_MEMORY_RATE_LIMIT` | 单实例演示环境可设为 `true`；正式公网环境建议使用分布式限流 |

> 注意：Vercel Hobby 计划的函数执行时长有限。当前 `/api/analyze` 已按演示环境配置为 60 秒上限。完整多 Agent 辩论在真实模型较慢时可能需要更高执行时长或后端任务队列。

## Mock 演示模式

如需在未配置真实模型 API Key 的情况下展示完整流程，可启用 Mock 模式：

| 变量 | 示例值 |
|---|---|
| `ALLOW_IN_MEMORY_RATE_LIMIT` | `true` |

Mock 模式仅用于产品演示和流程验证。真实分析不会调用任何平台内置金融数据源，并要求用户 MCP 成功返回至少一项带来源数据。

## 数据源与合规说明

当前系统不集成平台内置真实金融数据源。正式用于公网或机构业务场景前，建议完成：

- 由 MCP 使用者确认数据源授权与频率限制
- API Key 与 MCP token 脱敏
- 模型输出合规审核
- “非投资建议 / 需人工确认”提示
- 生产环境限流与日志保护

## 免责声明

本项目输出内容仅用于研究辅助、产品演示、投资者教育或内部服务准备，不构成任何形式的投资建议、交易指令、收益承诺或代客理财服务。使用者应结合机构合规要求、客户适当性要求和人工复核流程审慎使用。

## License

本项目基于 [Apache License 2.0](./LICENSE) 开源。
