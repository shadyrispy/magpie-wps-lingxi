# 一次性任务（专家模式 / 群聊 / 使用客户端）验证指引

> 给「有未完成任务账号」的同学：这份文档说明**要验证什么、怎么验、怎么回报**。
> 我们的测试账号三个任务已经全部领取完（累计 1500 智点），无法观察状态翻转，所以需要你帮忙。

---

## 1. 一句话目标

确认灵犀任务中心的三个一次性任务，**插件能不能靠纯 HTTP 协议自动完成**：

| task_key | 任务名 | 奖励 | 插件当前行为 |
|---|---|---|---|
| `try_group_chat` | 体验一次群聊 | 400 智点 | 找一个已完成会话 → 建群 → 解散 → 重拉任务 → 领取 |
| `try_expert_mode` | 完整体验一次专家模式 | 200 智点 | 带 `session_mode=expert` 跑一次最小对话 → 重拉任务 |
| `use_lingxi_client` | 使用灵犀客户端 | 800 智点 | 带 `client_type=365wps-lingxi-client`（会话 + 请求头）跑一次最小对话 → 重拉任务 |

**判定标准只有一条**：任务状态从 `incomplete` 变成 `claimable`（然后插件会自动 `claim` 成 `claimed`）。
插件不会伪造状态；没翻转就是没翻转。

---

## 2. 目前已经确认的事实（逆向自灵犀桌面端 1.3.31 / app-server 5.15.0）

### 2.1 任务接口（在渲染层，不在 app-server）
```
GET  /api/public/v1/tasks                          # 列表
POST /api/public/v1/tasks/{task_key}/claim         # 领奖（空 body，可选 ?date=YYYY-MM-DD）
```
响应：`{ result:"ok", data:{ tasks:[...], total_claimed_credits } }`
任务对象：`task_key`、`type`（`daily` / `one_time`）、`status`（`incomplete` / `claimable` / `claimed`）、`action`、`reward_amount`。

### 2.2 模型对话走 AI Gateway，需要运行时签名
- 网关：`https://ai-gateway.wps.cn`，路径 `/api/v3/responses`、`/api/v3/chat/completions`
- 关键头：`AI-Gateway-Product-Name`（取值含 `365wps-lingxi-client`、`365wps_lingxi_expert`）、
  `AI-Gateway-Intention-Code`、`AI-Gateway-Billing-Token`、`AI-Gateway-Uid`、`Client-Request-Id`
- 二进制里有 `runtimesign.Sign`（WPS2Signer）与 `V2EncryptGatewayToken`，
  **明文 `wps_sid` 直接请求网关会 403 `Forbidden.AuthorizationFailure`**（已实测）

### 2.3 客户端身份与专家模式
- `lingxi.exe -client-type` 的说明：`Client type used to select the AI Gateway identity (default "lingxi_claw")`
- `normalizeGatewayClientType` 对未知值回落到 `lingxi_claw`
- `365wps-lingxi-client` 与 `365wps_lingxi_expert` 在二进制里是**相邻的静态字符串对**
- 专家模式在网页层是建会话时带 `session_mode:"expert"`；`expert_id` 是 JSON 字段（传 `null` 会被拒）

### 2.4 插件走的通路
```
POST /api/aioffice/v1/cowork/sessions      # 建会话（可带 client_type / session_mode）
POST /api/public/v1/credits/runs           # 领 run（agent_input）
POST /api/public/v1/agent-runtime/chat/completions   # 对话（SSE，X-Cc-Session-ID / X-Cc-Run-ID）
```

---

## 3. 需要你验证的问题（按优先级）

**Q1（最重要）**：账号任务未完成时，直接跑插件的签到，`try_group_chat` 会不会翻转？
**Q2**：`try_expert_mode` 在带 `session_mode=expert` 的对话后会不会翻转？
**Q3**：`use_lingxi_client` 在带 `client_type=365wps-lingxi-client` 的对话后会不会翻转？
**Q4**（如果 Q2/Q3 失败）：抓一次**真实桌面客户端**完成该任务时的请求，看差异在哪（见 §6）。

