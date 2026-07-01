# 元启Alpha YuanQi Alpha

> 面向券商财富管理、投顾服务和投研支持场景的多智能体 AI 投研辅助工作台。

元启Alpha 不是面向散户的“自动荐股”工具，而是一个用于金融机构内部投研服务准备、观点交叉复核、报告草稿生成和过程留痕的 AI 工作流系统。系统支持 A 股、港股、美股不同市场框架：A 股采用基本面、情绪面、资金面三维分析，港美股采用 Fundamental、Sentiment、Valuation 分工。

## 产品定位

元启Alpha 通过多位专业 Agent 独立分析、主持人分歧提示、多轮辩论复核和置信度加权投票，辅助投顾或投研人员形成可人工确认、可复盘、可留痕的服务建议草稿。

> 合规提示：系统输出仅用于研究、演示、投资者教育或内部服务准备，不构成投资建议、交易指令或收益承诺。正式使用前应结合机构合规要求、客户适当性和人工复核。

## 核心亮点

- **市场框架适配**：A 股使用基本面 / 情绪面 / 资金面；港美股使用 Fundamental / Sentiment / Valuation。
- **多 Agent 独立分析**：三位分析师分别输出结构化立场、置信度、论据、证据和保留意见。
- **辩论交叉复核**：每轮辩论引入其他分析师观点和最近辩论历史，促使 Agent 复核自己的结论。
- **主持人协调机制**：主持人负责指出证据冲突、逻辑缺口和关键分歧，但不作为第四个投票者。
- **置信度加权共识**：使用辩论后的最终立场和置信度投票，达到 2/3 权重才形成团队共识。
- **公网 BYOK**：用户自行配置大模型 API Key；MCP 数据源可选，未配置时使用内置免费数据源。
- **历史留痕与导出**：保存完整分析过程，支持历史复盘、胜率统计、图片 / PDF / JSON 导出。

## 系统流程

```text
选择市场与标的
  ↓
获取行情、财务、新闻、资金流与可选 MCP 数据
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
| `/settings` | API 配置：大模型 API、数据源 API、MCP 数据源 |
| `/history` | 历史战绩：分析记录、胜率统计、分析师表现 |
| `/history/[id]` | 历史详情：完整过程回放、报告导出 |
| `/api/analyze` | SSE 流式多 Agent 分析接口 |
| `/api/stock/price` | 股票价格查询接口 |
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
| Data Source | 东方财富、腾讯行情、SEC、HKEXnews、Nasdaq、MCP 可选 |

## 快速开始

### 1. 安装依赖

```bash
pnpm install
```

### 2. 本地开发

```bash
pnpm dev
```

默认本地地址：

```text
http://localhost:5000
```

如果 5000 端口被占用，也可以直接使用：

```bash
PORT=5001 node_modules/.bin/tsx watch src/server.ts
```

### 3. 类型检查和静态检查

```bash
pnpm run ts-check
pnpm run lint:build
```

## API Key 配置

系统采用 BYOK 模式。用户进入 `/settings` 后，为四个 Agent 分别配置：

- 模型名称
- OpenAI 兼容 API Base URL
- API Key

默认推荐模型仅作为占位示例：

| Agent | 示例模型 |
|---|---|
| 基本面 / Fundamental | `deepseek-v4-pro` |
| 情绪面 / Sentiment | `qwen3.6-plus` |
| 资金面 / Valuation | `deepseek-v4-flash` |
| 主持人 | `doubao-seed-2-0-pro-260215` |

API Key 仅保存在当前浏览器会话中；服务端不持久化密钥。

## MCP 数据源

系统支持通过 Model Context Protocol 接入专业金融数据源。当前内置 MCP 工具适配方向包括：

- `FinGeneralQuery`：综合金融数据查询
- `MacroIndustryData`：宏观与行业数据
- `FinancialResearchReport`：券商研报检索
- `AnnouncementData`：上市公司公告检索

公网演示或正式上线前，请确认 MCP Server URL 中的 token 已脱敏，并确认数据源授权、频率限制和服务条款。

## Vercel 部署

项目已提供 `vercel.json`，Vercel 会使用：

```bash
pnpm next build
```

进行构建，避免执行本地自定义服务器脚本。

推荐部署方式：

1. 保持 GitHub 仓库为 Private。
2. 登录 Vercel，选择 **Add New Project**。
3. Import `Richard-X-Lion/yuanqi-alpha`。
4. Framework Preset 选择 **Next.js**。
5. Install Command 使用 `pnpm install --frozen-lockfile`。
6. Build Command 使用 `pnpm next build`。
7. 部署完成后，将 Vercel 生成的域名填回 GitHub 仓库 About 的 Website。

### Vercel 环境变量建议

| 变量 | 说明 |
|---|---|
| `SEC_USER_AGENT` | SEC 请求标识，建议包含项目名和联系邮箱 |
| `UPSTASH_REDIS_REST_URL` | 生产环境分布式限流 Redis REST 地址 |
| `UPSTASH_REDIS_REST_TOKEN` | 生产环境分布式限流 Redis REST Token |
| `TRUSTED_CLIENT_IP_HEADER` | 真实客户端 IP Header，默认 `x-forwarded-for` |
| `DATA_SOURCE_COMPLIANCE_ACK` | 数据源授权确认版本，当前要求 `2026-06` |
| `ALLOW_IN_MEMORY_RATE_LIMIT` | 仅单实例演示可设为 `true`，不建议正式公网使用 |

> 注意：Vercel Hobby 计划的函数执行时长有限。当前 `/api/analyze` 已按演示环境配置为 60 秒上限。完整多 Agent 辩论在真实模型较慢时可能需要 Pro 计划或后端任务队列。

## 数据源与合规说明

当前系统集成了多类公开数据源与可选 MCP 专业数据源。公网正式上线前，建议完成：

- 数据源授权与频率限制确认
- API Key 与 MCP token 脱敏
- 模型输出合规审核
- “非投资建议 / 需人工确认”提示
- 生产环境限流与日志保护

## 对外宣传建议

推荐口径：

> 元启Alpha 是面向券商财富管理和投顾服务场景的多智能体 AI 投研辅助工作台，可辅助生成投研观点整理、风险提示和服务建议草稿，并保留分析过程用于复盘与合规留痕。

不建议使用：

- 自动荐股
- 保证收益
- 精准买卖点
- 自动投资决策
- 代客理财

## License

当前项目暂未声明开源许可证。仓库保持 Private 时仅供授权人员查看；若未来改为 Public，请先确认授权范围和 License。
