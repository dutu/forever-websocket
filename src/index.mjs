import WebSocket from 'isomorphic-ws'
import EventEmitter from 'eventemitter3'
import _ from 'lodash'
import { isMethod } from './utils/isMethod.mjs'
import { isObject } from './utils/isObject.mjs'
import { createReconnectFactory } from './factories/reconnectFactory.mjs'
import { createPingFactory } from './factories/pingFactory.mjs'
import { createTimeoutFactory} from './factories/timeoutFactory.mjs'

const addListenerMethods = {
  once: 'once',
  on: 'on',
  addEventListener: 'addEventListener',
}

const removeListenerMethods = {
  off: 'off',
  removeEventListener: 'removeEventListener',
}

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
  #optionsExtendedPropertyNames = ['automaticOpen', 'reconnect', 'timeout', 'ping', 'createWebSocket']
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
  #listenersWebSocket = {}

  /**
   * Constructs a new WebSocket connection with enhanced features like automatic reconnection, ping management, and connection timeout handling.
   * This constructor initializes the WebSocket connection based on the provided address, optional protocols, and a set of custom options.
   * It extends the basic WebSocket functionality with support for automatic reconnection, periodic ping messages, and connection timeout detection.
   *
   * @param {string} address - The URL to which the WebSocket should connect.
   * @param {string|string[]} [protocol] - Optional. One or more subprotocols as a string or array of strings.
   * @param {object} [options] - An optional object containing configuration options. This includes both standard WebSocket options and extended options for reconnection, ping, and timeout management.
   *
   * @param {boolean} [options.automaticOpen=true] - Whether to automatically open the WebSocket connection upon instantiation.
   *
   * @param {object} [options.reconnect={}] - Configuration for automatic reconnection. If omitted or null, reconnection is disabled.
   * @param {'fibonacci'|'exponential'} [options.reconnect.strategy='fibonacci'] - The strategy to use for calculating reconnection delay.
   * @param {number} [options.reconnect.initialDelay=50] - The initial delay in milliseconds before attempting a reconnection.
   * @param {number} [options.reconnect.maxDelay=10000] - The maximum delay in milliseconds between reconnection attempts.
   * @param {number} [options.reconnect.factor=1.5] - The multiplicative factor for calculating the next delay in the 'exponential' strategy.
   * @param {boolean} [options.reconnect.randomizeDelay=false] - Whether to apply randomization to the reconnection delay.
   *
   * @param {number} [options.timeout] - The timeout in milliseconds for detecting loss of connection. A timeout event is triggered if no messages are received within this period.
   *
   * @param {object} [options.ping] - Configuration for sending ping messages to maintain the connection.
   * @param {number} [options.ping.interval] - The interval in milliseconds at which ping messages are sent.
   * @param {any} [options.ping.data] - The data to send in the ping message.
   * @param {boolean} [options.ping.pingFrame=false] - Whether to send the ping as a WebSocket ping frame.
   * @param {boolean} [options.ping.mask] - Whether to mask the ping data.
   *
   * @param {function} [options.createWebSocket] - A function that returns a new WebSocket instance, allowing for custom WebSocket creation logic upon reconnection.
   *
   * @example
   * const ws = new ForeverWebSocket('ws://example.com', 'protocol', {
   *   automaticOpen: true,
   *   reconnect: {
   *     strategy: 'fibonacci',
   *     initialDelay: 100,
   *     maxDelay: 5000,
   *     randomizeDelay: true
   *   },
   *   ping: {
   *     interval: 2000,
   *     data: 'ping',
   *     pingFrame: true
   *   },
   *   timeout: 30000
   * });
   *
   * ws.on('connecting', (retryNumber, lastConnectionTimestamp) => console.log(`Reconnecting attempt #${retryNumber} since ${lastConnectionTimestamp}`));
   * ws.on('delay', (retryNumber, delay) => console.log(`Delaying next reconnect attempt by ${delay}ms (Attempt #${retryNumber})`));
   * ws.on('timeout', (lastActiveMts) => console.log(`Connection timed out. Last activity at ${lastActiveMts}`));
   */
  constructor(address, protocol, options) {
    super()
    this.#initializeClassParameters(address, protocol, options)
    this.#replicateWebSocketProperties()
    this.#setupReconnectManager()
    this.#setupPingManager()
    this.#setupTimeoutManager()
    if (this.#optionsExtended.automaticOpen) {
      this.connect()
    }
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

  on(eventName, listener, options) {
    this.#registerEventListener(eventName, listener, options, addListenerMethods.on)
    this.#attachEventListener(eventName, listener, options, addListenerMethods.on)
    super.on(eventName, listener)
    return this
  }

  addEventListener(eventName, listener, options) {
    this.#registerEventListener(eventName, listener, options, addListenerMethods.addEventListener)
    this.#attachEventListener(eventName, listener, options, addListenerMethods.addEventListener)
    super.on(eventName, listener)
    return this
  }

  once(eventName, listener, options) {
    const optionsToUse = { ...(options || {}), once: true }
    this.#registerEventListener(eventName, listener, optionsToUse, addListenerMethods.once)
    this.#attachEventListener(eventName, listener, optionsToUse, addListenerMethods.once)
    super.once(eventName, listener)
    return this
  }

  off(eventName, listener, options, once) {
    this.#deregisterEventListener(eventName, listener)
    this.#detachEventListener(eventName, listener)
    super.off(eventName, listener)
    return this
  }

  removeEventListener(eventName, listener, options, once) {
    this.#deregisterEventListener(eventName, listener, options, once)
    this.#detachEventListener(eventName, listener, options)
    super.off(eventName, listener)
    return this
  }

  /**
   * Sends data to the WebSocket server. This method allows sending both string and object data.
   * If an object is passed, it will be automatically converted to a JSON string before sending.
   *
   * Note: Calling `send` while the connection is still establishing (CONNECTING state) or
   * if the WebSocket object does not exist (e.g., not initialized or already closed) will result in an exception.
   *
   * @param {string|Object} data - The data to send to the server. Objects are automatically stringified.
   * @throws {Error} If the WebSocket connection is not open or the WebSocket object does not exist.
   */
  send(data) {
    if (typeof data === 'object') {
      this.ws.send(JSON.stringify(data))
    } else {
      this.ws.send(data)
    }
  }

  /**
   * Initiates a connection to the WebSocket server. If a connection is already open, the function
   * will return early without establishing a new connection. This method is responsible for
   * setting up a new WebSocket connection, including cleaning up any previous connections,
   * reinitializing connection managers, and reattaching event listeners and custom event handlers.
   *
   * It ensures that the WebSocket is properly connected and ready for communication, handling
   * all necessary steps to establish a robust and responsive connection. This method is ideal
   * for initiating or reinitiating the WebSocket connection in a reliable manner.
   *
   * @returns {Promise<void>} A promise that resolves once the connection has been successfully
   *                          established, or immediately if the connection is already open.
   *
   * @example
   * // Assuming an instance of the class has been created
   * await instance.connect();
   * // The WebSocket is now connected, and the instance is ready to send and receive messages.
   *
   * @example
   * // It's recommended to call `connect` when initially setting up the WebSocket communication,
   * // or if you need to manually reconnect after a disconnect.
   * instance.on('disconnected', async () => {
   *   console.log('WebSocket disconnected. Attempting to reconnect...');
   *   await instance.connect();
   * });
   */
  async connect() {
    // Check if the WebSocket is already open
    if (this.#isWebSocketOpen()) {
      // Return (don't connect/reconnect)
      return
    }

    // Check if old WebSocket exists
    if (this.ws) {
      // Cleanup event listeners
      this.#cleanupWebSocket()
    }

    // Stop ping and timout managers, will activate them again when WebSocket connection is open
    this.#pingManager?.stop()
    this.#timeoutManager?.stop()

    // Create new WebSocket
    try {
      if (this.#optionsExtended.createWebSocket) {
        this.ws = await this.#optionsExtended.createWebSocket()
      } else {
        this.ws = new WebSocket(this.#address, this.#protocol, this.#optionsWebSocket)
      }
    } catch (error) {
      this.emit('error', error);
      this.ws = null; // Set this.ws to null to indicate no connection
      // Schedule reconnect if the option is on
      if (this.#reconnectManager && !this.#reconnectManager.isStopped()) {
        this.#reconnectManager.scheduleNextConnect()
      }

      return
    }

    this.#reconnectManager?.reset()
    this.#reattachConnectionManagers()
    this.#reattachEventListeners()
    this.#assignCustomEventHandlers()
  }

  /**
   * Refreshes the WebSocket connection by closing the current connection and triggering a reconnection.
   * This can be used to manually reset the connection with optional closure code and reason.
   *
   * @param {number} [code] - Optional status code indicating why the connection is being closed.
   * @param {string} [reason] - Optional human-readable string explaining why the connection is closing.
   */
  refresh(code, reason) {
    this.ws.close(code, reason)
  }

  /**
   * Closes the current WebSocket connection and halts any further attempts to reconnect.
   * Use this method to intentionally disconnect and clean up resources.
   *
   * @param {number} [code] - An optional numeric value indicating the status code explaining why the connection is being closed.
   * @param {string} [reason] - An optional string providing a human-readable explanation of why the connection is closing.
   */
  close(code, reason) {
    this.#pingManager?.stop()
    this.#timeoutManager?.stop()
    this.#reconnectManager?.stop()
    this.ws?.close(code, reason)
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
      this.ws?.terminate()
    } else {
      this.ws?.close()
    }
  }

  /**
   * Selectively updates configuration options for the instance.
   *
   * @param {object} [options] - An optional object containing configuration options. This includes both standard WebSocket options and extended options for reconnection, ping, and timeout management.
   *
   * @param {object} [options.reconnect] - Configuration for automatic reconnection. If omitted or null, reconnection is disabled.
   * @param {number} [options.timeout] - The timeout in milliseconds for detecting loss of connection. A timeout event is triggered if no messages are received within this period.
   * @param {object} [options.ping] - Configuration for sending ping messages to maintain the connection.
   * @param {function} [options.createWebSocket] - A function that returns a new WebSocket instance, allowing for custom WebSocket creation logic upon reconnection.
   */
  updateOptions(options) {
    if (options.hasOwnProperty('reconnect')) {
      _.assignIn(this.#optionsExtended.reconnect, options.reconnect)
      this.#reconnectManager.update(options.reconnect)
    }

    if (options.hasOwnProperty('timeout')) {
      this.#optionsExtended.timeout = options.timeout
      this.#timeoutManager.update({ timeout: options.timeout })
    }

    if (options.hasOwnProperty('ping')) {
      _.assignIn(this.#optionsExtended.ping, options.ping)
      this.#pingManager.update(options.ping)
    }

    if (options.hasOwnProperty('createWebSocket')) {
      this.#optionsExtended.createWebSocket = options.createWebSocket
    }
  }

  #registerEventListener(eventName, listener, options, addListenerMethod) {
    // Add listener to listeners array, so that it can be added later when a new WebSocket object is created at reconnect
    this.#listenersWebSocket[eventName] ??= []
    this.#listenersWebSocket[eventName].push({ listener, options, addListenerMethod })
  }

  #attachEventListener(eventName, listener, options, addListenerMethod) {
    if (this.ws) {
      if (options?.once) {
        this.ws.addEventListener(eventName, () => {
          let index = this.#listenersWebSocket[eventName].findIndex((elem) => elem.listener === listener && elem.options?.once)
          if (index > -1) this.#listenersWebSocket[eventName].splice(index, 1)
        }, { once: true })
      }

      this.ws[addListenerMethod](eventName, listener, options)
    }
  }

  /*
    Deregister listener from listeners array
   */
  #deregisterEventListener(eventName, listener) {
    if (!Array.isArray(this.#listenersWebSocket[eventName])) {
      return
    }

    const index = this.#listenersWebSocket[eventName].findIndex((elem) => elem.listener === listener)
    if (index > -1) {
      this.#listenersWebSocket[eventName].splice(index, 1)
    }
  }

  /*
    Remove listener from listeners array
   */
  #detachEventListener(eventName, listener) {
    if (this.ws) {
      this.ws.removeEventListener(eventName, listener)
      if (typeof this.ws.off === 'function') {
        this.ws.off(eventName, listener)
      }
    }
  }

  #isWebSocketOpen() {
    return this.ws?.readyState === WebSocket.OPEN
  }

  #reattachConnectionManagers() {
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
  }

  /*
    Attach registered event listeners to the new underlying WebSocket object
   */
  #reattachEventListeners(){
    for (const [eventName, listeners] of Object.entries(this.#listenersWebSocket)) {
      for (const { listener, options, addListenerMethod } of listeners) {
        this.#attachEventListener(eventName, listener, options, addListenerMethod)
      }
    }
  }

  /*
    Set event handler properties for the new underlying WebSocket object
   */
  #assignCustomEventHandlers() {
    for (const eventHandlerName of ['onopen', 'onmessage', 'onerror', 'onclose']) {
      if (this[eventHandlerName]) {
        this.ws[eventHandlerName] = this[eventHandlerName]
      }
    }
  }

  #cleanupWebSocket() {
    try {
      // Iterate over all event names and their listeners
      Object.keys(this.#listenersWebSocket).forEach(eventName => {
        this.#listenersWebSocket[eventName].forEach(({ listener }) => {
          try {
            this.#detachEventListener(eventName, listener)
          } catch (innerError) {
            // Silently handle any errors encountered while detaching listeners
          }
        })
      })
    } catch (error) {
      // Silently handle any errors that might occur during the detachment process
    }

    try {
      // Close the WebSocket if it's not already closed, using terminate if available for non-open states
      if (this.ws.readyState !== WebSocket.CLOSED) {
        if (this.ws.readyState !== WebSocket.OPEN && typeof this.ws.terminate === 'function') {
          this.ws.terminate()
        } else {
          this.ws.close()
        }
      }
    } catch (error) {
      // Handle or ignore the error silently without using console.log
    }

    // Nullify the WebSocket instance to facilitate garbage collection
    this.ws = null
  }

  /**
   * Initializes class parameters from the constructor arguments.
   * Separates and stores address, protocol, and options for further use in the class.
   * This method sets up the initial configuration based on the provided parameters.
   *
   * @param {string} address - The URL to which the WebSocket should connect.
   * @param {string|string[]} protocol - Optional. One or more subprotocols as a string or array of strings.
   * @param {object} [options] - Optional configuration options for both the WebSocket and extended functionalities like reconnection, ping, etc.
   * @private
   */
  #initializeClassParameters(address, protocol, options) {
    // Store address parameter
    this.#address = address

    // Store protocol parameter
    let allOptions
    if (Array.isArray(protocol) || typeof protocol === 'string') {
      this.#protocol = protocol
    }

    // Determine if the protocol argument is actually representing options (in case the protocol is omitted but options are provided)
    // and appropriately assign the protocol and options to their respective internal properties.
    if (isObject(options)) {
      allOptions = options
    } else if (isObject(protocol)) {
      allOptions = protocol
    } else {
      allOptions = {}
    }

    // Parse and assign options to two categories: WebSocket native options and extended (ForeverWebSocket) options.
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
        // For standard WebSocket options, initialize the storage object if it hasn't been already, then store the options.
        this.#optionsWebSocket ??= {}
        this.#optionsWebSocket[key] = allOptions[key]
      }
    })
  }

  #replicateWebSocketProperties() {
    // Dynamically add properties and methods from the WebSocket class to this instance, excluding reserved names.
    // This ensures the instance mimics the WebSocket API closely, providing a familiar interface to users.
    const manuallyDefinedPropertyNames = ['close', 'send', 'constructor', 'readyState', 'onopen', 'onmessage', 'onerror', 'onclose', 'addEventListener', 'removeEventListener']
    let propertyNames = Object.getOwnPropertyNames(WebSocket.prototype)
    for (const propertyName of propertyNames) {
      if (manuallyDefinedPropertyNames.includes(propertyName)) continue

      if (isMethod(WebSocket.prototype, propertyName)) {
        this[propertyName] = (...args) => this.ws[propertyName](...args)
      } else {
        Object.defineProperty(this, propertyName, {
          get: () => this.ws[propertyName],
          set: (value) => this.ws[propertyName] = value
        })
      }
    }
  }

  /**
   * Sets up the reconnection manager based on the options provided to the constructor.
   * This manager handles automatic reconnection attempts following disconnections,
   * using a strategy defined in the options (e.g., fibonacci or exponential backoff).
   * It is only initialized if reconnection options are provided and enabled.
   *
   * @private
   */
  #setupReconnectManager() {
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
  }

  /**
   * Initializes the ping manager that periodically sends ping messages to keep the WebSocket connection alive.
   * The configuration for ping intervals and the content of ping messages are taken from the constructor's options.
   * This manager is activated only if ping options are explicitly provided.
   *
   * @private
   */
  #setupPingManager() {
    if (this.#optionsExtended.ping) {
      this.#pingManager = createPingFactory(
        {
          interval: this.#optionsExtended.ping.interval,
        },
        () => {
          if (this.readyState === 1) {
            if (typeof this.ping === 'function' && this.#optionsExtended.ping.frame) {
              this.ping(this.#optionsExtended.ping.data, this.#optionsExtended.ping.mask)
            } else {
              this.send(this.#optionsExtended.ping.data)
            }
          }
        }
      )
    }
  }

  /**
   * Creates a timeout manager that monitors the connection for inactivity.
   * If no messages are received within a specified timeout period, a callback is triggered,
   * potentially to close the connection or attempt a reconnection.
   * This functionality is enabled through the options provided to the constructor.
   *
   * @private
   */
  #setupTimeoutManager() {
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
}
