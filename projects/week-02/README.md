# Agent 工程深度学习 · 第 02 期代码

Node.js >= 22，TypeScript 5.9，Zod 4.6，OpenAI Node SDK 7.10+。

```bash
npm install
npm run typecheck
npm test
npm run demo
```

真实 API（会产生费用，并使用 `store: true` 的服务端响应链）：

```bash
export OPENAI_API_KEY=...
export OPENAI_MODEL=gpt-5.4-mini
npm run live
```

这是教学实现，不是生产服务。`runAgent` 的上下文保存在内存中，没有 Run/Step 持久化、写操作审批恢复、数据库幂等记录或进程崩溃恢复。工具超时依赖 `AbortSignal` 的合作式取消；远端副作用无法靠 abort 撤销。`OpenAIModelSession` 必须每个 Run 单独创建，不能作为跨用户共享单例。示例工具返回模拟数据，不代表已执行真实业务租户隔离查询。
## 本次补档与验证（2026-10-23）

源码与 `package.json` 保留原 ZIP 内容。本次新增依赖锁文件及本节验证记录；原 ZIP 可从 [这里下载](../../originals/week-02/agent-engineering-week-02.zip)。

验证环境：Node.js v24.19.0、npm 11.9.0。锁定的直接依赖：TypeScript 5.9.3、Zod 4.6.7、OpenAI SDK 7.43.0、tsx 4.23.15、@types/node 22.20.5。

| 检查 | 本次结果 |
| --- | --- |
| `npm install --ignore-scripts --fetch-retries=0 --fetch-timeout=15000 --no-audit --no-fund` | 成功 |
| `npm run typecheck` | 通过 |
| `npm test` / `npm run demo` | 当前受限环境的 `tsx` CLI IPC 管道报 `EPERM`，未启动测试或演示 |
| `node --import tsx --test test/*.test.ts` | 等效加载方式下 7 个测试全部通过 |
| `node --import tsx src/demo.ts` | 通过；2 次模型轮次、2 次工具调用，Call ID 正确关联 |
| `npm run live` | 未运行，未调用真实模型 API |

原课程中的“未执行验证”描述记录的是发布时的环境；上表记录本次实际运行结果。真实模型协议交互和业务服务集成仍未验证。重新安装本次依赖可使用 `npm ci`。
