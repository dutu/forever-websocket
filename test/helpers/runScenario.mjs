import { execFileSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const testDirectory = path.dirname(fileURLToPath(import.meta.url))
const projectRoot = path.resolve(testDirectory, '..', '..')
const pnpRuntime = path.join(projectRoot, '.pnp.cjs')
const pnpLoader = path.join(projectRoot, '.pnp.loader.mjs')

/**
 * Runs one of the scenario scripts under `test/scenarios` in a separate Node process. Scenarios are
 * used for cases where the behavior under test throws inside a timer (an uncaught exception would
 * otherwise fail the whole test file).
 *
 * @param {string} scenarioFileName - File name inside `test/scenarios`.
 * @returns {string} The standard output produced by the scenario.
 */
export function runScenario(scenarioFileName) {
  const scenarioPath = path.join(testDirectory, '..', 'scenarios', scenarioFileName)

  return execFileSync(
    process.execPath,
    ['--require', pnpRuntime, '--loader', pnpLoader, scenarioPath],
    { cwd: projectRoot, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }
  )
}
