import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { loadRules } from '@omnibrew/engine/rules/load'
import type { Rules } from '@omnibrew/engine/rules'
import { createGame } from '@omnibrew/engine/schemas'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { me5e } from '../game'
import { migrateCharacter } from '../migrate/character'
import { legacyMigrate } from '../migrate/legacy-character'
import { compare, KNOWN } from '../parity/compare'
import { engineSheet } from '../parity/engine-sheet'
import { buildLegacyCharacter, fixtureSpecs } from '../parity/fixtures'
import { legacySheet } from '../parity/legacy-sheet'
import { createLegacyStore, importLegacyMixins, legacyAvailable, legacyPaths, loadLegacyData, type LegacyStore } from '../parity/legacy-store'

/**
 * Parity with the live site (plan/18): every fixture character runs through
 * the live site's own Vuex getters (old content) and through the migrator and
 * the new engine (new content); the two sheets must match field by field,
 * except for the known differences in `parity/compare.ts`, each with its reason.
 *
 * Local only: it needs the old site and its node_modules (`../masseffect-5e`),
 * the live content JSON (`../masseffect-5e-data/docs/v144`) and the content
 * repo (`../omnibrew-me5e-data`) next to this checkout; CI skips it.
 *
 * Fixtures: `fixtures/characters/*.json` are generated (`PARITY_WRITE_FIXTURES=1
 * corepack pnpm vitest run apps/me5e/test/parity.test.ts`), `versions/*.json`
 * are hand-made characters saved before cbVersion 1.0.2.
 */
const workspace = resolve(import.meta.dirname, '../../../..')
const paths = legacyPaths(workspace)
const contentDir = join(workspace, 'omnibrew-me5e-data')
const fixturesDir = join(import.meta.dirname, 'fixtures/characters')
const ready = legacyAvailable(paths) && existsSync(join(contentDir, 'content'))
const write = !!process.env.PARITY_WRITE_FIXTURES

const read = (file: string) => JSON.parse(readFileSync(file, 'utf8')) as Record<string, unknown>
const list = (dir: string) => (existsSync(dir) ? readdirSync(dir).filter(f => f.endsWith('.json')).sort() : [])

describe.skipIf(!ready)('parity with the live site', () => {
  const game = createGame(me5e)
  let store: LegacyStore
  let mixins: Awaited<ReturnType<typeof importLegacyMixins>>
  let rules: Rules
  const known: Record<string, number> = {}

  beforeAll(async () => {
    const data = loadLegacyData(paths.data)
    store = await createLegacyStore(paths, data)
    mixins = await importLegacyMixins(paths.site)
    rules = loadRules(contentDir, me5e, game)
    if (write) {
      const { characterTemplate } = await import(pathToFileURL(join(paths.site, 'mixins/character/template.js')).href)
      mkdirSync(fixturesDir, { recursive: true })
      for (const spec of fixtureSpecs(data)) {
        const character = buildLegacyCharacter(spec, characterTemplate, store, data)
        writeFileSync(join(fixturesDir, `${spec.id}.json`), `${JSON.stringify(character)}\n`)
      }
    }
  }, 600_000)

  afterAll(() => {
    // The counts go into plan/18; print them for the report.
    console.info(`known differences: ${JSON.stringify(known)}`)
  })

  const check = (old: Record<string, unknown>) => {
    store.load(old)
    const want = legacySheet(store, mixins)
    const { character, report } = migrateCharacter(old, { game, content: rules.content })
    expect(report.unknown, 'unknown ids').toEqual([])
    expect(report.dropped, 'dropped values').toEqual([])
    const result = compare(want, engineSheet(rules.sheet(character)), { character: old })
    for (const [id, lines] of Object.entries(result.known)) known[id] = (known[id] ?? 0) + lines.length
    expect(result.unexplained).toEqual([])
  }

  it('has fixtures', () => {
    expect(list(fixturesDir).length).toBeGreaterThan(100)
    expect(list(join(fixturesDir, 'versions')).length).toBeGreaterThan(0)
  })

  for (const file of list(fixturesDir)) {
    it(file.replace(/\.json$/, ''), () => check(read(join(fixturesDir, file))))
  }

  for (const file of list(join(fixturesDir, 'versions'))) {
    it(`old version: ${file.replace(/\.json$/, '')}`, async () => {
      const old = read(join(fixturesDir, 'versions', file))
      // The port of the old migrations matches the old site's own migrator (modulo the timestamp it puts in new uuids).
      const theirs = await store.dispatch('character/migrator', 'migrate', structuredClone(old))
      const ours = legacyMigrate(old, 'NOW')
      const stamp = (c: unknown) => JSON.parse(JSON.stringify(c).replaceAll(/_\d{4}-\d\d-\d\dT[\d:.]+Z"/g, '_NOW"'))
      expect(stamp(ours)).toEqual(stamp(theirs))
      check(ours)
    })
  }

  it('every known difference is still seen', () => {
    for (const k of KNOWN) expect(known[k.id] ?? 0, k.id).toBeGreaterThan(0)
  })
})
