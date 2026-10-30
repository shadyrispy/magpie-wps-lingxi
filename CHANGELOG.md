# Changelog

## 0.3.0 — 2026-10-30

- 只保留桌面客户端通路：建会话 `POST /api/aioffice/v1/cowork/sessions` → 领 run
  `POST /api/public/v1/credits/runs` → 对话
  `POST /api/public/v1/agent-runtime/chat/completions`（SSE，原生 `messages` / `tools`）。
- 删除网页平面：不再调用 `/api/aigc/v3/...` 的 completions，也不再做 question 压平；
  `<|FunctionCallBegin|>` 正文工具桥一并移除，工具调用改由 agent-runtime 原生承担。
- 请求头对齐灵犀客户端：`X-Client-Type: lingxi_claw`、`X-Client-Lang: zh-CN`、
  `X-Cc-Agent-Type`、`X-Cc-Session-ID`、`X-Cc-Run-ID`，会话按 TTL 复用、失效自动重建一次。
- 模型目录改从 `/api/aioffice/v1/sessions/plans` 读取（失败时回退到内置模型表），
  模型的 reasoning / vision / 上下文窗口与实际可用性保持一致。
- Cookie 归一化：支持裸 `wps_sid`、`wps_sid=…`、整段 `Cookie:` 与 DevTools 复制行，
  丢弃 `kso_sid` 等无关项；账号按 uid 区分（无 uid 时按 sid 尾部），避免多账号互相覆盖。
- `variants` 改为对象（`{ low, high, max }`），修正此前数组被 magpie 读成 `"0" / "1" / "2"` 的问题。
- 保留每日签到（含一次性任务）与智点余额查询；签到、用量查询均走 `credits` 接口。
