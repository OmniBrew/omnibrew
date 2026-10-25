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
    const sheet = rules.sheet(character)
    const multiModWeapons = sheet.equipment.weapons.filter(w => w.mechanics.filter(m => m.type === 'me:weapon-augment').length > 1).map(w => w.entry.uuid)
    const result = compare(want, engineSheet(sheet), { character: old, multiModWeapons })
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

  // Real characters (plan/04 Q20): only with PARITY_SAMPLE=<DynamoDB scan JSON outside the repo>; prints a summary
  // (PARITY_SAMPLE_OUT=<file> writes it) and never stores a character.
  it.runIf(!!process.env.PARITY_SAMPLE)('a sample of saved characters', async () => {
    const items = (JSON.parse(readFileSync(process.env.PARITY_SAMPLE!, 'utf8')) as { Items: Array<{ data: { S: string } }> }).Items
    const summary = { characters: items.length, compared: 0, notReady: 0, migrationFailed: [] as string[], legacyFailed: [] as string[], engineFailed: [] as string[], versions: {} as Record<string, number>, known: {} as Record<string, number>, unexplained: {} as Record<string, number>, report: { unknown: {} as Record<string, number>, homebrew: 0, dropped: {} as Record<string, number> }, examples: {} as Record<string, string> }
    const jsonpack = (await import('jsonpack/main')).default
    items.forEach((item, i) => {
      let old: Record<string, unknown>
      try {
        const raw = jsonpack.unpack(item.data.S) as Record<string, unknown>
        const version = (raw.meta as { version?: string } | undefined)?.version ?? 'none'
        summary.versions[version] = (summary.versions[version] ?? 0) + 1
        old = version === '1.0.2' ? raw : legacyMigrate(raw, 'NOW')
      }
      catch (e) {
        summary.migrationFailed.push(`#${i}: ${(e as Error).message.slice(0, 120)}`)
        return
      }
      const ready = !!old.species && (old.classes as unknown[] | undefined)?.length && Object.values(old.abilityScores as Record<string, { value: unknown }>).every(a => a?.value)
      if (!ready) {
        summary.notReady += 1
        return
      }
      let want
      try {
        store.load(old)
        want = legacySheet(store, mixins)
      }
      catch (e) {
        summary.legacyFailed.push(`#${i}: ${(e as Error).message.slice(0, 120)}`)
        return
      }
      try {
        const { character, report } = migrateCharacter(old, { game, content: rules.content })
        for (const u of report.unknown) summary.report.unknown[`${u.collection}:${u.id}`] = (summary.report.unknown[`${u.collection}:${u.id}`] ?? 0) + 1
        for (const d of report.dropped) summary.report.dropped[`${d.at.replaceAll(/\[\d+\]/g, '[]')}: ${d.message.slice(0, 60)}`] = (summary.report.dropped[`${d.at.replaceAll(/\[\d+\]/g, '[]')}: ${d.message.slice(0, 60)}`] ?? 0) + 1
        summary.report.homebrew += report.homebrew.length
        const sheet = rules.sheet(character)
        const multiModWeapons = sheet.equipment.weapons.filter(w => w.mechanics.filter(m => m.type === 'me:weapon-augment').length > 1).map(w => w.entry.uuid)
        const result = compare(want, engineSheet(sheet), { character: old, multiModWeapons })
        summary.compared += 1
        for (const [id, lines] of Object.entries(result.known)) summary.known[id] = (summary.known[id] ?? 0) + lines.length
        // Group unexplained lines by field and shape, without character text.
        for (const line of result.unexplained) {
          const key = line.replaceAll(/_[\dTZ:.-]+/g, '_*').replaceAll(/\d+/g, '#').slice(0, 160)
          summary.unexplained[key] = (summary.unexplained[key] ?? 0) + 1
          if (process.env.PARITY_SAMPLE_EXAMPLES) (summary.examples[key] ??= `#${i} ${line}`)
        }
      }
      catch (e) {
        summary.engineFailed.push(`#${i}: ${(e as Error).stack?.split('\n').slice(0, 3).join(' ').slice(0, 200)}`)
      }
    })
    const text = JSON.stringify(summary, null, 2)
    if (process.env.PARITY_SAMPLE_OUT) writeFileSync(process.env.PARITY_SAMPLE_OUT, text)
    else console.info(text)
  }, 600_000)

  it('every known difference is still seen', () => {
    for (const k of KNOWN) expect(known[k.id] ?? 0, k.id).toBeGreaterThan(0)
  })
})
