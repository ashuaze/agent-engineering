# Week 05 · Tool Gateway / MCP / Authorization / Approval / Idempotency

配套课程：[第05期完整课程](../../lessons/agent-engineering-week-05-2026-11-13.md)。

## 环境与运行

- Node.js >=22；TypeScript 5.9.x，@types/node 22.x；无真实模型 API。
- `npm install` 安装开发依赖；`npm run typecheck`、`npm test`、`npm run demo`。
- `src/gateway.ts`：可信工具注册表、参数验证、Scope 授权、审批绑定、单调用账本与 UNKNOWN 处理。
- `src/demo.ts`：模拟退款与重复调用；`test/gateway.test.ts`：安全边界回归测试。

## 教学实现的边界

- MemoryLedger 仅用于**单进程离线演示**，不具备跨进程事务、持久化、故障恢复保证；生产应使用 PostgreSQL 唯一约束、事务、outbox、lease/fencing 和下游对账。
- 这是 Gateway **领域内核**，不是 MCP SDK 客户端或 MCP 服务端；协议适配、OAuth、网络隔离、凭据托管、审计持久化、速率限制、恶意响应检测未实现。
- `approvalId` 只是教学用授权记录索引，生产必须由可信服务签发并验证，不能接受模型自行生成的审批凭证。
- 错误返回 UNKNOWN，不自动重试可能产生副作用的操作；应由 reconciliation worker 通过下游查询确认。
- Fake downstream 用于离线验证，真实财务系统及真实 MCP 端点未连接。
