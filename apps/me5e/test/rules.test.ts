import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { createRules, type Rec } from '@omnibrew/engine/rules'
import { createGame } from '@omnibrew/engine/schemas'
import { describe, expect, it } from 'vitest'
import { me5e } from '../game'
import { barrier, capacities, reputation, shields } from '../game/rules'
import { migrateCharacter } from '../migrate/character'

/**
 * ME5e's rules for the engine (`game/rules.ts`), with records in memory.
 * Parity with the live site over the whole content is `parity.test.ts`.
 */
const game = createGame(me5e)
const recs = (collections: Record<string, Rec[]>) => new Map(Object.entries(collections).map(([c, list]) => [c, new Map(list.map(r => [r.id, r]))]))
const perLevel = (f: (l: number) => number) => Array.from({ length: 20 }, (_, i) => f(i + 1))

const content = recs({
  'species': [{ id: 'human', name: 'Human', mechanics: [{ type: 'speed', speed: 'walk', distance: 30 }] }],
  'classes': [
    { id: 'vanguard', name: 'Vanguard', hitDie: 10, profs: {}, progression: { abi: [4] } },
    { id: 'adept', name: 'Adept', hitDie: 6, profs: {}, progression: { abi: [4] } },
    { id: 'engineer', name: 'Engineer', hitDie: 8, profs: {}, progression: { abi: [4] } },
  ],
  'class-features': [
    { id: 'barrier-vanguard', name: 'Barrier', klass: 'vanguard', level: 1, mechanics: [{ type: 'me:barrier', dieCount: 1, dieType: 8, multiclassConversion: 1, ticks: perLevel(l => 2 + Math.floor(l / 6)), uses: perLevel(l => 2 + Math.floor(l / 5)) }] },
    { id: 'barrier-adept', name: 'Barrier', klass: 'adept', level: 1, mechanics: [{ type: 'me:barrier', dieCount: 1, dieType: 6, multiclassConversion: 0.5, ticks: perLevel(() => 2), uses: perLevel(() => 2) }] },
    { id: 'engineer-shields', name: 'Tech Shield', klass: 'engineer', level: 1, mechanics: [{ type: 'me:shields', capacity: { type: 'level', value: 'engineer', multiplier: 2 }, regen: { type: 'flat', value: 2 } }] },
    { id: 'cantrip-boost', name: 'Boost', klass: 'engineer', level: 1, mechanics: [{ type: 'me:cantrip-boost' }] },
  ],
  'armor': [
    { id: 'heavy-chest', name: 'Heavy Chest', kind: 'armor', armorType: 'heavy', coverage: 'piece', slot: 'chest', mechanics: [{ type: 'me:shields', capacity: { type: 'flat', value: 10 }, regen: { type: 'flat', value: 5 } }, { type: 'me:grenade-capacity', value: 2 }] },
    { id: 'body', name: 'Body', kind: 'armor', armorType: 'medium', coverage: 'suit' },
  ],
  'edges': [
    { id: 'REP_convince', name: 'Convince', type: 'benefits', threshold: 15, prereq: { paragon: { min: 10 } }, mechanics: [] },
    { id: 'REP_beguile', name: 'Beguile', type: 'benefits', threshold: 15, prereq: { renegade: { min: 10 } }, mechanics: [] },
  ],
  'skills': [],
})
const rules = createRules(game, content)

function character(patch: Rec = {}) {
  const c = migrateCharacter({
    meta: { version: '1.0.2' },
    species: 'human',
    classes: [{ id: 'vanguard', levels: 6, subclass: null, hitPoints: [10, 6, 6, 6, 6, 6], asi: {} }],
    abilityScores: Object.fromEntries(['str', 'dex', 'con', 'int', 'wis', 'cha'].map(a => [a, { value: 14, other: null, override: null }])),
    selected: [],
    equipment: [],
    currentStats: { barrier: { used: 1, ticksUsed: 1 }, shieldsLost: 4, paragon: 12, renegade: 5, resources: {}, toggles: {} },
    settings: {},
    options: { asiGenMethod: 'manual', grenadeSlots: true, weaponSlots: true },
    ...patch,
  }, { game, content: rules.content }).character
  return c
}

