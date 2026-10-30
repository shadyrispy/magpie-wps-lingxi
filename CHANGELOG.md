# Changelog

## 0.3.7 — 2026-10-31

- 审计修复：
  - `findBrowser()` 不再每次调用都跑最多 60 次 `reg query`：常见路径优先，全 miss 才查注册表。
  - 一次性任务重拉后只领取 `type=one_time`，不再可能重复领每日签到。
  - Cookie 归一保留 `copilot_server_branch`，`X-Cc-Region`（灰度路由）不再永远为空。
  - `usage.until` 过滤已过期批次；修复 `nowMs` 的 TDZ（额度查询会直接报错）。
- 新增测试：浏览器发现、任务标志、积分边界（共 30 条，`node --test` 全绿）。
- 新增 `docs/ONE-TIME-TASKS.md`：交给有未完成任务账号的同学验证「专家/群聊/客户端」三个任务。

## 0.3.6 — 2026-10-31

- 「导入本机灵犀客户端账号」从 api 类型改成 oauth（`opened: true`）：
  api 方法在 magpie 里天然带一个 key 输入框（就是那个 `enter the key`），
  改成 oauth 后点一下直接读客户端登录态，不再出现任何输入框。
- 自动检测客户端目录（WPS 灵犀 / Lingxi / lingxi / lingxi-desktop），
  失败才提示 `MAGPIE_LINGXI_HOME`。

## 0.3.5 — 2026-10-31

- 浏览器发现按 magicrew 插件的实测列表重写（修 issue #1）：补上 360 极速浏览器 X
  （`360ChromeX.exe`）、360 安全浏览器（真实文件名是 `360se.exe`）、QQ/搜狗/Brave/
  Vivaldi/Opera/2345/猎豹/傲游/UC/夸克，以及 Edge 的两种落盘名；路径优先、注册表兜底。
- 一次性任务「专家模式 / 使用客户端」改为纯协议尝试：分别带
  `session_mode=expert` 与 `client_type=365wps-lingxi-client`（含请求头）各跑一次
  最小对话，然后重拉任务；**是否完成由服务端判定**，插件只如实回报状态，不伪造。
- 新增测试锁住这两条标志确实发出去了。

## 0.3.4 — 2026-10-31

- 模型面板对齐 magpie 的字段约定：`name` 只放模型名，倍率改用数字 `rate`
  （不再拼成 `DeepSeek V4.1 Flash [～0.12x]` 这种脏名字；倍率胶囊由宿主渲染）。
- 修复上游倍率使用全角波浪号 `～0.12x` 导致解析失败、部分模型没有倍率的问题。
- 透传 `max_new_tokens` 作为模型的输出上限（Kimi 1M、MiniMax 524K 等按上游给的值）。
- 额度面板新增「临时积分」窗口：15 天内到期的赠送批次单独列出，
  显示余额与到期日（判据与 jet 插件一致；`MAGPIE_LINGXI_TEMP_DAYS` 可调整天数）。

## 0.3.3 — 2026-10-31

- 「导入本机灵犀客户端账号」不再让用户填目录：点一下自动扫描
  `%APPDATA%\WPS 灵犀`、`Lingxi`、`lingxi`、`lingxi-desktop` 等候选目录，找到已登录的
  Cookie 库就直接导入；确实找不到时才提示可用 `MAGPIE_LINGXI_HOME` 指定。
- 修复注册表查询的转义错误（`\${tail}` 不插值），360/QQ/搜狗等浏览器现在能被发现；
  `reg` 的“找不到项”不再刷屏。

## 0.3.2 — 2026-10-31

- 登录重做：去掉本地 HTML 授权向导与 Cookie 粘贴框，点登录直接打开 WPS 登录页，
  登录成功后用 CDP 自行读取会话，用户不需要复制任何东西。
- 浏览器发现扩展：除 Chrome/Edge 外支持 Brave / Vivaldi / Chromium / 360极速 / 360安全 /
  QQ / 搜狗，并支持 `MAGPIE_LINGXI_BROWSER` 指定路径（修 issue #1：360 下找不到浏览器）。
- 新增「导入本机灵犀客户端账号」：读客户端 `Partitions/*/Network/Cookies`，
  DPAPI 解 key、AES-GCM 解值，并处理 Chromium 明文前的 32 字节 host 哈希。
- 账号仍按 `uid` 区分，导入/浏览器登录两条路都走同一套归一化。

## 0.3.1 — 2026-10-30

- 思考档位按模型下发：`variants` 从目录里的 `reasoning_efforts` 生成，不再所有模型都
  固定成 `low/high/max`；宿主选档后原样作为 `reasoning_effort` 发给 agent-runtime。
- 用量归一：`usage` 不再因 `total_tokens=0` 被丢弃；`cached_tokens` /
  `reasoning_tokens` 转成 `prompt_tokens_details` / `completion_tokens_details`。
- 每个请求带 `X-Request-Id`；建会话的 `env` 用真实设备名、临时工作目录和稳定
  device_id，不再写死 `Magpie` / `/tmp`。
- 修复：`pickGroupChatSession` 在删 app-server 时被误删，导致「体验群聊」任务在运行期
  抛 ReferenceError；已恢复并补了端到端测试（建群 → 解散 → 重拉 → 领取）。
- 修复：会话/run 的域名回落丢了 kdocs，恢复为 `lingxi.wps.cn` → `lingxi.kdocs.cn`。
- 新增 `tests/test_tasks.mjs`：只读 + 领取的任务实测脚本，打印每一步前后的 status；
  专家模式 / 使用客户端只上报 `incomplete`，不伪造完成。

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
