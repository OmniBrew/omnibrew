import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { createGame } from '@omnibrew/engine/schemas'
import { describe, expect, it } from 'vitest'
import { me5e } from '../game'
import { migrateContent } from '../migrate'
import { meLegacy } from '../migrate/legacy'
import { legacyMerge } from '../migrate/legacy-load'
import { legacyTagsToMdc, paragraphsToMarkdown, readableByMdc } from '../migrate/mdc'
import { migrateRecord } from '../migrate/record'

/**
 * The renames the validator's legacy adapter used to apply in memory (plan/04
 * R6), now applied for real by the migration: one case per rename.
 */
const game = createGame(me5e)
const noop = () => {}
const migrate = (collection: string, attributes: Record<string, unknown>, body = '') =>
  migrateRecord(game, collection, attributes, body, noop)

describe('field renames', () => {
  const ctx = (collection: string) => ({ collection, note: noop })

  it('powers: `type` → `powerType`, `mechanics` → `casting`, also in advancements', () => {
    const out = meLegacy({ name: 'P', type: 'biotic', mechanics: [{}], advancements: [{ id: 'a', mechanics: [{}] }] }, ctx('powers'))
    expect(out).toEqual({ name: 'P', powerType: 'biotic', casting: [{}], advancements: [{ id: 'a', casting: [{}] }] })
    expect(Object.keys(out)).toEqual(['name', 'powerType', 'casting', 'advancements'])
  })

  it('items: `type` → `weaponType`, `armorType`, `gearType`, `modType`', () => {
    expect(meLegacy({ type: 'smg' }, ctx('weapons'))).toMatchObject({ weaponType: 'smg' })
    expect(meLegacy({ type: 'light', placement: 'head' }, ctx('armor'))).toMatchObject({ armorType: 'light' })
    expect(meLegacy({ type: 'grenade' }, ctx('gear'))).toEqual({ gearType: 'grenade' })
    expect(meLegacy({ type: 'armor', placement: 'chest' }, ctx('mods'))).toEqual({ modType: 'armor', placement: 'chest' })
  })

  it('weapons: string properties → `{ id }`, `heat` and `versatile` → property values, `addDamages` → `additionalDamage`', () => {
    const out = meLegacy({ type: 'melee', properties: ['versatile', 'light'], heat: 3, versatile: { dieCount: 1, dieType: 10, type: 'slashing' }, addDamages: [{ dieCount: 1, dieType: 6 }] }, ctx('weapons'))
    expect(out).toEqual({
      weaponType: 'melee',
      properties: [{ id: 'versatile', value: { dieCount: 1, dieType: 10, type: 'slashing' } }, { id: 'light' }, { id: 'heat', value: 3 }],
      additionalDamage: [{ dieCount: 1, dieType: 6 }],
    })
  })

  it('armor: `placement` → `coverage: suit`, or `coverage: piece` + `slot`, in place', () => {
    expect(meLegacy({ name: 'S', placement: 'body_armor', type: 'heavy' }, ctx('armor'))).toEqual({ name: 'S', coverage: 'suit', armorType: 'heavy' })
    const piece = meLegacy({ name: 'H', placement: 'head', type: 'light' }, ctx('armor'))
    expect(Object.entries(piece)).toEqual([['name', 'H'], ['coverage', 'piece'], ['slot', 'head'], ['armorType', 'light']])
    expect(() => meLegacy({ placement: 'tail' }, ctx('armor'))).toThrow(/tail/)
  })
})

describe('renamed mechanics and enum values', () => {
  it.each([...game.legacyMechanicTypes])('mechanic `%s` → `%s`, at any depth', (from, to) => {
    const out = migrate('class-features', {
      mechanics: [{ type: from }, { type: 'bonus-action', toggle: { whenOn: [{ type: from }], options: [{ whenOn: [{ type: from }] }] } }],
    }).attributes as { mechanics: Array<{ type: string, toggle?: { whenOn: Array<{ type: string }>, options: Array<{ whenOn: Array<{ type: string }> }> } }> }
    expect(out.mechanics[0]!.type).toBe(to)
    expect(out.mechanics[1]!.toggle!.whenOn[0]!.type).toBe(to)
    expect(out.mechanics[1]!.toggle!.options[0]!.whenOn[0]!.type).toBe(to)
  })

  it.each(Object.entries(game.enums.aliases.formulaKinds!))('formula kind `%s` → `%s`', (from, to) => {
    const out = migrate('edges', { mechanics: [{ type: 'other', damage: [{ dieCount: { type: from } }] }] }).attributes
    expect(out).toEqual({ mechanics: [{ type: 'other', damage: [{ dieCount: { type: to } }] }] })
  })

  it('sense `infrared_vision` → `infrared-vision`, as a value and as a `senses` key', () => {
    expect(migrate('traits', { mechanics: [{ type: 'sense', sense: 'infrared_vision', distance: 60 }] }).attributes)
      .toEqual({ mechanics: [{ type: 'sense', sense: 'infrared-vision', distance: 60 }] })
    expect(migrate('bestiary', { senses: { darkvision: 30, infrared_vision: 60 } }).attributes).toEqual({ senses: { 'darkvision': 30, 'infrared-vision': 60 } })
  })
})

