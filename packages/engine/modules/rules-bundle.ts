import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { defineNuxtModule } from 'nuxt/kit'
import { editorBundleFile, editorCollections } from '../editor/bundle'
import { bundleFiles, splitBundle, type BundleOptions } from '../rules/bundle'
import { loadRecords } from '../rules/load'
import type { GameDefinition } from '../schemas/game'

export interface RulesBundleOptions extends BundleOptions {
  /** The game (its Node definition: the loader reads its sources). */
  game?: GameDefinition
  /** The content repo checkout. */
  contentRoot?: string
  /** Also write the content editor's bundle (plan/33 §1.6): every collection's fields, no bodies. */
  editor?: boolean
}

/**
 * Writes the rules bundle (rules/bundle.ts) for the character pages at build and serves it
 * under `/_rules/`; `runtimeConfig.public.rules` names the files. Without the content
 * checkout (CI's typecheck) the pages get no bundle. In dev, content changes need a restart.
 * With `editor`, it also writes the content editor's bundle (`runtimeConfig.public.editor`).
 */
export default defineNuxtModule<RulesBundleOptions>({
  meta: { name: 'omnibrew-rules-bundle', configKey: 'rulesBundle' },
  setup(options, nuxt) {
    const publicRules = { game: '', hash: '', prose: [] as string[] }
    const publicEditor = { game: '', hash: '' }
    nuxt.options.runtimeConfig.public.rules = publicRules
    nuxt.options.runtimeConfig.public.editor = publicEditor
    const { game, contentRoot } = options
    if (!game || !contentRoot || !existsSync(contentRoot) || nuxt.options._prepare) return

    const { records, derivedIds } = loadRecords(contentRoot, game)
    const { collections, prose } = splitBundle(records, options)
    const rulesJson = JSON.stringify({ game: game.id, collections })
    const hash = createHash('sha256').update(rulesJson).update(JSON.stringify(prose)).digest('hex').slice(0, 12)

    // Not in buildDir: a production build empties it after the modules have run.
    const dir = join(nuxt.options.rootDir, 'node_modules/.cache/omnibrew-rules')
    rmSync(dir, { recursive: true, force: true })
    mkdirSync(dir, { recursive: true })
    writeFileSync(join(dir, bundleFiles.rules(game.id, hash)), JSON.stringify({ game: game.id, hash, collections }))
    for (const [collection, bodies] of Object.entries(prose)) writeFileSync(join(dir, bundleFiles.prose(game.id, hash, collection)), JSON.stringify(bodies))

    Object.assign(publicRules, { game: game.id, hash, prose: Object.keys(prose) })
    if (options.editor) {
      const editorJson = JSON.stringify({ collections: editorCollections(records), derived: derivedIds })
      const editorHash = createHash('sha256').update(editorJson).digest('hex').slice(0, 12)
      writeFileSync(join(dir, editorBundleFile(game.id, editorHash)), JSON.stringify({ game: game.id, hash: editorHash, ...JSON.parse(editorJson) }))
      Object.assign(publicEditor, { game: game.id, hash: editorHash })
    }
    nuxt.options.nitro.publicAssets ??= []
    nuxt.options.nitro.publicAssets.push({ dir, baseURL: '/_rules', maxAge: 60 * 60 * 24 * 365 })
  },
})