describe('ME rules', () => {
  it('has a handler for every ME mechanic type', () => {
    const missing = game.mechanicTypes.filter(t => !rules.handlers.get(t))
    expect(missing).toEqual([])
  })

  it('computes barrier for one class from its table', () => {
    expect(barrier(rules.sheet(character()))).toEqual({ dieType: 8, dieCount: 1, ticks: { max: 3, used: 1 }, uses: { max: 3, used: 1 } })
  })

  it('computes multiclass barrier from the ME tables (ticks by Σ levels × conversion)', () => {
    const c = character({ classes: [{ id: 'vanguard', levels: 3, subclass: null, hitPoints: [10, 6, 6], asi: {} }, { id: 'adept', levels: 4, subclass: null, hitPoints: [4, 4, 4, 4], asi: {} }] })
    // 3 × 1 + 4 × 0.5 = 5 → 4 ticks; 7 barrier class levels → 4 uses.
    expect(barrier(rules.sheet(c))).toMatchObject({ dieType: 8, ticks: { max: 4 }, uses: { max: 4 } })
  })

  it('picks the best shield source: armor pieces add up against class shields', () => {
    const c = character({
      classes: [{ id: 'engineer', levels: 4, subclass: null, hitPoints: [8, 5, 5, 5], asi: {} }],
      equipment: [{ type: 'armor', id: 'heavy-chest', uuid: 'chest-1', equipped: true, mods: [] }],
    })
    expect(shields(rules.sheet(c))).toEqual({ max: 10, current: 6, regen: 5, source: 'armor' })
  })

  it('lists reputation benefits available at each threshold reached', () => {
    expect(reputation(rules.sheet(character()))).toEqual([{ threshold: 15, options: [{ id: 'REP_convince', name: 'Convince', available: true }, { id: 'REP_beguile', name: 'Beguile', available: false }], selected: null, needsAttention: false }])
  })

  it('counts capacities, unlimited when the option is off', () => {
    const c = character({ equipment: [{ type: 'armor', id: 'heavy-chest', uuid: 'chest-1', equipped: true, mods: [] }] })
    expect(capacities(rules.sheet(c))).toEqual({ grenades: 2, mediGel: 99, thermalClips: 99, weaponSlots: 4 })
  })

  it('adds ME piecewise armor AC and caps Dex by the heaviest piece', () => {
    const chest = rules.sheet(character({ equipment: [{ type: 'armor', id: 'heavy-chest', uuid: 'c', equipped: true, mods: [] }] }))
    expect(chest.ac).toBe(10 + 3)
    const suit = rules.sheet(character({ equipment: [{ type: 'armor', id: 'body', uuid: 'b', equipped: true, mods: [] }] }))
    expect(suit.ac).toBe(10 + 4 + 2)
  })

  it('applies every weapon mod, doubling range once (plan/04 Q18, Q21)', () => {
    const r = createRules(game, new Map([...content, ['weapons', new Map([['rifle', { id: 'rifle', name: 'Rifle', weaponType: 'sniper_rifle', damage: { dieCount: 1, dieType: 10, type: 'piercing' }, properties: [], range: { short: 100, long: 300 } }]])], ['mods', new Map([
      ['barrel', { id: 'barrel', name: 'Barrel', modType: 'weapon', placement: 'barrel', mechanics: [{ type: 'me:weapon-augment', shortRangeMultiplier: 2, longRangeMultiplier: 2 }] }],
      ['scope', { id: 'scope', name: 'Scope', modType: 'weapon', placement: 'body', mechanics: [{ type: 'me:weapon-augment', hitBonus: 1, shortRangeMultiplier: 2, longRangeMultiplier: 2 }] }],
      ['warp', { id: 'warp', name: 'Warp Ammo', modType: 'weapon', placement: 'ammo', mechanics: [{ type: 'me:weapon-augment', toggle: true, name: 'Warp Ammo', damageType: 'necrotic', detonates: true }] }],
    ])]]))
    const c = character({ equipment: [{ type: 'weapon', id: 'rifle', uuid: 'w', equipped: true, mods: { barrel: 'barrel', body: 'scope', ammo: 'warp' } }], currentStats: { ...character().state, toggles: { w: true }, resources: {}, barrier: {} } })
    const s = r.sheet({ ...c, state: { ...c.state, toggles: { w: true } } })
    const card = s.weaponAttacks.attacks.find(a => a.name === 'Rifle')!
    expect(card.range).toMatchObject({ short: 200, long: 600 })
    expect(card.damage[0].type).toBe('necrotic')
    expect(s.card(card).hit?.bonus).toBe(1 + 2)
  })

  it('offers the live custom armor pieces as built-in records', () => {
    expect(rules.content.get('armor', 'ca-arms-heavy-1')).toMatchObject({ slot: 'arms', armorType: 'heavy', coverage: 'piece' })
    expect(rules.content.list('armor').filter(a => a.id.startsWith('ca-'))).toHaveLength(33)
  })

  it('raises the early cantrip flag from me:cantrip-boost', () => {
    const c = character({ classes: [{ id: 'engineer', levels: 1, subclass: null, hitPoints: [8], asi: {} }] })
    expect(rules.sheet(c).hasFlag('cantrip-upcast-early')).toBe(true)
  })
})