describe('legacy "none" markers', () => {
  it('drop where the field is optional', () => {
    expect(migrate('armor', { name: 'A', type: 'light', placement: 'head', set: false, image: null, andromeda: false }).attributes)
      .toEqual({ name: 'A', armorType: 'light', coverage: 'piece', slot: 'head', andromeda: false })
    expect(migrate('bestiary', { irv: false, savingThrows: false, senses: false, shields: false, skills: false, entries: { actions: [{ name: 'X', dc: false, save: false, damage: false }], legendary: { actions: [{ dc: false }] } } }).attributes)
      .toEqual({ entries: { actions: [{ name: 'X' }], legendary: { actions: [{}] } } })
    expect(migrate('tool-profs', { name: 'T', type: false }).attributes).toEqual({ name: 'T' })
    expect(migrate('gear', { name: 'G', type: 'tool', manufacturer: '', subType: '' }).attributes).toEqual({ name: 'G', gearType: 'tool' })
    expect(migrate('vehicles', { name: 'V', subtype: false, weapons: null }).attributes).toEqual({ name: 'V' })
    expect(migrate('class-features', { mechanics: [{ type: 'powercasting-slots', known: false, prepared: false, notes: null, damage: [{ type: false, dieType: false }], value: { notes: null } }] }).attributes)
      .toEqual({ mechanics: [{ type: 'powercasting-slots', known: false, damage: [{ dieType: false }], value: {} }] })
  })

  it('drop in the base casting entry, but stay in upcasts, advancements and merges, where `false` overrides', () => {
    const out = migrate('powers', {
      type: 'tech',
      reactionQualifier: false,
      mechanics: [{ attack: false, dc: false, damage: false, conditions: false, primes: false, concentration: false, range: { aoe: false } }, { dc: false }],
      advancements: [{ id: 'a', mechanics: [{ damage: false }] }],
    }).attributes
    expect(out).toEqual({
      powerType: 'tech',
      casting: [{ concentration: false, range: {} }, { dc: false }],
      advancements: [{ id: 'a', casting: [{ damage: false }] }],
    })
    expect(migrate('class-features', { mechanics: [{ type: 'augment', merge: { damage: [{ type: null }] } }] }).attributes)
      .toEqual({ mechanics: [{ type: 'augment', merge: { damage: [{ type: null }] } }] })
  })

  it('keep false where it is a value: booleans, hidden labels, no dice', () => {
    const kept = { mechanics: [{ type: 'other', resource: { label: false }, attack: { mod: false }, damage: [{ dieType: false }], dc: { proficient: false } }] }
    expect(migrate('feats', kept).attributes).toEqual(kept)
  })
})

describe('framework tags to MDC', () => {
  it.each([
    ['<me-distance length="30" />', ':distance{length="30"}'],
    ['<me-distance length=\'5\' adj/>', ':distance{length="5" adj}'],
    ['<me-distance length="8" large numOnly />', ':distance{length="8" large num-only}'],
    ['<me-distance length="1" override="extra {metric}"/>', ':distance{length="1" override="extra {metric}"}'],
    ['<me-distance length="0" text-if="metric" override=" divided by three" />', ':distance{length="0" text-if="metric" override=" divided by three"}'],
    ['<me-distance :length="60" />', ':distance{length="60"}'],
    ['<me-weight amount="55" />', ':weight{amount="55"}'],
    ['<me-condition id="primed" sub="necrotic"></me-condition>', ':condition{id="primed" sub="necrotic"}'],
    ['# Cover <v-chip color="info" small>new</v-chip>', '# Cover :change-badge{type="new"}'],
    ['## Armor <v-chip color="warning" text-color="black" small>change</v-chip>', '## Armor :change-badge{type="change"}'],
    ['icons <v-icon>filter_center_focus</v-icon> here', 'icons :icon{name="ic:baseline-filter-center-focus"} here'],
    ['<me-source-reference pages="39" source="basic"></me-source-reference>', '::source-reference{pages="39" source="basic"}\n::'],
    ['<me-source-reference pages="2-3" source="races" :additional="[{source: \'wiki\', pages: \'Asari\'}]"></me-source-reference>', '::source-reference{pages="2-3" source="races" :additional=\'[{"source":"wiki","pages":"Asari"}]\'}\n::'],
    ['<me-edge-list id="commands" />', '::edge-list{type="commands"}\n::'],
    ['<v-card max-width="300">\n\n![A](a.jpg)\n</v-card>', '::figure{max-width="300"}\n![A](a.jpg)\n::'],
    [':::alert\nA tip.\n:::', '::note\nA tip.\n::'],
    ['a\n\n<div class="hr"></div>\n\nb', 'a\n\n---\n\nb'],
    ['<div class="ma-3"><em>hi</em></div>', '<div><em>hi</em></div>'],
    ['<div class="text-subtitle-1">Ability Score Increase</div>\n+2 CON', '**Ability Score Increase**\n\n+2 CON'],
  ])('%s', (from, to) => {
    expect(legacyTagsToMdc(from)).toBe(to)
  })

  it('turns `<p>` paragraphs into markdown, so components inside them render', () => {
    expect(paragraphsToMarkdown('<p>a :distance{length="5"}</p>\n  <p>b</p>')).toBe('a :distance{length="5"}\n\nb')
    expect(paragraphsToMarkdown('<p>a</p> and more')).toBe('<p>a</p> and more')
  })

  it('wraps inline components where MDC would not read them', () => {
    expect(readableByMdc('range :distance{length="60" abbr}/:distance{length="100" abbr}')).toBe('range :distance{length="60" abbr}/[:distance{length="100" abbr}]')
    expect(readableByMdc('ten :distance{length="5" adj}-by-:distance{length="5" adj} panels')).toBe('ten :distance{length="5" adj}-by-[:distance{length="5" adj}] panels')
    expect(readableByMdc('(:distance{length="5"})')).toBe('(:distance{length="5"})')
  })

  it('refuses tags it has no conversion for', () => {
    expect(() => legacyTagsToMdc('<v-alert>hi</v-alert>')).toThrow(/v-alert/)
  })
})

