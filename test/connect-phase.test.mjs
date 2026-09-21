import test from 'node:test'
import assert from 'node:assert/strict'
import { ForeverWebSocket } from '../src/index.mjs'
import { FakeSocket, delay } from './helpers/fakeSocket.mjs'

test('without connectTimeout a socket stuck in CONNECTING produces no events and no retry', async () => {
  let createdCount = 0
  const ws = new ForeverWebSocket('ws://x', {
    timeout: 30,
    reconnect: { initialDelay: 10, maxDelay: 10 },
    createWebSocket: () => {
      createdCount += 1
      return new FakeSocket() // never opens, never closes
    },
  })
  let timeouts = 0
  let connecting = 0
  ws.on('timeout', () => {
    timeouts += 1
  })
  ws.on('connecting', () => {
    connecting += 1
  })

  await delay(120)

  assert.equal(ws.readyState, FakeSocket.CONNECTING)
  assert.equal(timeouts, 0, 'the inactivity timeout is not armed before `open`')
  assert.equal(connecting, 0)
  assert.equal(createdCount, 1)
})

test('connectTimeout aborts a stuck connection and reconnects', async () => {
  let createdCount = 0
  const sockets = []
  const ws = new ForeverWebSocket('ws://x', {
    connectTimeout: 30,
    reconnect: { initialDelay: 5, maxDelay: 5 },
    createWebSocket: () => {
      createdCount += 1
      const socket = new FakeSocket(`socket${createdCount}`)
      sockets.push(socket)
      return socket
    },
  })
  let connectTimeouts = 0
  let connecting = 0
  ws.on('connectTimeout', () => {
    connectTimeouts += 1
  })
  ws.on('connecting', () => {
    connecting += 1
  })

  await delay(120)

  assert.ok(connectTimeouts > 0)
  assert.ok(connecting > 0)
  assert.ok(createdCount > 1)
  assert.ok(sockets[0].terminatedCount > 0, 'the pending socket must be forcibly closed')
})

test('connectTimeout can be disabled at runtime', async () => {
  let createdCount = 0
  const ws = new ForeverWebSocket('ws://x', {
    connectTimeout: 30,
    reconnect: { initialDelay: 5, maxDelay: 5 },
    createWebSocket: () => {
      createdCount += 1
      return new FakeSocket()
    },
  })
  let connectTimeouts = 0
  ws.on('connectTimeout', () => {
    connectTimeouts += 1
  })

  ws.updateOptions({ connectTimeout: null })
  await delay(100)

  assert.equal(connectTimeouts, 0)
  assert.equal(createdCount, 1)
})
