# 元启Alpha (YuanQi Alpha)

> 多智能体AI投资决策系统 | Multi-Agent Investment Decision System

## 项目概述

「元启Alpha」是一个覆盖 A 股、港股和美股的多智能体 AI 投资决策系统，灵感源自 AlphaAgents。系统按市场启用不同的三分析师框架，经过独立分析、辩论和置信度加权表决形成团队结论；主持人只负责协调、核对证据和汇总报告，不作为第四个投票者。

### 核心特色

- **双市场框架**：A 股使用基本面/消息面/资金面；港美股使用 Fundamental/Sentiment/Valuation
- **名称与代码识别**：先选择市场，再输入股票名称或代码，后端统一解析为标准标的
- **AI辩论协商**：多轮观点交锋与1对1沟通，模拟真实投研团队的讨论过程
- **共识决策机制**：轮询辩论 → 主持人1对1澄清 → 2/3置信度加权表决 → 报告汇总
- **公网BYOK**：四个Agent由用户配置模型和API Key；MCP可选，未配置时使用内置免费数据源
- **SSE流式输出**：实时展示分析过程，提升用户体验
- **MCP数据源**：支持恒生聚源等专业数据源的MCP接入
- **历史战绩追踪**：自动保存分析记录，支持胜率统计和绩效归因

---

## 技术栈

| 层级 | 技术 |
|------|------|
| 框架 | Next.js 16 (App Router) |
| 核心 | React 19 |
| 语言 | TypeScript 5 |
| UI组件 | shadcn/ui (基于 Radix UI) |
| 样式 | Tailwind CSS 4 |
| LLM SDK | 直接fetch调用各平台OpenAI兼容API |
| 数据可视化 | recharts |
| 导出功能 | html2canvas + jspdf |

---

## AI Agent架构

### 分析师团队

| 市场 | 三位投票分析师 | 框架侧重 |
|------|--------------------|----------|
| A 股 | 基本面 / 消息面 / 资金面 | 估值与财务、政策与舆情、主力/北向/两融资金 |
| 港股、美股 | Fundamental / Sentiment / Valuation | AlphaAgents 角色分工，估值 Agent 使用价格、成交量、波动率与回撤指标 |

| Agent | 模型 | 平台 | 职责 | 特色 |
|-------|------|------|------|------|
| 基本面 / Fundamental | deepseek-v4-pro | DeepSeek | 财务、竞争优势、行业地位 | thinking模式 |
| 消息面 / Sentiment | qwen3.6-plus | 阿里云百炼 | 政策、舆论、新闻与催化剂 | 多模态理解 |
| 资金面 / Valuation | deepseek-v4-flash | DeepSeek | A 股资金流或港美股估值指标 | 按市场切换角色 |
| 主持人 | doubao-seed-2-0-pro | 火山引擎 | 讨论协调、证据核对、报告汇总 | 不参与投票 |

### 独立性设计

三位分析师是**完全独立**的Agent：
- **独立LLM调用**：分别调用不同模型/平台，互不干扰
- **独立System Prompt**：每位有专属角色定义，被明确限制"不要涉及其他面的内容"
- **独立数据输入**：共享股票数据但各自关注不同维度
- **独立输出**：各自输出stance、confidence、reasons、evidence、analysis

### 决策流程

```
数据获取 → 独立分析 → 轮询辩论 → 1对1沟通 → 投票表决 → 最终决策
```

**1. 数据获取阶段**
- 获取实时行情、财务数据、资金流向、新闻资讯
- 优先使用MCP数据源（恒生聚源），fallback到公开API

**2. 独立分析阶段**
- 三位分析师并行分析，各自输出结构化报告
- 包含：立场(BULLISH/BEARISH/NEUTRAL)、置信度(1-10)、论据、证据、保留意见

**3. 轮询辩论阶段**
- 每位分析师审视其他两位的观点
- 可选择坚持原立场或改变立场（需说明核心转变原因）
- 辩论历史累积传递，每轮基于独立分析+最近2轮辩论历史
- 连续3轮无人修改观点则判定为死锁

**4. 主持人1对1沟通**
- 针对分歧较大的分析师澄清证据冲突、遗漏信息和逻辑跳跃
- 主持人不得引入分析材料之外的新事实，也不得要求分析师迎合多数

**5. 投票表决**
- 按各分析师自报置信度加权
- 某方向达到有效票重的2/3才形成团队共识
- 未达到阈值时保持HOLD，由主持人整理分歧，不得代替团队拍板

**6. 最终报告**
- BUY/SELL/HOLD由已校验的团队共识确定，主持人不能改写方向
- 包含：置信度、目标价位、风险等级、核心逻辑、关键风险、操作建议

---

## 数据源架构

### 默认数据源

