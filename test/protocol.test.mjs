import test from 'node:test'
import assert from 'node:assert/strict'
import { ForeverWebSocket } from '../src/index.mjs'
import { FakeSocket, delay } from './helpers/fakeSocket.mjs'

function createInstance(options) {
  let socket
  const ws = new ForeverWebSocket('ws://x', {
    automaticOpen: false,
    reconnect: null,
    createWebSocket: () => (socket = new FakeSocket()),
    ...options,
  })
  return { ws, socket: () => socket }
}

test('ping.pingFrame sends a WebSocket ping frame', async () => {
  const { ws, socket } = createInstance({ ping: { interval: 10, data: 'D', pingFrame: true } })
  await ws.connect()
  socket().simulateOpen()
  await delay(50)

  assert.ok(socket().pingCount > 0)
  assert.equal(socket().sentMessages.length, 0)
})

test('ping.frame is still accepted as an alias', async () => {
  const { ws, socket } = createInstance({ ping: { interval: 10, data: 'D', frame: true } })
  await ws.connect()
  socket().simulateOpen()
  await delay(50)

  assert.ok(socket().pingCount > 0)
})

test('inbound ping frames reset the inactivity timeout', async () => {
  const { ws, socket } = createInstance({ timeout: 40 })
  let timeouts = 0
  ws.on('timeout', () => {
    timeouts += 1
  })

  await ws.connect()
  socket().simulateOpen()
  const intervalId = setInterval(() => socket().simulatePing(Buffer.from('heartbeat')), 10)
  await delay(150)
  clearInterval(intervalId)

  assert.equal(timeouts, 0)
})

test('inbound pong frames reset the inactivity timeout', async () => {
  const { ws, socket } = createInstance({ timeout: 40 })
  let timeouts = 0
  ws.on('timeout', () => {
    timeouts += 1
  })

  await ws.connect()
  socket().simulateOpen()
  const intervalId = setInterval(() => socket().simulatePong(Buffer.from('heartbeat')), 10)
  await delay(150)
  clearInterval(intervalId)

  assert.equal(timeouts, 0)
})

test('the inactivity timeout still fires when nothing is received', async () => {
  const { ws, socket } = createInstance({ timeout: 30 })
  let timeouts = 0
  ws.on('timeout', () => {
    timeouts += 1
  })

  await ws.connect()
  socket().simulateOpen()
  await delay(90)

  assert.ok(timeouts > 0)
})
