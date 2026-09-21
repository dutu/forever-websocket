import test from 'node:test'
import assert from 'node:assert/strict'
import { ForeverWebSocket } from '../src/index.mjs'
import { FakeSocket, delay } from './helpers/fakeSocket.mjs'

test('connect() called again while CONNECTING keeps the pending socket', async () => {
  let createdCount = 0
  const sockets = []
  const ws = new ForeverWebSocket('ws://x', {
    automaticOpen: false,
    reconnect: null,
    createWebSocket: () => {
      createdCount += 1
      const socket = new FakeSocket(`socket${createdCount}`)
      sockets.push(socket)
      return socket
    },
  })

  await ws.connect()
  assert.equal(createdCount, 1)

  await ws.connect()

  assert.equal(createdCount, 1, 'the pending socket must not be torn down and recreated')
  assert.equal(sockets[0].terminatedCount, 0)
  assert.equal(sockets[0].closedCount, 0)
})

test('retryNumber increases across attempts and `reconnected` is emitted', async () => {
  const retryNumbers = []
  const sockets = []
  const ws = new ForeverWebSocket('ws://x', {
    reconnect: { initialDelay: 5, maxDelay: 5 },
    createWebSocket: () => {
      const socket = new FakeSocket(`socket${sockets.length + 1}`)
      sockets.push(socket)
      return socket
    },
  })
  ws.on('connecting', (retryNumber) => retryNumbers.push(retryNumber))
  let reconnectedArgs
  ws.on('reconnected', (retryNumber, lastConnectedMts) => {
    reconnectedArgs = { retryNumber, lastConnectedMts }
  })

  await delay(10)
  sockets[0].simulateOpen() // first connection: no `reconnected` yet
  sockets[0].simulateClose()
  await delay(30)
  sockets.at(-1).simulateOpen() // reconnect succeeds
  await delay(10)

  assert.deepEqual(retryNumbers, [1])
  assert.ok(reconnectedArgs, '`reconnected` must be emitted after a successful reconnect')
  assert.equal(reconnectedArgs.retryNumber, 1)
  assert.ok(reconnectedArgs.lastConnectedMts)
})

test('a superseded socket closing late does not schedule an extra reconnect', async () => {
  let createdCount = 0
  const sockets = []
  const ws = new ForeverWebSocket('ws://x', {
    automaticOpen: false,
    reconnect: { initialDelay: 30, maxDelay: 30 },
    createWebSocket: () => {
      createdCount += 1
      const socket = new FakeSocket(`socket${createdCount}`)
      sockets.push(socket)
      return socket
    },
  })

  await ws.connect()
  sockets[0].simulateOpen()

  // Replace the pending/closed socket by forcing a new connection
  sockets[0].readyState = FakeSocket.CLOSED
  await ws.connect()
  assert.equal(createdCount, 2)

  // The old socket emits its `close` late; it must be ignored
  sockets[0].simulateClose()
  await delay(60)

  assert.equal(createdCount, 2, 'the late close of the superseded socket must not trigger a retry')
})
