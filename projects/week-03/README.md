# Week 03 — Agent Runtime 状态机 / Run / Step / Event

教学版 TypeScript Runtime：Run 生命周期、Step 边界、不可变 Event 序列、乐观版本检查、FakeModel 和确定性测试。配套课程：[第 03 期](../../lessons/agent-engineering-week-03-2026-10-30.md)。

## 环境和运行

- Node.js >=22；TypeScript >=5.8.3（`npm install` 将安装 package.json 声明的编译器）。
- 无真实 LLM、API Key、数据库依赖；可离线使用 FakeModel 运行。

```bash
npm install
npm run typecheck
npm test
npm run demo
```

受限环境已有全局 TypeScript 时也可直接运行 `tsc --noEmit && tsc && node --test test/*.test.mjs && node dist/demo.js`。

## 生产边界（务必阅读）

`MemoryStore` 只用于单进程教学和离线测试，**不具备崩溃恢复、分布式互斥或持久化**。`schema.sql` 是 PostgreSQL 16+ 的表结构与 CAS 提示，**没有提供已验证的数据库 Store 实现**；未在真实 PostgreSQL 上运行迁移。`Kernel.drain()` 的 history 只在内存中，不支持从 Step 重建后续模型输入。工具示例仅执行只读模拟查询，未实现工具授权策略、审批、租约、外部写操作幂等、真实模型调用或 CI。

事件与状态应在同一数据库事务内提交；多 Worker 还需要 lease/fencing token；对远端写操作必须处理 UNKNOWN outcome。第 04 期会进一步实现 Pause/Resume 与 Crash Recovery。

## 验证记录

验证环境：Node.js 22.16.0、npm 10.9.2、全局 TypeScript 5.8.3（本环境未运行 `npm install`）。

| 命令 | 结果 |
| --- | --- |
| `npm run typecheck` | 通过 |
| `npm test` | 10/10 离线测试通过 |
| `npm run demo` | 通过，生成 3 个 Step（MODEL→TOOL→MODEL）和 Event 序列 |
| `npm install` | 未运行；使用预装的全局 TypeScript |
| PostgreSQL / 真实 LLM API / CI | 未运行 |