describe('records', () => {
  it('put name first and keep every other key in place', () => {
    const out = migrate('weapons', { rarity: 'common', type: 'smg', name: 'W', heat: 2 })
    expect(Object.keys(out.attributes)).toEqual(['name', 'rarity', 'weaponType', 'properties'])
  })

  it('merge text/en over data/ like the old build: arrays of `{ id }` by id, others by index', () => {
    expect(legacyMerge(
      { a: [{ id: 'x', n: 1 }, { id: 'y', n: 2 }], b: [{ choices: 1 }], c: 1 },
      { a: [{ id: 'y', t: 'Y' }, { id: 'z', t: 'Z' }], b: [{ text: 't' }], c: 2 },
    )).toEqual({
      a: [{ id: 'x', n: 1 }, { id: 'y', n: 2, t: 'Y' }, { id: 'z', t: 'Z' }],
      b: [{ choices: 1, text: 't' }],
      c: 2,
    })
  })
})

/**
 * End to end: a few real records (plus synthetic edge cases) in the old layout
 * migrate to exactly the files in fixtures/migrated. Regenerate those after an
 * intended change with UPDATE_MIGRATION_FIXTURE=1, and review the diff.
 */
describe('migration command', () => {
  const legacy = join(import.meta.dirname, 'fixtures/legacy')
  const expected = join(import.meta.dirname, 'fixtures/migrated')
  const dirs = (dir: string) => readdirSync(dir).filter(name => statSync(join(dir, name)).isDirectory())
  const collections = [...new Set([...dirs(join(legacy, 'data')), ...dirs(join(legacy, 'text/en'))])].filter(c => c !== 'messages')
  const run = (to: string, force = false) => migrateContent({ from: legacy, to, eol: 'lf', collections, force })

  const listFiles = (dir: string): string[] => readdirSync(dir, { recursive: true, encoding: 'utf8' })
    .filter(f => statSync(join(dir, f)).isFile())
    .map(f => f.replaceAll('\\', '/'))
    .sort()

  it('writes the expected files, deterministically', () => {
    const out = mkdtempSync(join(tmpdir(), 'me5e-migrate-'))
    const result = run(out)
    if (process.env.UPDATE_MIGRATION_FIXTURE) {
      rmSync(expected, { recursive: true, force: true })
      for (const [rel, text] of result.files) {
        mkdirSync(dirname(join(expected, rel)), { recursive: true })
        writeFileSync(join(expected, rel), text)
      }
    }
    expect(listFiles(out)).toEqual(listFiles(expected))
    for (const rel of listFiles(expected)) {
      expect(readFileSync(join(out, rel), 'utf8'), rel).toBe(readFileSync(join(expected, rel), 'utf8'))
    }
    // A second run gives the same bytes, and needs --force.
    expect(() => run(out)).toThrow(/--force/)
    run(out, true)
    for (const rel of listFiles(expected)) expect(readFileSync(join(out, rel), 'utf8')).toBe(readFileSync(join(expected, rel), 'utf8'))
  })

  it('writes CRLF when asked', () => {
    const out = mkdtempSync(join(tmpdir(), 'me5e-migrate-'))
    migrateContent({ from: legacy, to: out, eol: 'crlf', collections })
    expect(readFileSync(join(out, 'content/powers/charge.md'), 'utf8')).toMatch(/^---\r\nname: Charge\r\n/)
  })
})
