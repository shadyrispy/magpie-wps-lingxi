// 专家模式（aigc 平面）/ 使用客户端（cowork + client_type）：
// 纯协议能做的就是带对标志发一次对话，然后重拉任务看服务端是否翻转。
// 这里锁住“标志确实发出去了”与“Cookie 带 x-kso-* 客户端标识”。
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { WPSLingxiAuthPlugin } from '../index.mjs'

const SID = 'SID' + 'a'.repeat(29)
const COOKIE = `wps_sid=${SID}`

function installFetch(handler) {
  const calls = []
  const original = globalThis.fetch
  globalThis.fetch = async (url, init = {}) => {
    let body
    try { body = typeof init.body === 'string' ? JSON.parse(init.body) : undefined } catch {}
    const call = { url: String(url), method: init.method || 'GET', headers: init.headers || {}, body }
    calls.push(call)
    return handler(call)
  }
  return { calls, restore() { globalThis.fetch = original } }
}

test('expert (aigc) and client (cowork) attempts send the right flags; cookies carry x-kso-*', async () => {
  const plugin = await WPSLingxiAuthPlugin()
  let taskReads = 0
  const net = installFetch((call) => {
    if (call.url.endsWith('/api/public/v1/tasks')) {
      taskReads += 1
      const done = taskReads > 1
      return Response.json({
        result: 'ok',
        data: {
          tasks: [
            { task_key: 'daily_check_in', type: 'daily', status: 'claimed', reward_amount: 100, extra: { consecutive_days: 1 } },
            { task_key: 'try_expert_mode', type: 'one_time', status: done ? 'claimable' : 'incomplete', action: 'expert_mode', reward_amount: 200 },
            { task_key: 'use_lingxi_client', type: 'one_time', status: done ? 'claimable' : 'incomplete', action: 'download_client', reward_amount: 800 },
          ],
        },
      })
    }
    if (call.url.includes('/api/public/v1/credits/balance')) return Response.json({ data: { total_balance: 500 } })
    if (call.url.endsWith('/api/aioffice/v1/cowork/sessions')) return Response.json({ data: { session_id: 's1' } })
    if (call.url.endsWith('/api/public/v1/credits/runs')) return Response.json({ data: { run_id: 'r1' } })
    if (call.url.endsWith('/api/public/v1/agent-runtime/chat/completions')) {
      return new Response('data: {"code":"Success","choices":[{"text":"ok","finish_reason":"stop"}]}\n\n', {
        headers: { 'content-type': 'text/event-stream' },
      })
    }
    if (call.url.endsWith('/api/aigc/v3/assistant/sessions')) {
      return Response.json({ data: { session_id: 'aigc-1' } })
    }
    if (call.url.includes('/api/aigc/v3/assistant/sessions/') && call.url.endsWith('/completions')) {
      return new Response('data: {"type":"text","data":"hi"}\n\ndata: {"type":"end"}\n\n', {
        headers: { 'content-type': 'text/event-stream' },
      })
    }
    if (call.url.includes('/claim')) {
      const key = call.url.includes('try_expert_mode') ? 'try_expert_mode' : 'use_lingxi_client'
      const reward = key === 'try_expert_mode' ? 200 : 800
      return Response.json({ result: 'ok', data: { reward_amount: reward } })
    }
    return new Response('not found', { status: 404 })
  })
  try {
    const result = await plugin.auth.checkin(async () => ({ cookie: COOKIE }))

    // 专家任务：aigc 平面，session_mode=expert + with_expert=true
    const aigcSessions = net.calls.filter((c) => c.url.endsWith('/api/aigc/v3/assistant/sessions'))
    assert.equal(aigcSessions.length, 1)
    assert.equal(aigcSessions[0].body.session_mode, 'expert')
    const aigcChats = net.calls.filter((c) => c.url.includes('/api/aigc/v3/assistant/sessions/') && c.url.endsWith('/completions'))
    assert.equal(aigcChats.length, 1)
    assert.equal(aigcChats[0].body.with_expert, true)
    assert.equal(aigcChats[0].body.expect_model, 'plan_pro')

    // 客户端任务：cowork 平面，client_type 用白名单值 lingxi_claw（服务端自己映射成
    // Product-Name=365wps-lingxi-client；直接发 Product-Name 会被风控拒）
    const sessions = net.calls.filter((c) => c.url.endsWith('/api/aioffice/v1/cowork/sessions'))
    assert.equal(sessions.length, 1)
    assert.equal(sessions[0].body.client_type, 'lingxi_claw')
    const runs = net.calls.filter((c) => c.url.endsWith('/api/public/v1/credits/runs'))
    assert.equal(runs.length, 1)
    assert.equal(runs[0].body.client_type, 'lingxi_claw')
    const chats = net.calls.filter((c) => c.url.endsWith('/api/public/v1/agent-runtime/chat/completions'))
    assert.equal(chats.length, 1)
    assert.equal(chats[0].headers['X-Client-Type'], 'lingxi_claw')
    assert.ok(!JSON.stringify(net.calls.map((c) => c.body)).includes('365wps-lingxi-client'), 'Product-Name 不该出现在请求体里')

    // 所有请求的 Cookie 都带客户端标识
    for (const c of net.calls) {
      const cookie = c.headers.Cookie || ''
      assert.ok(cookie.includes('x-kso-app-name=win-lingxi-desktop'), `missing x-kso cookie: ${c.url}`)
    }

    assert.equal(result.outcome, 'claimed')
    assert.equal(result.credit, 1000)
  } finally {
    net.restore()
  }
})
