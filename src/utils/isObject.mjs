/**
 * Checks if the given argument is an object excluding arrays.
 *
 * @param {*} obj - The value to check.
 * @returns {boolean} - True if the value is an object and not null or an array, false otherwise.
 *
 * @example
 *
 * console.log(isObject({})); // true
 * console.log(isObject([])); // false
 * console.log(isObject(null)); // false
 * console.log(isObject(42)); // false
 */
export function isObject(obj) {
  return typeof obj === 'object' && obj !== null && !Array.isArray(obj)
}
