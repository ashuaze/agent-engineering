# Agent 工程深度学习

> 从一个能调用工具的 LLM，逐步构建**可控、可恢复、可观测、可评测**的生产级 Agent 系统。

**Agent Engineering · Production-first · TypeScript / Node.js · 持续更新**

## 这门课程是什么？

《Agent 工程深度学习》是一套面向工程实践的中文系列课程，围绕 **Agent = Model + Harness** 展开：模型负责理解、推理与提出行动；Harness / Runtime 负责上下文、工具执行、状态持久化、权限、恢复、审计与质量保障。

课程不以“几行代码跑通一个 Agent”为终点，也不追逐每周的新框架，而是从一个最小 Agent Loop 出发，逐期演进为能承受真实业务约束的系统。每期聚焦一个工程问题，解释设计边界、失败模式、方案权衡，并提供 TypeScript 示例和可检验的实践任务。

典型问题包括：模型提出的 Tool Call 何时能执行？进程崩溃后如何恢复？如何避免重复退款？Memory 与 RAG 如何处理权限及版本？如何做观测、评测与线上故障定位？

## 适合谁？

- 有 **TypeScript / Node.js 后端**基础，准备设计或落地 AI Agent 的工程师；
- 正在建设企业知识库、RAG、业务工具调用、长任务工作流或多租户 AI 服务的团队；
- 希望超越 SDK 示例，理解 **Runtime、Memory、Context、Tool Gateway、Security、Evals** 之间真实依赖关系的开发者。

**建议前置能力**：async/await、HTTP API、基本数据库事务、类型系统与异常处理。无需提前掌握某个 Agent 框架，但阅读每期代码前最好熟悉 Node.js 的运行方式。

## 学完能得到什么？

- 看懂 Agent Runtime 的执行边界，设计 Run / Step / Event、状态机、Checkpoint 与恢复流程；
- 为 Tool Calling 建立 Schema 校验、授权、审批、幂等与外部副作用对账机制；
- 设计从 RAG、Retrieval 到 Context / Memory 的信息流和数据隔离边界；
- 建立模型路由、可观测性、评测与回归测试方法；
- 逐步积累一套有架构说明、源码与测试的 **TypeScript Agent 工程参考实现**。

**阅读与练习节奏**：每期约 15–25 分钟正文 + 30–60 分钟实践。每期尽量包含原理、Mermaid 图、核心代码、设计取舍、真实失败场景、动手作业、验收标准、思考题和参考资料。示例的验证状态按当期 README 记录，不将教学实现宣称为生产就绪。

## 已发布课程

<!-- ISSUES:START -->


| 期号 | 发布日期 | 完整课程 | 实践材料 | 归档备注 |
| --- | --- | --- | --- | --- |
| 01 | 2026-10-12 | [Agent = Model + Harness：从 LLM 调用到可靠执行系统](lessons/agent-engineering-week-01-2026-10-12.md) | [源码](projects/week-01/README.md) | 原稿归档 |
| 02 | 2026-10-23 | [LLM Tool Calling：从模型协议到可靠工具执行](lessons/agent-engineering-week-02-2026-10-23.md) | [源码](projects/week-02/README.md) | 原稿归档 |
| 03 | 2026-10-30 | [Agent Runtime 状态机：Run / Step / Event 建模与持久化设计](lessons/agent-engineering-week-03-2026-10-30.md) | [源码](projects/week-03/README.md) | 课程已归档 |
| 04 | 2026-11-06 | [Pause / Resume、Checkpoint、乐观锁与 Crash Recovery](lessons/agent-engineering-week-04-2026-11-06.md) | [源码](projects/week-04/README.md) | 课程已归档 |

<!-- ISSUES:END -->

## 16 期学习路线

先建立**执行内核**，再处理**上下文与数据**，随后补齐**治理与质量体系**，最后集成为一个端到端项目。下表的主题为学习规划；实际内容会根据后续实践与文档演进调整，**未发布期次不预置空链接**。

