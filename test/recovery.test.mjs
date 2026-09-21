import test from 'node:test'
import assert from 'node:assert/strict'
import { ForeverWebSocket } from '../src/index.mjs'
import { createReconnectFactory } from '../src/factories/reconnectFactory.mjs'
import { FakeSocket, delay } from './helpers/fakeSocket.mjs'
import { runScenario } from './helpers/runScenario.mjs'

test('a throwing `error` listener does not cancel recovery', async () => {
  let attempts = 0
  const ws = new ForeverWebSocket('ws://x', {
    automaticOpen: false,
    reconnect: { initialDelay: 5, maxDelay: 5 },
    createWebSocket: () => {
      attempts += 1
      if (attempts === 1) {
        throw new Error('createWebSocket boom')
      }
      return new FakeSocket(`socket${attempts}`)
    },
  })

  ws.on('error', () => {
    throw new Error('error listener boom')
  })

  await assert.rejects(ws.connect(), /error listener boom/)
  assert.equal(ws.ws, null, '`this.ws` must be reset even though the error listener threw')

  await delay(60)
  assert.ok(attempts > 1, 'a reconnect must have been scheduled')
})

test('a throwing `delay` listener does not prevent the retry from being scheduled', async () => {
  let connectAttempts = 0
  const manager = createReconnectFactory(
    { initialDelay: 5, maxDelay: 5 },
    () => {
      connectAttempts += 1
    },
    () => {
      throw new Error('delay listener boom')
    }
  )

  assert.throws(() => manager.scheduleNextConnect(), /delay listener boom/)

  await delay(40)
  assert.equal(connectAttempts, 1)
})

test('a throwing `connecting` listener does not cancel the reconnection', () => {
  const output = runScenario('connecting-listener-throws.mjs')
  assert.match(output, /SCENARIO_OK connecting createdCount=\d+/)
})

test('a throwing `timeout` listener does not cancel the self-healing refresh', () => {
  const output = runScenario('timeout-listener-throws.mjs')
  assert.match(output, /SCENARIO_OK timeout closedCount=[1-9]\d*/)
})
