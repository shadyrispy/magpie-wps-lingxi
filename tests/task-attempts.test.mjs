// 专家模式 / 使用客户端：纯协议能做的就是带对标志发一次对话，
// 然后重拉任务看服务端是否翻转。这里锁住“标志确实发出去了”。
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

test('expert and client tasks send the right flags and then re-read the task list', async () => {
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
    if (call.url.endsWith('/api/aioffice/v1/cowork/sessions')) return Response.json({ data: { session_id: 's' + taskReads + Math.random() } })
    if (call.url.endsWith('/api/public/v1/credits/runs')) return Response.json({ data: { run_id: 'r' + Math.random() } })
    if (call.url.endsWith('/api/public/v1/agent-runtime/chat/completions')) {
      return new Response('data: {"code":"Success","choices":[{"text":"ok","finish_reason":"stop"}]}\n\n', {
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
    const sessions = net.calls.filter((c) => c.url.endsWith('/cowork/sessions'))
    assert.equal(sessions.length, 2)
    assert.ok(sessions.some((c) => c.body.client_type === '365wps-lingxi-client'), '客户端任务要带 client_type')
    assert.ok(sessions.some((c) => c.body.session_mode === 'expert'), '专家任务要带 session_mode=expert')

    const runs = net.calls.filter((c) => c.url.endsWith('/api/public/v1/credits/runs'))
    assert.equal(runs.length, 2)
    assert.ok(runs.some((c) => c.body.agent_input.current_mode === 'expert'), '专家任务的 run 要带 current_mode=expert')
    assert.ok(runs.some((c) => c.body.client_type === '365wps-lingxi-client'), '客户端任务的 run 要带 client_type')

    const chats = net.calls.filter((c) => c.url.endsWith('/agent-runtime/chat/completions'))
    assert.equal(chats.length, 2)
    assert.ok(chats.some((c) => c.headers['X-Client-Type'] === '365wps-lingxi-client'), '客户端对话要走客户端身份')

    assert.equal(result.outcome, 'claimed')
    assert.equal(result.credit, 1000)
  } finally {
    net.restore()
  }
})
