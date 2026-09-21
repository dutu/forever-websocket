import test from 'node:test'
import assert from 'node:assert/strict'
import { ForeverWebSocket } from '../src/index.mjs'
import { FakeSocket, delay } from './helpers/fakeSocket.mjs'

function createInstance(options = {}) {
  let socket
  const ws = new ForeverWebSocket('ws://x', {
    automaticOpen: false,
    reconnect: null,
    createWebSocket: () => (socket = new FakeSocket()),
    ...options,
  })
  return { ws, socket: () => socket }
}

function createReconnectingInstance() {
  const sockets = []
  const ws = new ForeverWebSocket('ws://x', {
    reconnect: { initialDelay: 5, maxDelay: 5 },
    createWebSocket: () => {
      const socket = new FakeSocket(`socket${sockets.length + 1}`)
      sockets.push(socket)
      return socket
    },
  })
  return { ws, sockets }
}

test('addListener registers the listener on the underlying WebSocket', async () => {
  const { ws, socket } = createInstance()
  let fired = 0

  const returned = ws.addListener('message', () => {
    fired += 1
  })

  assert.equal(returned, ws, 'addListener must return the instance')

  await ws.connect()
  socket().simulateOpen()
  socket().simulateMessage('hello')

  assert.equal(fired, 1, 'a listener added with addListener must receive socket messages')
})

test('removeListener stops delivery on the live WebSocket', async () => {
  const { ws, socket } = createInstance()
  let fired = 0
  const listener = () => {
    fired += 1
  }

  ws.addListener('message', listener)
  await ws.connect()
  socket().simulateOpen()
  socket().simulateMessage('first')

  assert.equal(ws.removeListener('message', listener), ws, 'removeListener must return the instance')

  socket().simulateMessage('second')

  assert.equal(fired, 1, 'a listener removed with removeListener must not receive further messages')
})

test('listeners added with addListener are re-attached after a reconnect', async () => {
  const { ws, sockets } = createReconnectingInstance()
  let fired = 0
  ws.addListener('message', () => {
    fired += 1
  })

  await delay(10)
  sockets[0].simulateOpen()
  sockets[0].simulateClose()
  await delay(40)
  sockets.at(-1).simulateOpen()
  sockets.at(-1).simulateMessage('after reconnect')

  assert.equal(fired, 1, 'the listener must still be registered on the new socket')
})

test('listeners removed with removeListener are not re-attached after a reconnect', async () => {
  const { ws, sockets } = createReconnectingInstance()
  let fired = 0
  const listener = () => {
    fired += 1
  }

  ws.addListener('message', listener)
  await delay(10)
  sockets[0].simulateOpen()
  sockets[0].simulateMessage('before removal')
  ws.removeListener('message', listener)

  sockets[0].simulateClose()
  await delay(40)
  sockets.at(-1).simulateOpen()
  sockets.at(-1).simulateMessage('after reconnect')

  assert.equal(fired, 1, 'the removed listener must not be registered on the new socket')
})
