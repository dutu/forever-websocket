/**
 * Creates a factory function to manage periodic ping operations. The factory provides methods to start and stop the pinging process at a defined interval.
 *
 * @param {Object} options - Configuration options for the ping factory.
 * @param {number} options.interval - The interval in milliseconds at which the ping callback should be called.
 * @param {Function} callbackPing - The callback function to execute on each ping interval.
 * @returns {Object} An object with methods to start and stop the ping process.
 *
 * @example
 * const pingFactory = createPingFactory({
 *   interval: 1000
 * }, () => {
 *   console.log('Ping at interval of 1000ms');
 * });
 *
 * // To start pinging
 * pingFactory.start();
 *
 * // To stop pinging
 * pingFactory.stop();
 */
export function createPingFactory({ interval }, callbackPing) {
  let intervalId

  /**
   * Starts the periodic ping operation using the defined interval.
   * If the ping process is already running, it will continue without interruption.
   * @public
   */
  function start() {
    intervalId = setInterval(() => {
      callbackPing()
    }, interval)

    // Optional call to unref to allow the program to exit if this is the only active operation in the event loop.
    intervalId.unref?.()
  }

  /**
   * Stops the periodic ping operation if it is currently running.
   * @public
   */
  function stop() {
    clearInterval(intervalId)
  }

  // Return the public interface
  return Object.freeze({
    start,
    stop,
  })
}
