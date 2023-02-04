import ws from 'ws'
import EventEmitter from 'eventemitter3'

/**
 * This class represents a reconnecting WebSocket. It extends the EventEmitter.
 *
 * The class exposes all websocket
 * WebSocket client https://github.com/websockets/ws
 */

// Names of properties which are not cloned from underlying WebSocket
const ownEventNames = ['connecting', 'delay', 'timeout', 'newListener', 'removeListener', 'reconnected']

// Property names for `options`
const optionsPropertyNames = ['automaticOpen', 'reconnect', 'timeout', 'ping', 'newWebsocketFn']

// Detects if the property name is a method of obj
function isMethod (obj, propertyName) {
  const desc = Object.getOwnPropertyDescriptor (obj, propertyName);
  return !!desc && typeof desc.value === 'function';
}

export class ReconnectingWebSocketClient extends EventEmitter {
  /**
   *
   * @param {string} address - The URL to which to connect
   * @param {string|string[]} [protocol] - The list of subprotocols
   * @param {object} [options] - Options as described below, plus options as specified on https://github.com/websockets/ws/blob/master/doc/ws.md#class-websocket
   * @param {object} [options.automaticOpen=true] -
   * @param {object} [options.reconnect] - Optional parameter for reconnecting. If parameter property is missing or `null`, no reconnection will reoccur
   * @param {number} [options.reconnect.factor=1.5] - Multiplicative factor for exponential backoff strategy.
   * @param {number} [options.reconnect.initialDelay=50] - Defaults to 50 ms
   * @param {number} [options.reconnect.maxDelay=10000] - Defaults to 10000 ms
   * @param {boolean} [options.reconnect.randomizeDelay=false] - Range of randomness and must be between 0 and 1. By default, no randomisation is applied
   * @param {number} [options.timeout] - timeout in milliseconds after which the websockets reconnects when no messages are received. Defaults to no timeout.
   * @param {object} [options.ping] - Controls how ping are sent to websocket server. By default no ping is sent
   * @param {number} [options.ping.interval] - Ping interval value in milliseconds
   * @param {array|number|object|string|ArrayBuffer|buffer} [options.ping.data] - The data to send in the ping frame
   * @param {boolean} [options.ping.mask=true] - Specifies whether `data` should be masked or not. Defaults to `true` when websocket is not a server client
   * @param {function} [options.newWebSocketFn] - Functions which returns a WebSocket instance. If present it will be called when a new WebSocket is needed when reconnecting. The function could be useful in situations when the new WebSocket connection needs to be created with different parameters when reconnecting (e.g. a timestamp in the headers, or different URL).
   */
  constructor(address, protocol, options) {
    super()

    // Store parameters
    this._address = address
    if (Array.isArray(protocol) || typeof protocol === 'string') {
      this._protocol = protocol
      this._options = options || {}
    } else {
      this._protocol = undefined
      this._options = protocol || {}
    }

    this._optionsWebSocket = {}
    Object.keys(this._options).forEach((key) => {
      if (!optionsPropertyNames.includes(key)) {
        this._optionsWebSocket[key] = this._options[key]
      }
    })

    this._listenersWebSocket = {}

    // Add methods and properties of underlying WebSocket class, except `reservedPropertyNames` which are defined explicitly
    const reservedPropertyNames = ['close', 'send', 'constructor', 'readyState', 'onopen', 'onmessage', 'onerror', 'onclose', 'addEventListener', 'removeEventListener']
    let propertyNames = Object.getOwnPropertyNames(ws.prototype)
    for (const propertyName of propertyNames) {
      if (reservedPropertyNames.includes(propertyName)) continue
      if (isMethod(ws.prototype, propertyName)) {
        this[propertyName] = (...args) => this.ws[propertyName](...args)
      } else {
        Object.defineProperty(this, propertyName, {
          get: () => this.ws[propertyName],
          set: (value) => this.ws[propertyName] = value
        })
      }
    }

    // Defines factory function to handle reconnect
    function createReconnectFactory({ strategy = 'fibonacci', initialDelay = 50, maxDelay = 10000, randomizeDelay = true, factor = 1.5 } = {}, callbackStartConnect, callbackStartDelay) {
      let lastConnectedTimestamp
      let isStopped = false
      let retryNumber = 0
      let previousDelay = 0
      let delay = 0
      let nextDelay = initialDelay
      let timeoutId = null

      function scheduleNextConnect() {
        const getNextDelay = {
          fibonacci: () => delay + previousDelay,
          exponential: () => delay * factor,
        }

        lastConnectedTimestamp = Date.now()
        isStopped = false
        previousDelay = delay
        delay = nextDelay
        let randomizedDelay = Math.min(delay, maxDelay)
        randomizedDelay = randomizeDelay ? Math.round(randomizedDelay * (1 + Math.random() * 0.2)) : randomizedDelay


        callbackStartDelay(retryNumber + 1, randomizedDelay)
        timeoutId = setTimeout(() => {
          retryNumber += 1
          callbackStartConnect(retryNumber, lastConnectedTimestamp)
        }, randomizedDelay)
        timeoutId.unref?.()

        // calculate the delay for the next reconnect
        nextDelay =  getNextDelay[strategy]()
      }

      function reset() {
        isStopped = false
        clearTimeout(timeoutId)
        timeoutId = null
        retryNumber = 0
        previousDelay = 0
        delay = 0
        nextDelay = initialDelay
        lastConnectedTimestamp = undefined
      }

      function stop() {
        isStopped = true
        clearTimeout(timeoutId)
      }

      function getLastConnectedTimestamp() {
        return lastConnectedTimestamp
      }

      function getIsStopped() {
        return isStopped
      }

      function getRetryNumber() {
        return retryNumber
      }

      return Object.freeze({
        scheduleNextConnect,
        reset,
        stop,
        lastConnectedTimestamp: getLastConnectedTimestamp,
        isStopped: getIsStopped,
        retryNumber: getRetryNumber,
      })
    }

    if (this._options.hasOwnProperty('reconnect')) {
      this._reconnectFactory = createReconnectFactory(
        this._options.reconnect,
        (retryNumber, lastConnectionTimestamp) => {
          this.emit('connecting', retryNumber, lastConnectionTimestamp)
          this.connect()
        },
        (retryNumber, delay) => {
          this.emit('delay', retryNumber, delay)
        }
      )
    }

    if (this._options.automaticOpen) {
      this.connect()
    }


    function createPingFactory({ interval }, callbackPing) {
      let intervalId
      function start() {
        intervalId = setInterval(() => {
          callbackPing()
        }, interval)
        intervalId.unref?.()
      }

      function stop() {
        clearInterval(intervalId)
      }

      return Object.freeze({
        start,
        stop,
      })
    }

    if (this._options.ping) {
      this._pingFactory = createPingFactory(
        {
          interval: this._options.ping.interval,
        },
        () => {
          if (this.readyState === 1) {
            if (typeof this.ping === 'function') {
              this.ping(this._options.ping.data, this._options.ping.mask)
            } else {
              this.send(this._options.ping.data)
            }
          }
        }
      )
    }

    function createTimeoutFactory({ timeout }, callbackTimeout) {
      let timeoutId
      let lastRefreshMts
      function refresh() {
        lastRefreshMts = Date.now()
        if (typeof timeoutId?.refresh === 'function') {
          timeoutId.refresh()
        } else {
          clearTimeout(timeoutId)
          timeoutId = setTimeout(() => {
            callbackTimeout(lastRefreshMts)
          }, timeout)
        }

        timeoutId.unref?.()
      }

      function start() {
        refresh()
      }

      function stop() {
        clearTimeout(timeoutId)
        timeoutId = null
      }

      return Object.freeze({
        start,
        refresh,
        stop,
      })
    }

    if (this._options.hasOwnProperty('timeout') && this._options.timeout > 0) {
      this._timeoutFactory = createTimeoutFactory(
        {
          timeout: this._options.timeout
        },
        (lastRefreshMts) => {
          this.emit('timeout', lastRefreshMts)
          this.refresh()
        }
      )
    }
  }

