/**
 * Checks if a property of an object is a method.
 *
 * @param {Object} obj - The object to check.
 * @param {string} propertyName - The name of the property to check.
 * @returns {boolean} - True if the property is a method, false otherwise.
 *
 * @example
 *
 * class Test {
 *   method() {}
 * }
 *
 * const obj = new Test();
 *
 * console.log(isMethod(obj, 'method')); // true
 * console.log(isMethod(obj, 'nonexistent')); // false
 */

export function isMethod(obj, propertyName) {
  const desc = Object.getOwnPropertyDescriptor (obj, propertyName)
  return !!desc && typeof desc.value === 'function'
}
