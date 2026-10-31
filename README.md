# @kevinfx/magpie-wps-lingxi（独立维护 fork）

<div align="center">

<img src="./icon.png" width="100" height="100" alt="WPS 灵犀 Logo" />

### WPS 灵犀 (Lingxi Claw) Provider Plugin for Magpie & OpenCode

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

</div>

> **来源与维护**：本项目 fork 自 [KevinFX-code/magpie-wps-lingxi](https://github.com/KevinFX-code/magpie-wps-lingxi)，
> 原作者 KevinFX-code，原项目 MIT 许可。因为上游更新较慢、PR/issue 长期无人处理，这里单独维护一版：
> 协议全部按 **WPS 灵犀桌面客户端 1.3.31 安装包** 重新取证，只走桌面端通路，不再使用网页端。
> 上游的设计与早期实现仍然保留在 git 历史里；升级前请先在本仓库提 issue。

一个 magpie / OpenCode 供应商插件：登录 WPS 灵犀，把它的模型接进 Magpie、DeepSeek Harness、
Claude Code、Codex、Cursor 等任何支持 OpenAI 格式的客户端。

**桌面端对齐（灵犀 1.3.31）**：14 个默认模型、1 条对话通路、3 个请求步骤（建会话 → 领 run → chat/completions）。

---

## 🌟 核心特性

- 🖥 **只走桌面客户端通路**  
  与安装包里的 app-server 完全一致：`POST /api/aioffice/v1/cowork/sessions` 建会话 →
  `POST /api/public/v1/credits/runs` 领 run → `POST /api/public/v1/agent-runtime/chat/completions` 对话。
  原生 `messages` / `tools` 进，原生 `tool_calls` / `reasoning_content` / `usage` 出。
- 🧹 **没有网页平面**  
  旧的 `/api/aigc/v3/assistant/...` 通路、`question` 压平、`<|FunctionCallBegin|>` 正文工具桥全部删除；
  不存在“有 tools 走一条、没 tools 走另一条”的分叉。
- 🎁 **每日签到 + 一次性任务 (`auth.checkin`)**  
  读客户端任务中心 `GET /api/public/v1/tasks`，领取 `daily_check_in`；
  已领过返回 `done`，领到返回 `claimed` 并用领前/领后余额差作为奖励。
  一次性任务：上游已判 `claimable` 的直接领；「体验群聊」用官方
  `POST /api/imchat/v1/channels` 建群再解散完成；「专家模式 / 使用客户端」需要
  一次真实客户端对话，纯 HTTP 无法翻转状态，**不会假装修好**（详见下文）。
- 📊 **智点额度 (`auth.usage`)**  
  `GET /api/public/v1/credits/balance`：`total_balance` 为剩余，`bonus_summary.total_value/total_consumed`
  给已用比例；钱包型账号（没有总额）也返回有限 `used`，不会从路由里消失。
- ⏳ **临时积分（快到期的那部分）**  
  赠送批次按 `expire_time` 分档：**15 天内到期**的单独显示成「临时积分」窗口，
  带余额和到期日（判据与 jet 插件一致；`MAGPIE_LINGXI_TEMP_DAYS` 可改天数）。
  优先消耗由服务端决定，这里只负责让你看见“哪部分马上要过期”。
- 🔄 **模型目录 (`provider.models`)**  
  只读客户端自己的 `GET /api/aioffice/v1/sessions/plans`（`plans` + `models`，带倍率与推理档位）；
  未登录时用手指量的快照，不假装实时。
- 🔑 **账号导入 + 多账号**  
  浏览器登录会自己抓会话；也可以直接导入本机灵犀客户端的登录态（Windows，读客户端 Cookie 库）。
  凭据只保留 `wps_sid` 与 `uid`，按 `uid` 区分账号，第二个账号不会覆盖第一个。

---

## 🔌 对话通路（唯一一条）

| 步骤 | 请求 | 说明 |
|---|---|---|
| 1 | `POST /api/aioffice/v1/cowork/sessions` | `{session_type:"cowork_client", agent_version:2, env:{device_id,device_name,...}}`，返回 `session_id` |
| 2 | `POST /api/public/v1/credits/runs` | `{client_request_id, session_id, model_provider:"lingxi", model_id, agent_input:{...}}`，返回 `run_id` |
| 3 | `POST /api/public/v1/agent-runtime/chat/completions` | 头带 `X-Cc-Session-ID` / `X-Cc-Run-ID`，SSE 返回 |

- 计费按 run：一个 run 内多次调用只扣一次智点，所以 session/run 按「账号 × 模型」缓存 1 小时；
  上游报 `SQLNoRows` / 会话不存在时自动重建一次。
- 响应帧：`data:{"code":"Success","usage":{…},"choices":[{"text","reasoning_content","tool_calls","finish_reason"}]}`，
  没有 `[DONE]`，靠 `finish_reason` 收尾；`code != Success` 直接作为上游错误返回。
- 请求头（与客户端一致）：`X-Client-Type: lingxi_claw`、`X-Client-Lang: zh-CN`、
  `X-Cc-Agent-Type: lingxi_claw`，Cookie 带 `copilot_server_branch` 时再加 `X-Cc-Region`。

---

## ✅ 与桌面客户端对齐清单（1.3.31）

| 项 | 状态 | 说明 |
|---|---|---|
| 对话端点 | ✅ | 只有 `agent-runtime/chat/completions`；网页通路已删 |
| 会话 / run | ✅ | cowork 会话 + credits/runs，`session_type:"cowork_client"`、`agent_version:2` |
| 请求头 | ✅ | `X-Client-Type`、`X-Client-Lang`、`X-Cc-Agent-Type`、`X-Cc-Session-ID`、`X-Cc-Run-ID`、`X-Request-Id`；有 `copilot_server_branch` 时带 `X-Cc-Region` |
| 模型目录 | ✅ | 登录后取 `sessions/plans` 的 `plans`+`models`；未登录用快照 |
| 思考档位 | ✅ | 每个模型按目录里的 `reasoning_efforts` 生成 `variants`（对象），宿主选档后原样作为 `reasoning_effort` 发上游 |
| 工具调用 | ✅ | 原生 `tools` / `tool_calls`，不再从正文反解 |
| 流式帧 | ✅ | `choices[].text` / `reasoning_content` / `tool_calls` / `finish_reason`，`code != Success` 即报错 |
| 用量 | ✅ | `usage` 原样带回；`cached_tokens` / `reasoning_tokens` 归一成 OpenAI 形状 |
| 会话缓存 | ✅ | session/run 按「账号 × 模型」缓存 1 小时；上游报会话不存在时重建一次 |
| 额度 | ✅ | `credits/balance`：`total_balance` + `bonus_summary` 算已用；钱包型也给有限 `used` |
| 签到 | ✅ | `tasks` + `tasks/{key}/claim`；已领返回 `done` |
| 多账号 | ✅ | 按 `uid` 区分（无 uid 用 sid 尾部），不互相覆盖 |
| 错误语义 | ✅ | 模型/参数错误 → 404；明确鉴权失败 → 401 |
| 一次性任务·群聊 | ✅ | 网页端同款流程：`cowork_web` 会话 + WS `user.input` → 建群 → 解散（issue #5 的 400 根因已修：空会话缺真实使用信号） |
| 一次性任务·专家/客户端 | ✅ 已验证 | v0.3.15 的 `execution_status` 生命周期（running → 对话 → completed，真实内核抓包复刻）是真根因修复；未领账号实测两任务同时翻转并自动领取（issue #5） |
| 脚手架 | ✅ | `check.mjs` 30 通过 / 0 警告 / 0 失败；`score.mjs` 身份门通过、自动分 65/65 |

> `try_expert_mode` / `use_lingxi_client` 目前是「纯协议尝试」：带标志发一次最小对话后重拉任务，
> 是否翻转由服务端判定。验证方法见 [`docs/ONE-TIME-TASKS.md`](./docs/ONE-TIME-TASKS.md)
> （需要账号上这两个任务**还没领过**）。

### 怎么验一次性任务

```bash
# 只读：看任务状态（group_chat 是否 incomplete/claimable/claimed）
node tests/test_tasks.mjs --sid "你的 wps_sid"
```

脚本会：列出任务 → 尝试建群（若群聊未完成）→ 重拉任务 → 领取所有 `claimable`，
并打印每一步前后的 `status`。**专家/客户端任务只会显示 `incomplete`，脚本不会伪造完成。**

---

## 📦 安装

```bash
# 从本仓库源码安装
magpie plugin add github:baijiu666/magpie-wps-lingxi

# 或在本地开发目录
magpie plugin add /path/to/magpie-wps-lingxi
```

也可以写进 `~/.config/magpie/plugins.json`：

```json
{
  "plugins": [{ "spec": "github:baijiu666/magpie-wps-lingxi" }]
}
```

> 安装前先关掉上游同名插件：两者声明同一个 provider id `wps-lingxi`，同时启用会互相覆盖。

---

## 🚀 登录与使用

```bash
magpie plugin login wps-lingxi
```

或在 Magpie 桌面客户端的 Provider 面板点 **Login**：

1. **浏览器登录（默认）**：插件直接打开 WPS 登录页（`https://lingxi.wps.cn/`），你在浏览器里正常登录，
   登录成功后插件自己读取会话并保存账号 —— **不弹本地页面、不复制 Cookie、不需要任何粘贴**。
   支持任意 Chromium 内核浏览器：Chrome / Edge / Brave / Vivaldi / 360极速 / 360安全 / QQ / 搜狗；
   找不到时可用 `MAGPIE_LINGXI_BROWSER` 指定浏览器 exe（360 安全浏览器可能不支持调试端口，建议 360极速）。
2. **导入本机灵犀客户端账号**：已经在灵犀客户端登录过时，点这一项直接读客户端本地会话，
   不打开浏览器、不用重新登录、也不用填任何路径（自动扫描客户端数据目录；Windows
   用 DPAPI + AES-GCM 解密客户端 Cookie 库，macOS 的客户端 Cookie 本身就是明文存储、
   直接读取即可 —— 1.3.27 / 1.3.31 实测，需 Node 22+）。

多账号：凭据按 `uid` 区分（没有 `uid` 时按 `wps_sid` 尾部），界面显示尾号 4 位。

查看额度与签到：

```bash
magpie quota wps-lingxi
magpie accounts checkin
```

接进其他客户端：

- **Base URL**: `http://127.0.0.1:3425/v1`
- **Model**: 例如 `wps-lingxi/deepseek-v4.1-flash`

---

## 📋 模型列表（客户端目录快照）

登录后由 `/api/aioffice/v1/sessions/plans` 实时替换；下表是未登录时的快照。
模型名与倍率分开：`name` 只有模型名，倍率走 magpie 的 `rate` 字段（数字），由面板渲染成倍率胶囊。

| 模型标识 | 名称 | 上下文 | 倍率 | 深度思考 |
| :--- | :--- | :--- | :--- | :---: |
| `deepseek-v4.1-flash` | DeepSeek V4.1 Flash | 1M | ~0.12x | ✅ |
| `deepseek-v4-flash-0731` | DeepSeek V4 Flash | 1M | 0.09x | ✅ |
| `deepseek-v4-pro-0813` | DeepSeek V4 Pro | 1M | 0.40x | ✅ |
| `kimi-k3` | Kimi-K3 | 1M | 1.60x | ✅ |
| `GLM-5.3` | GLM-5.3 | 1M | ~0.75x | ✅ |
| `GLM-5.3-Flash` | GLM-5.3-Flash | 1M | ~0.11x | ✅ |
| `qwen3.8_max` | Qwen3.8-Max | 1M | ~0.80x | ✅ |
| `qwen3.8_flash` | Qwen3.8-Flash | 1M | ~0.08x | ✅ |
| `minimax_m3` | MiniMax-M3 | 1M | 0.20x | ❌ |
| `doubao_seed_2_1_pro_260628` | Doubao-Seed-2.1 Pro | 256K | ~0.50x | ✅ |
| `mimo-v2.6-pro` | Xiaomi MiMo-V2.6 Pro | 1M | 0.10x | ❌ |
| `plan_pro` | Pro 模式（深度推理） | 1M | 模式自适应 | ✅ |
| `plan_max` | Max 模式（复杂任务） | 1M | 模式自适应 | ✅ |
| `auto` | 自动调度 | 1M | 1.0x | ✅ |

---

## 🔧 环境变量（都有默认值）

| 变量 | 作用 |
|---|---|
| `MAGPIE_LINGXI_BROWSER` | 登录用浏览器 exe（找不到浏览器时指定） |
| `MAGPIE_LINGXI_HOME` | 灵犀客户端数据目录（导入账号自动扫描失败时指定） |
| `MAGPIE_LINGXI_TEMP_DAYS` | 临时积分窗口天数（默认 15，与 jet 插件一致） |
| `MAGPIE_LINGXI_NO_KSO` | 置 `1` 关闭客户端 Cookie 标识注入 |

测试与验证：见 [`docs/TESTER-GUIDE.md`](./docs/TESTER-GUIDE.md)（安装 → 三级自测 → 回报模板）。

---

## 🧭 参考源（本版取证）

- 安装包：WPS 灵犀桌面端 **1.3.31**（`lingxi-desktop-1.3.31-setup.exe`）
  - `resources/app.asar` → `desktop-renderer-dist/assets/webapi-*.js`（Web 侧任务/额度/目录字段）
  - `resources/app-server/app-server/service/lingxi.exe`（桌面端同款 Agent Runtime 端点与请求头；
    app-server 版本 5.14.0，commit `a5a37290`）
- 上游实现与讨论：[KevinFX-code/magpie-wps-lingxi](https://github.com/KevinFX-code/magpie-wps-lingxi)
  （PR #3 agent-runtime 平面、#4 variants 对象、#5 一次性任务、#6 Cookie 归一）
- 插件规范：[magpie-plugin-scaffold](https://github.com/MYCF711/magpie-plugin-scaffold)、
  [usemagpie.ai 插件文档](https://usemagpie.ai/docs/zh/plugins)

> 原生通路是客户端私有网关，不是公开接口；上游改字段时插件会明确报错，不会静默降级。

## 🛠 测试

```bash
node --test          # 单元测试（网络全部打桩）
npm run check        # 脚手架规则检查
npm run score        # 评分
node tests/test_lingxi.mjs "你的wps_sid"   # 脱离 Magpie 的联调
```

---

## 📄 许可证与署名

MIT。原项目：[KevinFX-code/magpie-wps-lingxi](https://github.com/KevinFX-code/magpie-wps-lingxi)，
原作者 KevinFX-code 及 PR 贡献者（isdoge、shadyrispy、kvoon3、baijiu666）。见 [LICENSE](./LICENSE)。