---

## 4. 复现步骤

### 4.1 安装
```bash
magpie plugin add github:baijiu666/magpie-wps-lingxi
# 如果之前装过上游同名插件，先关掉：
magpie plugin off @magpie-community/opencode-zcode-auth   # 与灵犀无关，示例
```
> 灵犀插件与上游 `@kevinfx/magpie-wps-lingxi` 声明同一个 provider id `wps-lingxi`，不要同时启用。

### 4.2 登录（二选一，都不需要复制 Cookie）
- 面板点「浏览器登录（打开 WPS 登录页）」→ 在浏览器里登录 → 自动完成
- 本机已装灵犀客户端并登录过 → 点「导入本机灵犀客户端账号」→ 直接读本地会话

### 4.3 记录任务基线
```bash
# 只读：打印所有任务状态（不会打印 sid）
node tests/test_tasks.mjs --sid "<你的 wps_sid>"
```
> 也可以不传 `--sid`，用 `WPS_SID` 环境变量。脚本只做「读任务 → 必要时建群/领奖 → 再读任务」。

### 4.4 触发插件逻辑
```bash
magpie accounts checkin
# 或者直接调 usage 看额度是否正常
magpie quota wps-lingxi
```

### 4.5 再记录一次
再跑一次 4.3 的命令，对比状态表。

---

## 5. 回报模板（把这个表填好发回来）

```
账号：uid=__________（不要贴 sid）
灵犀客户端版本：1.3.31 / 其他 ______
是否装过桌面客户端：是 / 否

任务                     动作前        动作后        是否领到
try_group_chat           ______        ______        ______
try_expert_mode          ______        ______        ______
use_lingxi_client        ______        ______        ______
daily_check_in           ______        ______        ______

插件返回的签到 message（原样贴）：______________________
```

如果任务翻转了，请再贴一次 `magpie accounts checkin` 的输出，以及 **领取到的智点数量**。

---

## 6. 如果没翻转：抓真实客户端的请求

只抓这两个域名，别抓整个系统：

1. 打开 Charles / Fiddler / mitmproxy，只对 `lingxi.wps.cn`、`ai-gateway.wps.cn` 开启 SSL 代理
2. 在**灵犀桌面客户端**里完成一次对应任务：
   - 专家模式：进入专家模式发一句「hi」
   - 使用客户端：用桌面客户端正常发一次消息
3. 导出这两次请求的：
   - URL / method
   - 请求头（重点：`X-Client-Type`、`AI-Gateway-Product-Name`、`AI-Gateway-Intention-Code`、`AI-Gateway-Billing-Token`、`Client-Request-Id`）
   - 请求体（重点：`session_mode`、`client_type`、`expert_id`、`agent_input`）
4. **把 Cookie / Authorization 值打码**，只保留字段名和长度

---

## 7. 安全与注意

- **不要提交 `wps_sid`**；脚本不会打印它，截图/日志也请打码
- 测试脚本只读任务 + 领取 `claimable`，不会伪造完成
- 如果账号三个任务都已 `claimed`，这份验证做不了（我们就是这种情况）
- 消耗：一次最小对话约 1 智点；余额为 0 时插件会跳过消耗性动作

---

## 8. 代码位置（方便对照）

| 逻辑 | 文件 / 函数 |
|---|---|
| 任务列表 / 领取 | `index.mjs` → `listTasks()` / `claimTask()` |
| 一次性任务编排 | `index.mjs` → `completeOneTimeTasks()` |
| 任务对话（专家/客户端） | `index.mjs` → `runTaskConversation()` |
| 会话/对话通路 | `index.mjs` → `createCoworkSession()` / `ensureRun()` / `agentChat()` |
| 模型目录与倍率 | `index.mjs` → `fetchModelPlans()` / `rateOf()` / `modelOf()` |
| 额度与临时积分 | `index.mjs` → `usage()` / `summarizeExpiring()` |
| 实测脚本 | `tests/test_tasks.mjs` |
| 单元测试 | `tests/*.test.mjs`（`node --test`，30 条） |
