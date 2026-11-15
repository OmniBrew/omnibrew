import { existsSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { splitBundle } from '@omnibrew/engine/rules'
import { loadRecords } from '@omnibrew/engine/rules/load'
import { me5e } from '../../../game'
import { contentRoot } from '../../../paths'
import { rulesBundleOptions } from '../../../rules-bundle'

/**
 * The content the migration Lambda converts against (plan/28 §1.1): the rules bundle's
 * records (no prose), written next to the handler before esbuild bundles it. Runs at every
 * deploy, so the Lambda always has the content the site was built from. Needs the content
 * repo: next to this checkout, or `ME5E_CONTENT_DIR` (the Amplify build clones it first).
 */
export function writeMigrationContent(file: string) {
  if (!existsSync(join(contentRoot, 'content'))) throw new Error(`migrate-user needs the content repo at ${contentRoot} (set ME5E_CONTENT_DIR)`)
  const { records } = loadRecords(contentRoot, me5e)
  const { collections } = splitBundle(records, { ...rulesBundleOptions, keepBody: [] })
  writeFileSync(file, JSON.stringify({ collections }))
}
