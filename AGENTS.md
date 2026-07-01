# 项目上下文 - 元启Alpha

## 项目概览

「元启Alpha」是一个覆盖 A 股、港股和美股的多智能体投资决策系统。A 股由基本面/消息面/资金面三个 Agent 分析；港美股按 AlphaAgents 的 Fundamental/Sentiment/Valuation 框架运行。三位分析师独立研判后辩论并置信度加权表决，主持人只负责协调、核对证据和汇总报告，不作为第四个投票者。

### 版本技术栈

- **Framework**: Next.js 16 (App Router)
- **Core**: React 19
- **Language**: TypeScript 5
- **UI 组件**: shadcn/ui (基于 Radix UI)
- **Styling**: Tailwind CSS 4
- **LLM SDK**: coze-coding-dev-sdk

### AI Agent 架构

| 市场 | 分析框架 |
|-------|---------|
| A 股 | 基本面 + 消息面 + 资金面 |
| 港股/美股 | Fundamental + Sentiment + Valuation（AlphaAgents） |

| Agent | 模型 | 平台 | 职责 |
|-------|------|------|------|
| 基本面分析师 | deepseek-v4-pro | DeepSeek (base_url: api.deepseek.com) | 财务指标、估值、行业地位 (thinking模式) |
| 情绪面分析师 | qwen-plus | 阿里云百炼 (base_url: dashscope.aliyuncs.com) | 市场情绪、舆论、政策 |
| 资金面分析师 | deepseek-v4-flash | DeepSeek (base_url: api.deepseek.com) | 主力资金、北向资金、融资融券 |
| 主持人 | doubao-seed-2-0-pro-260215 | 火山引擎 (base_url: ark.cn-beijing.volces.com) | 讨论协调、证据核对、报告汇总 |

### API调用方式

- 后端直接 fetch 调用各平台 OpenAI 兼容 API（不通过 SDK）
- 环境变量：`DEEPSEEK_API_KEY` / `DASHSCOPE_API_KEY` / `VOLCENGINE_API_KEY`
- 基本面Agent启用 DeepSeek thinking 模式 (budget_tokens: 32000)
- Mock模式：环境变量未设置时返回预设数据，前端显示「模拟模式」徽章
- 美股免费基本面数据使用 SEC Company Facts (XBRL)，生产环境需配置包含有效联系方式的 `SEC_USER_AGENT`
- 港股免费基本面回退只提供 HKEXnews 发行人财报公告入口；未结构化抽取的数字不得进入指标计算

## 目录结构

```
├── public/                     # 静态资源
├── scripts/                    # 构建与启动脚本
├── src/
│   ├── app/
│   │   ├── api/analyze/
│   │   │   └── route.ts        # 多智能体分析API (SSE流式)
│   │   ├── globals.css         # 全局样式 (深色金融终端主题)
│   │   ├── layout.tsx          # 根布局
│   │   └── page.tsx            # 主页面 (投资决策界面)
│   ├── components/ui/          # Shadcn UI 组件库
│   ├── hooks/                  # 自定义 Hooks
│   ├── lib/utils.ts            # 通用工具函数
│   └── server.ts               # 自定义服务端入口
├── next.config.ts
├── package.json
└── tsconfig.json
```

## 构建与测试命令

```bash
pnpm dev        # 启动开发环境 (端口5000)
pnpm build      # 构建生产版本
pnpm start      # 启动生产环境
pnpm ts-check   # TypeScript 类型检查
pnpm lint       # ESLint 代码检查
```

## 核心API

### POST /api/analyze

SSE流式接口，接收市场和股票名称/代码，返回多智能体分析结果。

**请求体**: `{ "market": "CN", "stockCode": "600519" }`，`market` 可为 `CN` / `HK` / `US`。

**SSE事件类型**:
- `phase` - 阶段切换 (analysis/debate/moderator)
- `agent_start` - Agent开始分析
- `agent_chunk` - Agent流式输出内容
- `agent_complete` - Agent分析完成 (含stance/score)
- `debate_start/debate_chunk/debate_complete` - 辩论阶段
- `moderator_start/moderator_chunk` - 主持人总结
- `decision` - 最终决策 (BUY/SELL/HOLD + 置信度)
- `done` - 流结束

## 设计规范

- 深色金融终端风格: 背景 #0a0e17, 卡片 #111827
- 金色主题: --color-gold (#d4a843)
- BUY绿色: --color-buy (#00c853)
- SELL红色: --color-sell (#ff1744)
- HOLD黄色: --color-hold (#ffc107)
- 等宽字体用于数据展示

## 开发规范

- 仅允许使用 pnpm
- TypeScript strict模式
- 禁止隐式 any
- LLM调用通过直接fetch各平台API（非SDK），后端only
- 禁止在前端代码中直接调用LLM
- SSE流式输出优先