  once(eventName, listener, options) {
    this.on(eventName, listener, { ...(options || {}), once: true })
  }

  /**
   * Catches registration of event listeners, to add these to WebSocket object
   *
   * All events are added to the websocket object
   * @param eventName
   * @param listener
   * @param options
   */
  on(eventName, listener, options) {
    if (ownEventNames.includes(eventName)) {
      return super.on(eventName, listener)
    }

    // Add listener to listeners array, so that it can be added later when a new WebSocket object is created at reconnect
    if(Array.isArray(this._listenersWebSocket[eventName])) {
      this._listenersWebSocket[eventName].unshift({ listener, options, method: 'on' })
    } else {
      this._listenersWebSocket[eventName] = [{ listener, options, method: 'on' }]
    }

    if (this.ws) {
      if (options?.once) {
        this.ws.addEventListener(eventName, () => {
          let index = this._listenersWebSocket[eventName].findIndex((elem) => elem.listener === listener && elem.options?.once)
          if (index > -1) this._listenersWebSocket[eventName].splice(index, 1)
        }, { once: true })
      }

      if (typeof this.ws.on === 'function') {
        this.ws.on(eventName, listener, options)
      } else {
        this.ws.addEventListener(eventName, listener, options)
      }
    }

    return this
  }

  /**
   * Alias for `on`
   */
  addListener(...args) {
    return this.on(...args)
  }

  /**
   * Alias for `on`
   */
  addEventListener(eventName, listener, options) {
    if (ownEventNames.includes(eventName)) {
      return super.on(eventName, listener)
    }

    // Add listener to listeners array, so that it can be added later when a new WebSocket object is created at reconnect
    if(Array.isArray(this._listenersWebSocket[eventName])) {
      this._listenersWebSocket[eventName].unshift({ listener, options, method: 'addEventListener' })
    } else {
      this._listenersWebSocket[eventName] = [[listener, options]]
    }

    if (this.ws) {
      if (options?.once) {
        this.ws.addEventListener(eventName, () => {
          let index = this._listenersWebSocket[eventName].findIndex((elem) => elem.listener === listener && elem.options?.once)
          if (index > -1) this._listenersWebSocket[eventName].splice(index, 1)
        }, { once: true })
      }

      this.ws.addEventListener(eventName, listener, options)
    }

    return this
  }


