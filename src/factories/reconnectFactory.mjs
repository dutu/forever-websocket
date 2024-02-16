/**
 * Creates a factory function to manage reconnection attempts with customizable strategies.
 * The factory allows scheduling reconnection attempts, stopping them, and resetting the state.
 *
 * @param {Object} options - Configuration options for the reconnect factory.
 * @param {string} [options.strategy='fibonacci'] - The strategy to use for calculating delay ('fibonacci' or 'exponential').
 * @param {number} [options.initialDelay=50] - The initial delay in milliseconds before attempting a reconnect.
 * @param {number} [options.maxDelay=10000] - The maximum delay in milliseconds between reconnect attempts.
 * @param {boolean} [options.randomizeDelay=true] - Whether to randomize the delay to prevent storming.
 * @param {number} [options.factor=1.5] - The factor to use for calculating the next delay in the 'exponential' strategy.
 * @param {Function} callbackStartConnect - Callback to execute when a reconnect attempt is started.
 * @param {Function} callbackStartDelay - Callback to execute when a delay is scheduled before the next reconnect attempt.
 * @returns {Object} An object with methods to manage reconnection attempts.
 *
 * @example
 * const reconnectManager = createReconnectFactory({
 *   strategy: 'fibonacci',
 *   initialDelay: 100,
 *   maxDelay: 5000,
 *   randomizeDelay: true,
 *   factor: 2
 * }, startConnectCallback, startDelayCallback);
 *
 * function startConnectCallback(retryNumber, lastConnectionTimestamp) {
 *   console.log(`Attempting to connect. Retry #: ${retryNumber}, Last connected at: ${lastConnectionTimestamp}`);
 * }
 *
 * function startDelayCallback(retryNumber, delay) {
 *   console.log(`Waiting ${delay}ms before next connect attempt. Retry #: ${retryNumber}`);
 * }
 */
export function createReconnectFactory({ strategy = 'fibonacci', initialDelay = 50, maxDelay = 10000, randomizeDelay = true, factor = 1.5 } = {}, callbackStartConnect, callbackStartDelay) {
  let _strategy = strategy
  let _initialDelay = initialDelay
  let _maxDelay = maxDelay
  let _randomizeDelay = randomizeDelay
  let _factor = factor
  let lastConnectedMts
  let isStopped = false
  let retryNumber = 0
  let previousDelay = 0
  let delay = 0
  let nextDelay = initialDelay
  let timeoutId = null

  /**
   * Schedules the next reconnect attempt based on the current strategy and updates the delay.
   * @private
   */
  function scheduleNextConnect() {
    const getNextDelay = {
      fibonacci: () => delay + previousDelay,
      exponential: () => delay * _factor,
    }

    lastConnectedMts = Date.now()
    isStopped = false
    previousDelay = delay
    delay = nextDelay
    let randomizedDelay = Math.min(delay, _maxDelay)
    randomizedDelay = _randomizeDelay ? Math.round(randomizedDelay * (1 + Math.random() * 0.2)) : randomizedDelay


    callbackStartDelay(retryNumber + 1, randomizedDelay)
    timeoutId = setTimeout(() => {
      retryNumber += 1
      callbackStartConnect(retryNumber, lastConnectedMts)
    }, randomizedDelay)
    timeoutId.unref?.()

    // calculate the delay for the next reconnect
    nextDelay =  getNextDelay[_strategy]()
  }

  /**
   * Resets the state of the reconnection logic, clearing any scheduled attempts and resetting counters.
   * @public
   */
  function reset() {
    isStopped = false
    clearTimeout(timeoutId)
    timeoutId = null
    retryNumber = 0
    previousDelay = 0
    delay = 0
    nextDelay = _initialDelay
    lastConnectedMts = undefined
  }

  /**
   * Stops any ongoing reconnection attempts and prevents new ones from being scheduled.
   * @public
   */
  function stop() {
    isStopped = true
    clearTimeout(timeoutId)
  }

  /**
   * Returns the timestamp of the last successful connection attempt.
   * @public
   * @returns {number|undefined} The last connected timestamp or undefined if never connected.
   */
  function getlastConnectedMts() {
    return lastConnectedMts
  }

  /**
   * Checks if the reconnection process is currently stopped.
   * @public
   * @returns {boolean} True if the reconnection process is stopped, false otherwise.
   */
  function getIsStopped() {
    return isStopped
  }

  /**
   * Retrieves the current retry number for the reconnection attempts.
   * @public
   * @returns {number} The current retry number.
   */
  function getRetryNumber() {
    return retryNumber
  }

  /**
   * Update operations parameters and reset.
   * @public
   */
  function update({ strategy = _strategy, initialDelay = _initialDelay, maxDelay = _maxDelay, randomizeDelay = _randomizeDelay, factor = _factor }) {
    _strategy = strategy
    _initialDelay = initialDelay
    _maxDelay = maxDelay
    _randomizeDelay = randomizeDelay
    _factor = factor
    reset()
  }

  // Return the public interface
  return Object.freeze({
    scheduleNextConnect,
    reset,
    stop,
    update,
    lastConnectedMts: getlastConnectedMts,
    isStopped: getIsStopped,
    retryNumber: getRetryNumber,
  })
}
