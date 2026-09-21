/*
  Babel emits `.cjs` files (via `--out-file-extension .cjs`) but keeps the relative import
  specifiers from the source, which point to `.mjs` files. The emitted file names and the emitted
  `require()` specifiers therefore do not match. This script rewrites the relative `require()`
  specifiers in `dist/cjs` from `.mjs` to `.cjs`.
*/
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const outputDirectory = path.join(projectRoot, 'dist', 'cjs')

function collectCompiledFiles(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = path.join(directory, entry.name)
    if (entry.isDirectory()) {
      return collectCompiledFiles(entryPath)
    }
    return entry.name.endsWith('.cjs') ? [entryPath] : []
  })
}

const requirePattern = /(require\((["'])(?:\.{1,2}\/[^"']+))\.mjs(\2\))/g

let rewrittenFiles = 0
for (const filePath of collectCompiledFiles(outputDirectory)) {
  const originalContent = fs.readFileSync(filePath, 'utf8')
  const updatedContent = originalContent.replace(requirePattern, '$1.cjs$3')

  if (updatedContent !== originalContent) {
    fs.writeFileSync(filePath, updatedContent)
    rewrittenFiles += 1
  }
}

console.log(`Rewrote .mjs requires to .cjs in ${rewrittenFiles} compiled file(s)`)
