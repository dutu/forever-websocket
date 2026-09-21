/*
  Scenario: a listener of the `timeout` event throws. The exception escapes from a timer, which would
  make `node:test` fail the whole file, so this scenario runs in its own process and asserts that
  `refresh()` still ran (the socket was closed).
*/
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { ForeverWebSocket } from '../../src/index.mjs'
import { FakeSocket } from '../helpers/fakeSocket.mjs'

const expectedMessage = 'timeout listener boom'
const unexpectedErrors = []

// Only the throwing listener error is expected; anything else must fail the scenario
process.on('uncaughtException', (error) => {
  if (error?.message !== expectedMessage) {
    unexpectedErrors.push(error)
  }
})

let socket
const ws = new ForeverWebSocket('ws://x', {
  automaticOpen: false,
  reconnect: null,
  timeout: 20,
  createWebSocket: () => (socket = new FakeSocket()),
})

ws.on('timeout', () => {
  throw new Error(expectedMessage)
})

await ws.connect()
socket.simulateOpen()
await new Promise((resolve) => setTimeout(resolve, 80))

assert.deepEqual(unexpectedErrors, [], 'only the throwing listener error is expected')
assert.ok(socket.closedCount > 0, 'refresh() must run even though the timeout listener threw')
fs.writeSync(1, `SCENARIO_OK timeout closedCount=${socket.closedCount}\n`)
process.exit(0)
