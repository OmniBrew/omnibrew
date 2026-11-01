import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { defineNuxtModule } from 'nuxt/kit'
import { bundleFiles, splitBundle, type BundleOptions } from '../rules/bundle'
import { loadRecords } from '../rules/load'
import type { GameDefinition } from '../schemas/game'

export interface RulesBundleOptions extends BundleOptions {
  /** The game (its Node definition: the loader reads its sources). */
  game?: GameDefinition
  /** The content repo checkout. */
  contentRoot?: string
}

/**
 * Writes the rules bundle (rules/bundle.ts) for the character pages at build and serves it
 * under `/_rules/`; `runtimeConfig.public.rules` names the files. Without the content
 * checkout (CI's typecheck) the pages get no bundle. In dev, content changes need a restart.
 */
export default defineNuxtModule<RulesBundleOptions>({
  meta: { name: 'omnibrew-rules-bundle', configKey: 'rulesBundle' },
  setup(options, nuxt) {
    const publicRules = { game: '', hash: '', prose: [] as string[] }
    nuxt.options.runtimeConfig.public.rules = publicRules
    const { game, contentRoot } = options
    if (!game || !contentRoot || !existsSync(contentRoot) || nuxt.options._prepare) return

    const { records } = loadRecords(contentRoot, game)
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
    nuxt.options.nitro.publicAssets ??= []
    nuxt.options.nitro.publicAssets.push({ dir, baseURL: '/_rules', maxAge: 60 * 60 * 24 * 365 })
  },
})
