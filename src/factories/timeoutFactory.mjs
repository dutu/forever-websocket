/**
 * Creates a factory function to manage timeout operations. This factory allows starting a timeout,
 * resetting it to delay its trigger, and stopping it entirely. The timeout is used to execute a callback
 * function if the specified period passes without a reset.
 *
 * @param {Object} options - Configuration options for the timeout factory.
 * @param {number} options.timeout - The timeout duration in milliseconds after which the callback should be executed.
 * @param {Function} callbackTimeout - The callback function to execute when the timeout period elapses.
 * @returns {Object} An object with methods to start, reset, and stop the timeout operation.
 *
 * @example
 * const timeoutFactory = createTimeoutFactory({
 *   timeout: 3000
 * }, (lastActiveMts) => {
 *   console.log(`Timeout triggered. Last active at: ${new Date(lastActiveMts).toISOString()}`);
 * });
 *
 * // To start or reset the timeout (e.g., in response to user activity)
 * timeoutFactory.reset();
 *
 * // To stop the timeout
 * timeoutFactory.stop();
 */
export function createTimeoutFactory({ timeout }, callbackTimeout) {
  let _timeout = timeout
  let _callbackTimeout = callbackTimeout
  let timeoutId
  let lastActiveMts

  /**
   * Resets the timeout to prevent the callback from being triggered. This method can be used to
   * indicate activity, postponing the timeout callback. If the timeout is already running, it will
   * be cleared and restarted.
   * @public
   */
  function reset() {
    lastActiveMts = Date.now()
    if (typeof timeoutId?.refresh === 'function') {
      timeoutId.refresh()
    } else {
      clearTimeout(timeoutId)
      timeoutId = setTimeout(() => {
        callbackTimeout(lastActiveMts)
      }, _timeout)
    }

    timeoutId.unref?.()
  }

  /**
   * Starts the timeout operation with the initially specified duration. Essentially an alias to `reset`
   * for starting the timeout operation with fresh state.
   * @public
   */
  function start() {
    reset()
  }

  /**
   * Stops the timeout operation if it is currently running, preventing the callback from being executed.
   * @public
   */
  function stop() {
    clearTimeout(timeoutId)
    timeoutId = null
  }

  /**
   * Update operations parameters.
   * @public
   */
  function update({ timeout }) {
    _timeout = timeout
    reset()
  }

  // Return the public interface
  return Object.freeze({
    start,
    reset,
    stop,
    update,
  })
}
