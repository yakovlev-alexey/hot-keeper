/**
 * This file is meant to be required by CJS applications
 * It persists through hot reloads
 */

// Store for kept variables
const keepStore = new Map();

/**
 * Keep a variable between hot reloads
 * @param {string} name - The name of the variable to keep
 * @param {any} value - The value to keep
 * @returns {void}
 */
function keep(name, value) {
  keepStore.set(name, value);
}

/**
 * Get a kept variable
 * @param {string} name - The name of the variable to retrieve
 * @param {any} defaultValue - Default value if variable doesn't exist
 * @returns {any} - The kept value or defaultValue if not found
 */
function kept(name, defaultValue = undefined) {
  return keepStore.has(name) ? keepStore.get(name) : defaultValue;
}

module.exports = { keep, kept };