| 数据类型 | 来源 | 说明 |
|---------|------|------|
| A 股实时行情与资金流 | 东方财富 push2 API | 免费数据回退 |
| 美股历史价量 | Nasdaq 公开接口 | 用于收益、波动率、回撤和技术指标 |
| 港股历史价量 | 腾讯行情接口 | 用于估值 Agent 的定量输入 |
| 美股标准化财务 | SEC Company Facts (XBRL) | 从最新年报计算营收、利润、利润率、ROE、资产负债率与现金流 |
| 港股财报证据 | HKEXnews 标题检索 | 返回发行人披露的季报/中报/年报原始 PDF 入口，未抽取时不推断数字 |
| 新闻资讯 | 新浪财经 + 网络搜索 | 免费数据回退 |

> 公网商用前需完成数据源的授权、频率限制和 SLA 审核。SEC 数据按年报期间与表单类型筛选；港股免费回退目前只注入官方公告入口，标准化数字仍由 MCP 补充。任何缺失数据都不得由模型自行补写。

### MCP数据源（可选）

支持通过MCP协议接入恒生聚源等专业数据服务：

| 工具 | 功能 |
|------|------|
| FinGeneralQuery | 综合金融数据查询（财务、行情、资金流向） |
| MacroIndustryData | 宏观与行业数据 |
| FinancialResearchReport | 券商研报检索 |
| AnnouncementData | 上市公司公告检索 |

**配置方式**：在"API配置"页面添加MCP Server URL，系统自动注册并加载工具列表。

---

## 项目结构

```
├── public/                     # 静态资源
├── scripts/                    # 构建与启动脚本
│   ├── dev.sh                  # 开发环境启动
│   ├── build.sh                # 生产构建
│   └── start.sh                # 生产环境启动
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   ├── analyze/
│   │   │   │   └── route.ts    # 核心分析API (SSE流式)
│   │   │   └── stock/price/
│   │   │       └── route.ts    # 股票价格查询API
│   │   ├── globals.css         # 全局样式 (深色金融终端主题)
│   │   ├── layout.tsx          # 根布局
│   │   ├── page.tsx            # 主页面 (投资决策界面)
│   │   ├── history/
│   │   │   ├── page.tsx        # 历史战绩列表
│   │   │   └── [id]/
│   │   │       └── page.tsx    # 历史详情页
│   │   └── settings/
│   │       └── page.tsx        # API配置页面
│   ├── components/
│   │   ├── ui/                 # shadcn/ui 组件库
│   │   └── analysis/           # 分析相关组件
│   │       ├── AgentDetailModal.tsx    # 分析师详情弹窗
│   │       ├── AgentStructuredView.tsx # 结构化分析展示
│   │       ├── ChangeIndicator.tsx     # 立场变化指示器
│   │       ├── CollapsibleSection.tsx  # 可折叠区块
│   │       ├── StanceBadge.tsx         # 立场徽章
│   │       ├── VoteBar.tsx             # 投票结果条
│   │       └── types.ts                # 分析组件类型定义
│   ├── lib/
│   │   ├── agents/
│   │   │   ├── config.ts       # Agent配置（模型、prompt）
│   │   │   ├── llm.ts          # LLM调用封装
│   │   │   ├── parser.ts       # Agent响应解析
│   │   │   ├── prompts.ts      # Prompt构建函数
│   │   │   ├── types.ts        # Agent类型定义
│   │   │   └── mock.ts         # 模拟数据
│   │   ├── data/
│   │   │   ├── stock.ts        # 股票数据获取
│   │   │   ├── news.ts         # 新闻数据获取
│   │   │   └── types.ts        # 数据类型定义
│   │   ├── mcp/
│   │   │   ├── client.ts       # MCP客户端
│   │   │   ├── data-source.ts  # MCP数据源管理
│   │   │   ├── types.ts        # MCP类型定义
│   │   │   └── index.ts        # 导出
│   │   ├── export.ts           # 分析结果导出（图片/PDF/JSON）
│   │   ├── history.ts          # 历史记录管理
│   │   ├── api-config.ts       # API配置管理
│   │   ├── sse-client.ts       # SSE客户端封装
│   │   └── utils.ts            # 通用工具函数
│   ├── hooks/                  # 自定义Hooks
│   └── server.ts               # 自定义服务端入口
├── next.config.ts
├── package.json
├── tsconfig.json
└── README.md
```

---

## 核心API

### POST /api/analyze

SSE流式接口，接收市场与股票名称/代码，返回多智能体分析结果。

**请求体**:
```json
{
  "market": "CN",
  "stockCode": "600519",
  "userApiConfig": {
    "llm": { ... },
    "mcp": { ... }
  }
}
```

`market` 可为 `CN` / `HK` / `US`。

**SSE事件类型**:

| 事件 | 说明 |
|------|------|
| `phase` | 阶段切换 (data_fetch/analysis/debate/1v1/vote/moderator/done) |
| `data_loaded` | 数据获取完成 |
| `news_loaded` | 新闻加载完成 |
| `agent_start` | Agent开始分析 |
| `agent_chunk` | Agent流式输出内容 |
| `agent_complete` | Agent分析完成 (含stance/score) |
| `agent_status` | Agent调用状态 (success/fallback/error) |
| `debate_round` | 辩论轮次切换 |
| `debate_start` | 某Agent开始辩论发言 |
| `debate_chunk` | 辩论内容流式输出 |
| `debate_complete` | 某Agent辩论完成 |
| `deadlock` | 辩论死锁 |
| `consensus` | 辩论达成共识 |
| `1v1_round` | 1对1沟通轮次 |
| `1v1_start` | 某Agent开始1对1 |
| `1v1_moderator` | 主持人消息 |
| `1v1_chunk` | 1对1内容流式输出 |
| `1v1_complete` | 1对1完成 |
| `vote_result` | 投票结果 |
| `arbitration` | 主持人仲裁 |
| `moderator_start` | 主持人开始总结 |
| `moderator_chunk` | 主持人总结流式输出 |
| `decision` | 最终决策 (BUY/SELL/HOLD + 置信度) |
| `error` | 错误信息 |
| `done` | 流结束 |

---

## 环境变量

| 变量 | 说明 | 必需 |
|------|------|------|
| `DEEPSEEK_API_KEY` | DeepSeek API密钥 | 可选（无则进入模拟模式） |
| `DASHSCOPE_API_KEY` | 阿里云百炼API密钥 | 可选 |
| `VOLCENGINE_API_KEY` | 火山引擎API密钥 | 可选 |
| `SEC_USER_AGENT` | SEC 请求标识，公网环境应包含项目名与可联系邮箱 | 生产环境必填 |
| `UPSTASH_REDIS_REST_URL` | 分布式限流 Redis REST 地址 | 生产环境必填 |
| `UPSTASH_REDIS_REST_TOKEN` | 分布式限流 Redis REST Token | 生产环境必填 |
| `TRUSTED_CLIENT_IP_HEADER` | 反向代理写入的真实客户端 IP Header，默认 `x-forwarded-for` | 可选 |
| `DATA_SOURCE_COMPLIANCE_ACK` | 数据源条款/授权审核版本，当前要求 `2026-06` | 生产环境必填 |

> 生产环境未配置分布式限流或未确认数据源合规版本时，高成本分析/行情接口会以 `503` 拒绝请求。`ALLOW_IN_MEMORY_RATE_LIMIT=true` 仅用于明确的单实例过渡环境，不建议用于公网。

---

## 构建与运行

```bash
# 安装依赖（仅允许pnpm）
pnpm install

# 开发环境（端口5000）
pnpm dev

# TypeScript类型检查
pnpm ts-check

# ESLint代码检查
pnpm lint

# 构建生产版本
pnpm build

# 启动生产环境
pnpm start
```

---

## 设计规范

### 颜色体系

| 用途 | 色值 | 说明 |
|------|------|------|
| 背景 | `#0a0e17` | 深色金融终端背景 |
| 卡片 | `#111827` | 卡片背景 |
| 金色主题 | `#d4a843` | 品牌主色 |
| BUY（看多） | `#ff1744` | A股红色（红涨） |
| SELL（看空） | `#00c853` | A股绿色（绿跌） |
| HOLD（持有） | `#ffc107` | 黄色 |

### 交互设计

- 点击分析师卡片可弹出详情弹窗，查看完整分析
- 辩论和1对1轮次可折叠/展开
- 进度条支持点击跳转到对应阶段
- 批量分析支持最多5只股票并行分析

---

## 功能清单

### 已实现功能

- [x] 单股AI分析（基本面+情绪面+资金面）
- [x] 多轮辩论协商机制
- [x] 主持人1对1沟通
- [x] 加权投票表决
- [x] SSE流式实时输出
- [x] 模拟模式（无API Key时）
- [x] MCP数据源接入
- [x] 历史战绩保存与查看
- [x] 分析师胜率统计
- [x] 批量分析（最多5只）
- [x] 结果导出（图片/PDF/JSON）
- [x] 分析师详情弹窗
- [x] 响应式设计

### 待优化项

- [ ] 分析过程可视化（流程图）
- [ ] SSE连接稳定性增强
- [ ] 错误处理增强
- [ ] 加载状态优化
- [ ] 数值优化层（组合配权）
- [ ] Agent持续学习

---

## 免责声明

元启Alpha是一个开源学习项目，与贝莱德（BlackRock）无官方关联。系统输出的投资决策仅供参考，不构成投资建议。投资有风险，决策需谨慎。

---

## License

MIT License
