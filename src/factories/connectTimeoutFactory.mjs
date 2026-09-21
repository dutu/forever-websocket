/**
 * Creates a factory function to manage a one-shot connection timeout. The timeout is armed before the
 * WebSocket connection is established and is expected to be stopped as soon as the connection is open
 * or has failed. If the timeout elapses, the callback is executed once.
 *
 * @param {Object} options - Configuration options for the connect timeout factory.
 * @param {number} options.timeout - The timeout duration in milliseconds.
 * @param {Function} callbackTimeout - The callback function to execute when the timeout elapses.
 * @returns {Object} An object with methods to start, stop and update the connect timeout.
 *
 * @example
 * const connectTimeoutFactory = createConnectTimeoutFactory({ timeout: 5000 }, () => {
 *   console.log('WebSocket did not connect in time')
 * })
 *
 * connectTimeoutFactory.start()
 *
 * // When the connection is established
 * connectTimeoutFactory.stop()
 */
export function createConnectTimeoutFactory({ timeout }, callbackTimeout) {
  let _timeout = timeout
  let timeoutId = null
  let isRunning = false

  /**
   * Starts (or restarts) the connect timeout.
   * @public
   */
  function start() {
    stop()

    isRunning = true
    timeoutId = setTimeout(() => {
      isRunning = false
      timeoutId = null
      callbackTimeout()
    }, _timeout)

    timeoutId.unref?.()
  }

  /**
   * Stops the connect timeout if it is currently running.
   * @public
   */
  function stop() {
    if (timeoutId !== null) {
      clearTimeout(timeoutId)
      timeoutId = null
    }

    isRunning = false
  }

  /**
   * Updates the timeout duration. If the timeout is currently armed it is re-armed with the new duration.
   * @public
   */
  function update({ timeout = _timeout } = {}) {
    const wasRunning = isRunning
    _timeout = timeout
    if (wasRunning) {
      start()
    }
  }

  /**
   * Checks if the connect timeout is currently armed.
   * @public
   */
  function isActive() {
    return isRunning
  }

  // Return the public interface
  return Object.freeze({
    start,
    stop,
    update,
    isActive,
  })
}