| 阶段 | 期号 | 主题 | 关键工程问题 | 状态 |
| --- | --- | --- | --- | --- |
| Ⅰ · 执行内核 | 01 | Agent = Model + Harness | 模型与执行系统的职责边界、最小 Agent Loop | 已发布 |
| Ⅰ · 执行内核 | 02 | LLM Tool Calling | 协议、JSON Schema、并行与依赖、错误处理 | 已发布 |
| Ⅰ · 执行内核 | 03 | Runtime 状态机 | Run / Step / Event、状态迁移与执行记录 | 已发布 |
| Ⅰ · 执行内核 | 04 | Pause / Resume 与 Crash Recovery | Checkpoint、乐观锁、恢复、未知外部结果 | 已发布 |
| Ⅰ · 执行内核 | 05 | Tool Gateway 与 MCP | 工具隔离、权限、审批与幂等 | 规划中 |
| Ⅱ · 上下文与知识 | 06 | Context Engineering | Token 预算、信息选择、压缩与上下文构造 | 规划中 |
| Ⅱ · 上下文与知识 | 07 | Memory 类型与架构 | Working / Session / Semantic / Episodic / Procedural | 规划中 |
| Ⅱ · 上下文与知识 | 08 | Memory 生命周期 | 写入、检索、更新、遗忘、冲突与评测 | 规划中 |
| Ⅱ · 上下文与知识 | 09 | RAG 数据工程 | Ingestion、Chunking、Metadata、ACL、版本更新 | 规划中 |
| Ⅱ · 上下文与知识 | 10 | Retrieval Pipeline | BM25、Vector、Hybrid Search、Rerank | 规划中 |
| Ⅲ · 编排与治理 | 11 | Planning 与 Routing | Agentic 与 Deterministic Workflow 的取舍 | 规划中 |
| Ⅲ · 编排与治理 | 12 | Model Gateway | 模型路由、缓存、可靠性与成本控制 | 规划中 |
| Ⅲ · 编排与治理 | 13 | Agent Security | Prompt Injection、数据泄露、授权边界 | 规划中 |
| Ⅲ · 编排与治理 | 14 | Observability | Trace、审计、故障定位与调试 | 规划中 |
| Ⅲ · 编排与治理 | 15 | Evals | 评测集、工具调用质量、回归与对抗测试 | 规划中 |
| Ⅳ · 综合实战 | 16 | Production Agent Project | 整合 Runtime、Tools、Memory、RAG、安全和评测 | 规划中 |

第 16 期后计划持续进入更高级专题，如多 Agent 协作、长期任务调度、分布式执行、一致性、成本与质量优化，而不是重新循环基础概念。

## 如何使用这份仓库

1. **按序读课**：在“已发布课程”表中打开 Markdown 正文，先理解系统模型与失败场景，再看实现。
2. **运行对应源码**：进入 `projects/week-NN/`，先读项目 README 中的环境要求、运行命令及已知限制。
3. **完成验收练习**：使用 FakeModel、离线数据和确定性测试验证 Runtime 行为，再考虑接入真实 API。
4. **带着工程问题复盘**：记录哪些状态必须持久化、哪些动作不能盲目重试、哪些安全条件不能交给模型判断。

### 仓库结构

```text
agent-engineering/
├── README.md              # 课程定位、目录与归档说明
├── lessons/               # 第 NN 期完整课程 Markdown
│   └── agent-engineering-week-NN-YYYY-MM-DD.md
└── projects/
    └── week-NN/           # 第 NN 期源码、README 与测试
```

### 贯穿课程的工程原则

- **模型提出建议，可信 Runtime 决定是否执行**：校验、权限与业务规则不由模型最终裁决。
- **以失败场景驱动架构**：超时、重复调用、崩溃恢复、多 Worker 竞争和结果未知都是正常系统状态。
- **显式区分保证与假设**：At-least-once、幂等、原子提交、Exactly-once 的适用边界要写清楚。
- **可复现胜于 Demo 成功**：优先提供 FakeModel、自动化测试、验收条件和运行限制。
- **先用简单工作流，再增加自主性**：只有确实需要动态决策时才引入 Agentic Loop。

## 归档与同步

- `lessons/`：完整 UTF-8 Markdown 课程，保留图、代码、作业与原始来源链接。
- `projects/week-NN/`：当期实践源码与运行说明；不提交依赖目录、密钥或环境变量值。
- GitHub 同步范围：完整课程、实践源码和课程目录；`originals/` 原始附件不提交到仓库。
- 既有「Agent 系统设计深度周刊」任务每期生成后同步此仓库 main 分支并更新本目录。
- 相同期号先比对内容；相同则不提交，修订通过 Git 历史追踪，不覆盖其他期次。
- 第 01 期保留原始教学代码，尚未在本次归档中运行测试。
- 第 02 期完整课程与实践源码已归档；本次类型检查、7 个自动化测试及离线演示通过，具体命令与环境说明见 [项目 README](projects/week-02/README.md)。真实模型 API 未运行。
- 第 03 期 TypeScript 内存教学内核已通过类型检查、10 个离线测试与演示；真实 PostgreSQL、LLM API、CI 未运行。详见 [项目 README](projects/week-03/README.md)。

- 第 04 期：6/6 离线测试及演示通过；依赖安装超时，类型检查因缺少 `@types/node` 未通过；真实 PostgreSQL、CI、模型 API 未验证。
