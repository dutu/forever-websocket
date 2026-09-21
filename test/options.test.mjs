import test from 'node:test'
import assert from 'node:assert/strict'
import { ForeverWebSocket } from '../src/index.mjs'
import { createPingFactory } from '../src/factories/pingFactory.mjs'
import { FakeSocket, delay } from './helpers/fakeSocket.mjs'

test('updateOptions({ timeout }) enables the timeout on an instance which had none', async () => {
  let socket
  const ws = new ForeverWebSocket('ws://x', {
    automaticOpen: false,
    reconnect: null,
    createWebSocket: () => (socket = new FakeSocket()),
  })
  let timeouts = 0
  ws.on('timeout', () => {
    timeouts += 1
  })

  assert.doesNotThrow(() => ws.updateOptions({ timeout: 30 }))

  await ws.connect()
  socket.simulateOpen()
  await delay(80)

  assert.ok(timeouts > 0)
})

test('updateOptions({ timeout }) changes an already running timeout', async () => {
  let socket
  const ws = new ForeverWebSocket('ws://x', {
    automaticOpen: false,
    reconnect: null,
    timeout: 5000,
    createWebSocket: () => (socket = new FakeSocket()),
  })
  let timeouts = 0
  ws.on('timeout', () => {
    timeouts += 1
  })

  await ws.connect()
  socket.simulateOpen()
  ws.updateOptions({ timeout: 30 })
  await delay(100)

  assert.ok(timeouts > 0, 'the shortened timeout must take effect')
})

test('updateOptions({ ping }) enables pings on an instance which had none', async () => {
  let socket
  const ws = new ForeverWebSocket('ws://x', {
    automaticOpen: false,
    reconnect: null,
    createWebSocket: () => (socket = new FakeSocket()),
  })

  assert.doesNotThrow(() => ws.updateOptions({ ping: { interval: 10, data: 'D' } }))

  await ws.connect()
  socket.simulateOpen()
  await delay(60)

  assert.ok(socket.sentMessages.length > 0)
})

test('updateOptions({ reconnect }) enables reconnection on an instance constructed with reconnect: null', async () => {
  let createdCount = 0
  const sockets = []
  const ws = new ForeverWebSocket('ws://x', {
    reconnect: null,
    createWebSocket: () => {
      createdCount += 1
      const socket = new FakeSocket(`socket${createdCount}`)
      sockets.push(socket)
      return socket
    },
  })

  assert.equal(createdCount, 1)
  await delay(10)
  ws.updateOptions({ reconnect: { initialDelay: 5, maxDelay: 5 } })
  sockets[0].simulateOpen()
  sockets[0].simulateClose()
  await delay(60)

  assert.ok(createdCount > 1, 'reconnection must have been enabled')
})

test('updateOptions({ ping: null }) disables pings at runtime', async () => {
  let socket
  const ws = new ForeverWebSocket('ws://x', {
    automaticOpen: false,
    reconnect: null,
    ping: { interval: 10, data: 'D' },
    createWebSocket: () => (socket = new FakeSocket()),
  })

  await ws.connect()
  socket.simulateOpen()
  await delay(40)
  const sentBeforeDisable = socket.sentMessages.length
  assert.ok(sentBeforeDisable > 0)

  assert.doesNotThrow(() => ws.updateOptions({ ping: null }))
  await delay(40)

  assert.equal(socket.sentMessages.length, sentBeforeDisable, 'no pings after disabling')
})

test('updateOptions({ reconnect: null }) disables reconnection at runtime', async () => {
  let createdCount = 0
  const sockets = []
  const ws = new ForeverWebSocket('ws://x', {
    createWebSocket: () => {
      createdCount += 1
      const socket = new FakeSocket(`socket${createdCount}`)
      sockets.push(socket)
      return socket
    },
  })

  await delay(10)
  ws.updateOptions({ reconnect: null })
  sockets[0].simulateOpen()
  sockets[0].simulateClose()
  await delay(60)

  assert.equal(createdCount, 1, 'no reconnect after disabling reconnection')
})

test('updateOptions({ timeout: null }) disables the timeout at runtime', async () => {
  let socket
  const ws = new ForeverWebSocket('ws://x', {
    automaticOpen: false,
    reconnect: null,
    timeout: 20,
    createWebSocket: () => (socket = new FakeSocket()),
  })
  let timeouts = 0
  ws.on('timeout', () => {
    timeouts += 1
  })

  await ws.connect()
  socket.simulateOpen()
  assert.doesNotThrow(() => ws.updateOptions({ timeout: null }))
  await delay(60)

  assert.equal(timeouts, 0, 'the timeout must be disabled, not turned into an immediate one')
})

test('updateOptions({ ping }) starts pings on an already open connection', async () => {
  let socket
  const ws = new ForeverWebSocket('ws://x', {
    automaticOpen: false,
    reconnect: null,
    createWebSocket: () => (socket = new FakeSocket()),
  })

  await ws.connect()
  socket.simulateOpen()
  ws.updateOptions({ ping: { interval: 10, data: 'D' } })
  await delay(60)

  assert.ok(socket.sentMessages.length > 0)
})

test('updateOptions({ timeout }) arms the timeout on an already open connection', async () => {
  let socket
  const ws = new ForeverWebSocket('ws://x', {
    automaticOpen: false,
    reconnect: null,
    createWebSocket: () => (socket = new FakeSocket()),
  })
  let timeouts = 0
  ws.on('timeout', () => {
    timeouts += 1
  })

  await ws.connect()
  socket.simulateOpen()
  ws.updateOptions({ timeout: 30 })
  await delay(80)

  assert.ok(timeouts > 0)
})

test('updateOptions({ timeout }) applied while disconnected does not fire before the connection is open', async () => {
  let socket
  const ws = new ForeverWebSocket('ws://x', {
    automaticOpen: false,
    reconnect: null,
    createWebSocket: () => (socket = new FakeSocket()),
  })
  let timeouts = 0
  ws.on('timeout', () => {
    timeouts += 1
  })

  ws.updateOptions({ timeout: 20 })
  await delay(60)
  assert.equal(timeouts, 0, 'the timeout must not be armed before the connection is open')

  await ws.connect()
  socket.simulateOpen()
  await delay(60)
  assert.ok(timeouts > 0)
})

test('pingFactory.update() does not start a stopped manager', async () => {
  let pings = 0
  const factory = createPingFactory({ interval: 10 }, () => {
    pings += 1
  })

  factory.update({ interval: 10 })
  await delay(30)
  assert.equal(pings, 0, 'update() must not start a stopped manager')

  factory.start()
  await delay(30)
  factory.stop()
  assert.ok(pings > 0)
})