describe('character migration', () => {
  const fixture = (name: string) => JSON.parse(readFileSync(join(import.meta.dirname, 'fixtures/characters/versions', `${name}.json`), 'utf8'))

  it('runs the old migrations, maps to the model and validates', () => {
    const { character, report } = migrateCharacter(fixture('pre-1.0.1-soldier'), { game, content: rules.content, now: 'NOW' })
    expect(report.from).toBe('none')
    expect(character.meta.migratedFrom).toBe('me5e-legacy none')
    expect(character.choices.map(c => c.path)).toContain('class/soldier/fighting-style-soldier/fighting-styles')
    expect(character.choices.find(c => c.path === 'class/soldier/6/feats')?.values).toEqual(['alert'])
    expect(character.abilityScores.bonus.cha).toBe(1)
    expect(character.equipment.find(e => e.id === 'omni-gel')).toMatchObject({ uses: 3 })
    expect(character.equipment.find(e => e.kind === 'armor' && e.custom)?.custom).toMatchObject({ name: 'Painted Chestplate', coverage: 'piece', slot: 'chest', armorType: 'medium' })
  })

  it('renames B20 sense keys and reports it', () => {
    const { character, report } = migrateCharacter(fixture('pre-1.0.1-soldier'), { game, content: rules.content, now: 'NOW' })
    expect(character.overrides.senses['infrared-vision']).toBe(30)
    expect(report.renamed.map(r => r.at)).toContain('settings.senses.infrared_vision')
  })

  it('reports ids the content lacks and keeps them, never dropping them', () => {
    const { character, report } = migrateCharacter(fixture('pre-1.0.1-soldier'), { game, content: rules.content, now: 'NOW' })
    expect(character.species).toBe('turian')
    expect(report.unknown.map(u => `${u.collection}:${u.id}`)).toEqual(expect.arrayContaining(['species:turian', 'classes:soldier', 'weapons:m-8-avenger', 'feats:alert']))
    expect(report.dropped).toEqual([])
  })

  it('reports homebrew powers and weapons apart', () => {
    const id = '0c7a5c39-6a1f-4bb0-bd0a-0e3f3d2ad2a1'
    const { report } = migrateCharacter({ ...character(), meta: { version: '1.0.2' }, powers: [{ id, klass: 'vanguard', advancement: null }], equipment: [{ type: 'weapon', id, uuid: 'w', equipped: true, mods: {} }] } as never, { game, content: rules.content })
    expect(report.homebrew.map(h => h.collection)).toEqual(['powers', 'weapons'])
  })

  it('renames the Cain\'s resource only on a character with a Cain', () => {
    const base = { meta: { version: '1.0.2' }, classes: [], abilityScores: {}, selected: [], settings: {}, options: {} }
    const withCain = migrateCharacter({ ...base, equipment: [{ type: 'gear', id: 'm-920-cain', uuid: 'c', equipped: true }], currentStats: { resources: { 'm-560-hydra': 2 } } }, { game, content: rules.content })
    expect(withCain.character.state.resources).toEqual({ 'm-920-cain': 2 })
    const withHydra = migrateCharacter({ ...base, equipment: [{ type: 'gear', id: 'm-560-hydra', uuid: 'h', equipped: true }], currentStats: { resources: { 'm-560-hydra': 2 } } }, { game, content: rules.content })
    expect(withHydra.character.state.resources).toEqual({ 'm-560-hydra': 2 })
  })

  it('renames record ids renamed since the live data', () => {
    const { report } = migrateCharacter({ meta: { version: '1.0.2' }, classes: [], abilityScores: {}, selected: [{ path: 'reputation/15/vehicles', value: [{ type: 'vehicles', value: 'destiny-acension' }] }], settings: {}, options: {}, currentStats: {} }, { game, content: rules.content })
    expect(report.renamed.map(r => r.message)).toContain('destiny-acension → destiny-ascension')
  })

  it('unpacks jsonpack and is re-runnable', async () => {
    const jsonpack = (await import('jsonpack/main')).default
    const old = fixture('1.0.1-adept')
    const a = migrateCharacter(jsonpack.pack(old), { game, content: rules.content, now: 'NOW' })
    const b = migrateCharacter(old, { game, content: rules.content, now: 'NOW' })
    expect(a).toEqual(b)
    expect(a.character.powers).toEqual([{ id: 'throw', class: 'adept', advancement: null }, { id: 'lift', class: 'adept', advancement: null }])
    expect(a.report.notes.map(n => n.at)).toEqual([])
  })
})
