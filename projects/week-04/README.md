# Week 04 — Pause / Resume / Checkpoint / Crash Recovery

对应课程：[第 04 期](../../lessons/agent-engineering-week-04-2026-11-06.md)。

## 运行

Node.js >=22.16（支持 `--experimental-strip-types`），TypeScript 5.9、`@types/node` 22。运行 `npm install && npm run typecheck && npm test && npm run demo`。

`MemoryStore` 验证状态转换和版本冲突；`FileStore` 使用临时文件与 rename 做单进程教学演示，能跨同一机器上的新 Runtime 实例恢复。`src/demo.ts` 模拟进程重建，不真的发送邮件。`schema.sql` 是 PostgreSQL 16+ 的设计草图，未连接真实数据库。

## 非生产能力

`FileStore` 的锁只在实例内，跨进程并发会发生丢失更新；rename 也不等于数据库事务或持久 fsync。示例不实现 Worker lease/fencing、checkpoint schema migration、真实 Tool Gateway、人工审批身份鉴权、外部写操作 outbox/idempotency/UNKNOWN outcome 对账；不要直接用于生产。

## 验证

本期实际执行记录见课程「验证结果」；未执行的命令不能视为通过。