  off(eventName, listener) {
    if (ownEventNames.includes(eventName)) {
      return super.removeListener(eventName, listener)
    }

    this.ws.removeEventListener(eventName, listener)

    // Remove listener from listeners array
    let index = this._listenersWebSocket[eventName].findIndex((elem) => elem[0] === listener)
    if (index > -1) this._listenersWebSocket[eventName].splice(index, 1)

    return this
  }

  removeListener(...args) {
    this.addListener(...args)
  }

  removeEventListener(...args) {
    this.addListener(...args)
  }


  /**
   * Returns the readyState of the underlying WebSocket or `undefined` if it does not exist.
   * When the underlying WebSocket object does not exist it returns `undefined`
   *
   * @returns {number|null}
   */
  get readyState() {
    return this.ws?.readyState
  }

  connect() {
    // Stop ping and timout factories, will activate them again when WebSocket connection is open
    this._pingFactory?.stop()
    this._timeoutFactory?.stop()

    // Create a new WebSocket, either by calling `options.newWebSocketFn` or using the WebSocket class
    if (this._options.newWebSocketFn) {
      this.ws = this._options.newWebSocketFn()
    } else {
      this.ws = new ws(this._address, this._protocol, this._optionsWebSocket)
    }


    // When WebSocket connection is open, restart ping and timeout factories, and reset the reconnect factory
    this.ws.addEventListener('open', () => {
      this._pingFactory?.start()
      this._timeoutFactory?.start()
      if (this._reconnectFactory) {
        const retryNumber = this._reconnectFactory.retryNumber()
        const lastConnectedTimestamp = this._reconnectFactory.lastConnectedTimestamp()
        this._reconnectFactory.reset()
        if (lastConnectedTimestamp) {
          this.emit('reconnected', retryNumber, lastConnectedTimestamp)
        }
      }
    })

    // When message is received, refresh timeout factory
    this.ws.addEventListener('message', () => {
      this._timeoutFactory?.refresh()
    })

    // When pong is received, refresh timeout factory.
    // Note: Not all websocket implementations support `on()` method and `pong` event
    if (typeof this.ws.on === 'function') {
      this.ws.on('pong',  (data) => {
        this._timeoutFactory?.refresh()
      })
    }

    this.ws.addEventListener('close', () => {
      this._pingFactory?.stop()
      this._timeoutFactory?.stop()
      if (this._reconnectFactory && !this._reconnectFactory.isStopped()) {
        this._reconnectFactory.scheduleNextConnect()
      }
    })

    // Add existing event listeners to the new underlying WebSocket object
    for (const [eventName, listeners] of Object.entries(this._listenersWebSocket)) {
      for (const { listener, options, method } of listeners) {
        // If once = true, then remove listeners from listeners array when the event has occurred once
        if(options?.once) {
          this.ws.addEventListener(eventName, () => {
            let index = this._listenersWebSocket[eventName].findIndex((elem) => elem.listener === listener && elem.options?.once)
            if (index > -1) this._listenersWebSocket[eventName].splice(index, 1)
          }, { once: true })
        }

        // Add listener to the WebSocket object using the same method as initially added
        if (method === 'on' && typeof this.ws.on === 'function') {
          this.ws.on(eventName, listener, options)
        } else {
          this.ws.addEventListener(eventName, listener, options)
        }
      }
    }

    // Set event handler properties for the new underlying WebSocket object
    for (const eventHandlerName of ['onopen', 'onmessage', 'onerror', 'onclose']) {
      if (this[eventHandlerName]) {
        this.ws[eventHandlerName] = this[eventHandlerName]
      }
    }
  }

  /**
   *
   * Sends data to the WebsocketServer.
   *
   * The method extends `WebSocket.send()` method, so that and `Object` can be passed, in which case it is stringfied before sending.
   *
   * It will throw an exception if you call send() when the connection is in the CONNECTING state or when underlying WebSocket object does not exist.
   *
   * @param data
   */
  send(data) {
    if (typeof data === 'object') {
      this.ws.send(JSON.stringify(data))
    } else {
      this.ws.send(data)
    }
  }

  /**
   * Refreshes the connection (close, re-open).
   */
  refresh() {
    this.ws.close()
  }

  /**
   * Closes the Websocket and stops reconnecting.
   *
   * @param code
   * @param reason
   */
  close(code, reason) {
    this._pingFactory?.stop()
    this._timeoutFactory?.stop()
    this._reconnectFactory?.stop()
    this.ws.close(code, reason)
  }

  /**
   * Terminates the WebSocket (forcibly closes the connection) and stops reconnecting.
   *
   * For some browser WebSocket implementation this method is not available, in which case internally this calls `WebSocket.close()`.
   */
  terminate() {
    this._pingFactory?.stop()
    this._timeoutFactory?.stop()
    this._reconnectFactory?.stop()
    if (typeof this.ws?.terminate === 'function') {
      this.ws.terminate()
    } else {
      this.ws.close()
    }
  }
}

