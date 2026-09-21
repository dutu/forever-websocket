import test from 'node:test'
import assert from 'node:assert/strict'
import { ForeverWebSocket } from '../src/index.mjs'
import { FakeSocket, delay } from './helpers/fakeSocket.mjs'

test('replicated accessors return defaults while there is no socket', () => {
  const ws = new ForeverWebSocket('ws://x', { automaticOpen: false, reconnect: null })

  assert.equal(ws.url, 'ws://x')
  assert.equal(ws.protocol, '')
  assert.equal(ws.bufferedAmount, 0)
  assert.equal(ws.extensions, '')
  assert.equal(ws.binaryType, 'blob')
  assert.equal(ws.readyState, undefined)
})

test('binaryType set before connecting is remembered and applied to the WebSocket', async () => {
  let socket
  const ws = new ForeverWebSocket('ws://x', {
    automaticOpen: false,
    reconnect: null,
    createWebSocket: () => (socket = new FakeSocket()),
  })

  assert.doesNotThrow(() => {
    ws.binaryType = 'arraybuffer'
  })
  assert.equal(ws.binaryType, 'arraybuffer')

  await ws.connect()

  assert.equal(socket.binaryType, 'arraybuffer')
})

test('accessors do not throw while the socket is being recreated', async () => {
  const sockets = []
  const ws = new ForeverWebSocket('ws://x', {
    reconnect: { initialDelay: 5, maxDelay: 5 },
    createWebSocket: async () => {
      await delay(30)
      const socket = new FakeSocket(`socket${sockets.length + 1}`)
      sockets.push(socket)
      return socket
    },
  })

  await delay(60)
  sockets[0].simulateOpen()
  sockets[0].simulateClose()
  await delay(20) // inside the async createWebSocket window: `this.ws` is null

  assert.equal(ws.ws, null)
  assert.doesNotThrow(() => ws.url)
  assert.equal(ws.url, 'ws://x')
})

test('terminate() stops reconnection and the connection managers', async () => {
  let createdCount = 0
  const sockets = []
  const ws = new ForeverWebSocket('ws://x', {
    reconnect: { initialDelay: 5, maxDelay: 5 },
    createWebSocket: () => {
      createdCount += 1
      const socket = new FakeSocket(`socket${createdCount}`)
      sockets.push(socket)
      return socket
    },
  })

  await delay(10)
  sockets[0].simulateOpen()
  ws.terminate()
  await delay(60)

  assert.ok(sockets[0].terminatedCount > 0)
  assert.equal(createdCount, 1, 'no reconnect after terminate()')
})
