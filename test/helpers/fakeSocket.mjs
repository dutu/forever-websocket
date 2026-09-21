/**
 * Minimal WebSocket stand-in used to drive `ForeverWebSocket` deterministically in tests.
 * It mimics both the browser (EventTarget) and the `ws` (EventEmitter + `ping`/`pong`/`terminate`)
 * APIs, and records the calls made to it.
 */
export class FakeSocket {
  static CONNECTING = 0
  static OPEN = 1
  static CLOSING = 2
  static CLOSED = 3

  constructor(name = 'socket') {
    this.name = name
    this.readyState = FakeSocket.CONNECTING
    this.binaryType = 'blob'
    this.url = 'ws://fake'
    this.protocol = ''
    this.bufferedAmount = 0
    this.extensions = ''
    this.terminatedCount = 0
    this.closedCount = 0
    this.pingCount = 0
    this.sentMessages = []
    this._listeners = {}
    this._onListeners = {}
  }

  // EventTarget API
  addEventListener(eventName, listener) {
    ;(this._listeners[eventName] ??= []).push(listener)
  }

  removeEventListener(eventName, listener) {
    if (this._listeners[eventName]) {
      this._listeners[eventName] = this._listeners[eventName].filter((entry) => entry !== listener)
    }
  }

  // EventEmitter API (used by the `ws` implementation for `ping`/`pong`)
  on(eventName, listener) {
    ;(this._onListeners[eventName] ??= []).push(listener)
  }

  off(eventName, listener) {
    if (this._onListeners[eventName]) {
      this._onListeners[eventName] = this._onListeners[eventName].filter((entry) => entry !== listener)
    }
  }

  // Test helpers to simulate events coming from the server
  emitEvent(eventName, ...args) {
    for (const listener of [...(this._listeners[eventName] ?? [])]) {
      listener(...args)
    }
    for (const listener of [...(this._onListeners[eventName] ?? [])]) {
      listener(...args)
    }
  }

  simulateOpen() {
    this.readyState = FakeSocket.OPEN
    this.emitEvent('open')
  }

  simulateMessage(data) {
    this.emitEvent('message', data)
  }

  simulatePing(data) {
    this.emitEvent('ping', data)
  }

  simulatePong(data) {
    this.emitEvent('pong', data)
  }

  simulateClose() {
    this.readyState = FakeSocket.CLOSED
    this.emitEvent('close', {})
  }

  // WebSocket API
  ping(data, mask) {
    this.pingCount += 1
    return true
  }

  send(data) {
    this.sentMessages.push(data)
  }

  close(code, reason) {
    this.closedCount += 1
    this.readyState = FakeSocket.CLOSED
    queueMicrotask(() => this.emitEvent('close', { code, reason }))
  }

  terminate() {
    this.terminatedCount += 1
    this.readyState = FakeSocket.CLOSED
    queueMicrotask(() => this.emitEvent('close', {}))
  }
}

/**
 * Resolves after `ms` milliseconds.
 */
export function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
