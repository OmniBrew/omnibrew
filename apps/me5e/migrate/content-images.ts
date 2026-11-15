/**
 * Content image links → the new site (plan/28 §4.1, `04` Q9): `https://data.n7.world/images/…`
 * becomes `/content-images/…`, which the site serves from the content repo's `images/`
 * (`nuxt.config.ts` `nitro.publicAssets`). data.n7.world keeps serving the old repo for the
 * old site; after cutover nothing in the content needs it. Re-runnable; keeps CRLF.
 *
 *   corepack pnpm tsx apps/me5e/migrate/content-images.ts ../omnibrew-me5e-data
 */
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const root = process.argv[2]
if (!root) throw new Error('usage: content-images.ts <content repo>')

const OLD = /https?:\/\/data\.n7\.world\/images\//g
const NEW = '/content-images/'

function* files(dir: string): Generator<string> {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name)
    if (statSync(path).isDirectory()) yield* files(path)
    else if (/\.(?:md|ya?ml)$/.test(name)) yield path
  }
}

let changed = 0
for (const dir of ['content', 'messages']) {
  for (const file of files(join(root, dir))) {
    const text = readFileSync(file, 'utf8')
    if (!OLD.test(text)) continue
    OLD.lastIndex = 0
    // Only the URLs change, so line endings stay as they are.
    writeFileSync(file, text.replace(OLD, NEW))
    changed++
  }
}
console.info(`${changed} files`)
