import ws from 'ws'
import EventEmitter from 'eventemitter3'

/**
 * This class represents a reconnecting WebSocket client. It extends the EventEmitter.
 *
 * The class exposes all WebSocket properties and methods
 * WebSocket client https://github.com/websockets/ws
 */
export class ForeverWebSocket extends EventEmitter {
  // Names of properties which are not cloned from underlying WebSocket
  #ownEventNames = ['connecting', 'delay', 'timeout', 'newListener', 'removeListener', 'reconnected']
// Property names for `options`
  #optionsExtendedPropertyNames = ['automaticOpen', 'reconnect', 'timeout', 'ping', 'newWebSocket']
  // stores constructor parameter - the URL to which to connect
  #address
  // stores constructor parameter - the URL to which to connect#address
  #protocol
  #optionsExtended = {
    automaticOpen: true,
  }
  #optionsWebSocket
  #reconnectManager
  #timeoutManager
  #pingManager
  // stores WebSocket registered listeners, which will be re-registered when a new WebSocket connection is established at reconnect
  #listenersWebSocket
  
  /**
   *
   * @param {string} address - The URL to which to connect
   * @param {string|string[]} [protocol] - The list of subprotocols
   * @param {object} [options] - Options as described below, plus options as specified on https://github.com/websockets/ws/blob/master/doc/ws.md#class-websocket
   * @param {boolean} [options.automaticOpen=true] - Controls if WebSocket should be created and connected automatically to the server
   * @param {object} [options.reconnect={}] - Optional parameter for reconnecting. If parameter property is missing or `null`, no reconnection will reoccur
   * @param {'fibonacci'|'exponential' [options.reconnect.strategy='fibonacci'] - Backoff strategy.
   * @param {number} [options.reconnect.initialDelay=50] - Defaults to 50 ms
   * @param {number} [options.reconnect.maxDelay=10000] - Defaults to 10000 ms
   * @param {number} [options.reconnect.factor=1.5] - Multiplicative factor for 'exponential' backoff strategy.
   * @param {boolean} [options.reconnect.randomizeDelay=false] - Range of randomness and must be between 0 and 1. By default, no randomisation is applied
   * @param {number} [options.timeout] - timeout in milliseconds after which the websockets reconnects when no messages are received. Defaults to no timeout.
   * @param {object} [options.ping] - Controls how ping are sent to websocket server. By default no ping is sent
   * @param {number} [options.ping.interval] - Ping interval value in milliseconds
   * @param {array|number|object|string|ArrayBuffer|buffer} [options.ping.data] - The data to send in the ping frame
   * @param {boolean} [options.ping.mask=true] - Specifies whether `data` should be masked or not. Defaults to `true` when websocket is not a server client
   * @param {function} [options.newWebSocket] - Functions which returns a WebSocket instance. If present it will be called when a new WebSocket is needed when reconnecting. The function could be useful in situations when the new WebSocket connection needs to be created with different parameters when reconnecting (e.g. a timestamp in the headers, or different URL).
   */
  constructor(address, protocol, options) {
    super()

    // Helper function - Checks if `propertyName` is a method of `obj`
    const isMethod = (obj, propertyName) => {
      const desc = Object.getOwnPropertyDescriptor (obj, propertyName);
      return !!desc && typeof desc.value === 'function';
    }

    // Helper function - Checks if `obj` is an object
    const isObject = (obj) => {
      return typeof obj === 'object' && obj !== null && !Array.isArray(obj)
    }

    // Store address parameter
    this.#address = address

    // Store protocol parameter
    let allOptions
    if (Array.isArray(protocol) || typeof protocol === 'string') {
      this.#protocol = protocol
      allOptions = options || {}
    } else {
      this.#protocol = undefined
      allOptions = protocol || {}
    }

    // Store options parameters, separating the keys to `#optionsWebSocket` (WebSocket native options) and `#optionsExtended` (ForeverWebSocket options)
    Object.keys(allOptions).forEach((key) => {
      if (this.#optionsExtendedPropertyNames.includes(key)) {
        if (isObject(allOptions[key]) && isObject(this.#optionsExtended[key])) {
          // if key value is an object, keep default values if not specified in parameter `options` 
          this.#optionsExtended[key] = { ...this.#optionsExtended[key], ...allOptions[key] }
        } else {
          // else store the specified value
          this.#optionsExtended[key] = allOptions[key] 
        }
      } else {
        this.#optionsWebSocket ??= {}
        this.#optionsWebSocket[key] = allOptions[key]
      }
    })

    this.#listenersWebSocket = {}

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
      let lastConnectedMts
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

        lastConnectedMts = Date.now()
        isStopped = false
        previousDelay = delay
        delay = nextDelay
        let randomizedDelay = Math.min(delay, maxDelay)
        randomizedDelay = randomizeDelay ? Math.round(randomizedDelay * (1 + Math.random() * 0.2)) : randomizedDelay


        callbackStartDelay(retryNumber + 1, randomizedDelay)
        timeoutId = setTimeout(() => {
          retryNumber += 1
          callbackStartConnect(retryNumber, lastConnectedMts)
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
        lastConnectedMts = undefined
      }

      function stop() {
        isStopped = true
        clearTimeout(timeoutId)
      }

      function getlastConnectedMts() {
        return lastConnectedMts
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
        lastConnectedMts: getlastConnectedMts,
        isStopped: getIsStopped,
        retryNumber: getRetryNumber,
      })
    }

    // Create reconnect manager if needed
    if (this.#optionsExtended?.reconnect !== null) {
      this.#reconnectManager = createReconnectFactory(
        this.#optionsExtended.reconnect,
        (retryNumber, lastConnectionTimestamp) => {
          this.emit('connecting', retryNumber, lastConnectionTimestamp)
          this.connect()
        },
        (retryNumber, delay) => {
          this.emit('delay', retryNumber, delay)
        }
      )
    }

    if (this.#optionsExtended.automaticOpen) {
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

    // Create ping manager if needed
    if (this.#optionsExtended.ping) {
      this.#pingManager = createPingFactory(
        {
          interval: this.#optionsExtended.ping.interval,
        },
        () => {
          if (this.readyState === 1) {
            if (typeof this.ping === 'function') {
              this.ping(this.#optionsExtended.ping.data, this.#optionsExtended.ping.mask)
            } else {
              this.send(this.#optionsExtended.ping.data)
            }
          }
        }
      )
    }

    function createTimeoutFactory({ timeout }, callbackTimeout) {
      let timeoutId
      let lastActiveMts
      function reset() {
        lastActiveMts = Date.now()
        if (typeof timeoutId?.refresh === 'function') {
          timeoutId.refresh()
        } else {
          clearTimeout(timeoutId)
          timeoutId = setTimeout(() => {
            callbackTimeout(lastActiveMts)
          }, timeout)
        }

        timeoutId.unref?.()
      }

      function start() {
        reset()
      }

      function stop() {
        clearTimeout(timeoutId)
        timeoutId = null
      }

      return Object.freeze({
        start,
        reset,
        stop,
      })
    }

    // Create timeout manager if needed
    if (this.#optionsExtended.hasOwnProperty('timeout') && this.#optionsExtended.timeout > 0) {
      this.#timeoutManager = createTimeoutFactory(
        {
          timeout: this.#optionsExtended.timeout
        },
        (lastActiveMts) => {
          this.emit('timeout', lastActiveMts)
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
    if (this.#ownEventNames.includes(eventName)) {
      return super.on(eventName, listener)
    }

    // Add listener to listeners array, so that it can be added later when a new WebSocket object is created at reconnect
    if(Array.isArray(this.#listenersWebSocket[eventName])) {
      this.#listenersWebSocket[eventName].unshift({ listener, options, method: 'on' })
    } else {
      this.#listenersWebSocket[eventName] = [{ listener, options, method: 'on' }]
    }

    if (this.ws) {
      if (options?.once) {
        this.ws.addEventListener(eventName, () => {
          let index = this.#listenersWebSocket[eventName].findIndex((elem) => elem.listener === listener && elem.options?.once)
          if (index > -1) this.#listenersWebSocket[eventName].splice(index, 1)
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
    if (this.#ownEventNames.includes(eventName)) {
      return super.on(eventName, listener)
    }

    // Add listener to listeners array, so that it can be added later when a new WebSocket object is created at reconnect
    if(Array.isArray(this.#listenersWebSocket[eventName])) {
      this.#listenersWebSocket[eventName].unshift({ listener, options, method: 'addEventListener' })
    } else {
      this.#listenersWebSocket[eventName] = [[listener, options]]
    }

    if (this.ws) {
      if (options?.once) {
        this.ws.addEventListener(eventName, () => {
          let index = this.#listenersWebSocket[eventName].findIndex((elem) => elem.listener === listener && elem.options?.once)
          if (index > -1) this.#listenersWebSocket[eventName].splice(index, 1)
        }, { once: true })
      }

      this.ws.addEventListener(eventName, listener, options)
    }

    return this
  }

  off(eventName, listener) {
    if (this.#ownEventNames.includes(eventName)) {
      return super.removeListener(eventName, listener)
    }

    this.ws.removeEventListener(eventName, listener)

    // Remove listener from listeners array
    let index = this.#listenersWebSocket[eventName].findIndex((elem) => elem[0] === listener)
    if (index > -1) this.#listenersWebSocket[eventName].splice(index, 1)

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
    // If a WebSocket is already defined do nothing
    if (this.ws) {
      return
    }
    // Stop ping and timout managers, will activate them again when WebSocket connection is open
    this.#pingManager?.stop()
    this.#timeoutManager?.stop()

    // Create a new WebSocket, either by calling `options.newWebSocket` or using the WebSocket class
    if (this.#optionsExtended.newWebSocket) {
      this.ws = this.#optionsExtended.newWebSocket()
    } else {
      this.ws = new ws(this.#address, this.#protocol, this.#optionsWebSocket)
    }

    // When WebSocket connection is open, restart ping and timeout managers, and reset the reconnect manager
    this.ws.addEventListener('open', () => {
      this.#pingManager?.start()
      this.#timeoutManager?.start()
      if (this.#reconnectManager) {
        const retryNumber = this.#reconnectManager.retryNumber()
        const lastConnectedMts = this.#reconnectManager.lastConnectedMts()
        this.#reconnectManager.reset()
        if (lastConnectedMts) {
          this.emit('reconnected', retryNumber, lastConnectedMts)
        }
      }
    })

    // When a message is received, reset timeout manager
    this.ws.addEventListener('message', () => {
      this.#timeoutManager?.reset()
    })

    // When pong is received, refresh timeout manager
    // Note: Not all WebSocket implementations support `on()` method and `pong` event
    if (typeof this.ws.on === 'function') {
      this.ws.on('pong',  (data) => {
        this.#timeoutManager?.reset()
      })
    }

    // When WebSocket closes, stop ping and timeout managers and schedule next reconnect if reconnect manager is defined and not stopped manually.
    this.ws.addEventListener('close', () => {
      this.#pingManager?.stop()
      this.#timeoutManager?.stop()
      if (this.#reconnectManager && !this.#reconnectManager.isStopped()) {
        this.#reconnectManager.scheduleNextConnect()
      }
    })

    // Add registered event listeners to the new underlying WebSocket object
    for (const [eventName, listeners] of Object.entries(this.#listenersWebSocket)) {
      for (const { listener, options, method } of listeners) {
        // If once = true, then remove listeners from listeners array when the event has occurred once
        if(options?.once) {
          this.ws.addEventListener(eventName, () => {
            let index = this.#listenersWebSocket[eventName].findIndex((elem) => elem.listener === listener && elem.options?.once)
            if (index > -1) this.#listenersWebSocket[eventName].splice(index, 1)
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
   * The method extends `WebSocket.send()` method, so that and `Object` can be passed. In this case the object is stringfied before sending.
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
  refresh(code, reason) {
    this.ws.close(code, reason)
  }

  /**
   * Closes the Websocket and stops reconnecting.
   *
   * @param code
   * @param reason
   */
  close(code, reason) {
    this.#pingManager?.stop()
    this.#timeoutManager?.stop()
    this.#reconnectManager?.stop()
    this.ws.close(code, reason)
  }

  /**
   * Terminates the WebSocket (forcibly closes the connection) and stops reconnecting.
   *
   * For some browser WebSocket implementation this method is not available, in which case internally this calls `WebSocket.close()`.
   */
  terminate() {
    this.#pingManager?.stop()
    this.#timeoutManager?.stop()
    this.#reconnectManager?.stop()
    if (typeof this.ws?.terminate === 'function') {
      this.ws.terminate()
    } else {
      this.ws.close()
    }
  }
}
