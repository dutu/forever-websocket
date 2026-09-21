/*
  Scenario: a listener of the `connecting` event throws. The exception escapes from the reconnect
  timer, so this scenario runs in its own process and asserts that `connect()` still ran.
*/
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { ForeverWebSocket } from '../../src/index.mjs'
import { FakeSocket } from '../helpers/fakeSocket.mjs'

const expectedMessage = 'connecting listener boom'
const unexpectedErrors = []

// Only the throwing listener error is expected; anything else must fail the scenario
process.on('uncaughtException', (error) => {
  if (error?.message !== expectedMessage) {
    unexpectedErrors.push(error)
  }
})

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

ws.on('connecting', () => {
  throw new Error(expectedMessage)
})

await new Promise((resolve) => setTimeout(resolve, 20))
sockets[0].simulateOpen()
sockets[0].simulateClose()
await new Promise((resolve) => setTimeout(resolve, 80))

assert.deepEqual(unexpectedErrors, [], 'only the throwing listener error is expected')
assert.ok(createdCount > 1, 'reconnect must still run even though the connecting listener threw')
fs.writeSync(1, `SCENARIO_OK connecting createdCount=${createdCount}\n`)
process.exit(0)
