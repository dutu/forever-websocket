import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const cjsEntry = path.join(projectRoot, 'dist', 'cjs', 'index.cjs')
const cjsEntryMissing = !fs.existsSync(cjsEntry)

test(
  'the CommonJS build loads and contains no dangling .mjs requires',
  { skip: cjsEntryMissing ? 'run `yarn build` first' : false },
  () => {
    const require = createRequire(import.meta.url)
    const source = fs.readFileSync(cjsEntry, 'utf8')

    assert.doesNotMatch(source, /require\(["'][^"']+\.mjs["']\)/, 'CJS build must not require .mjs files')

    const { ForeverWebSocket } = require(cjsEntry)
    const ws = new ForeverWebSocket('ws://x', { automaticOpen: false, reconnect: null })

    assert.equal(ws.url, 'ws://x')
    assert.equal(ws.binaryType, 'blob')
    assert.doesNotThrow(() => ws.updateOptions({ timeout: 100 }))
    assert.doesNotThrow(() => ws.updateOptions({ timeout: null }))
  }
)
