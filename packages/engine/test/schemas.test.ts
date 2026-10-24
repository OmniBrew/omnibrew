import { describe, expect, it } from 'vitest'
import { createGame, defineGame, type GameDefinition } from '../schemas'
import { fromZod } from '../validator/issues'

const base: GameDefinition = defineGame({
  id: 'test',
  name: 'Test',
  namespace: 'tst',
  ruleset: '5e-2014',
  enums: {
    replace: { weaponTypes: ['blaster'] },
    extend: { armorSlots: ['head'], senses: ['infrared-vision'] },
    aliases: { senses: { infrared_vision: 'infrared-vision' } },
  },
  mechanics: [{ type: 'tst:shields', legacy: ['shields'], fields: k => ({ capacity: k.Formula }) }],
  powerSystem: { maxLevel: 5, pools: [{ id: 'slots', kind: 'slots', powerTypes: ['biotic'] }] },
  sources: {
    'class-features': { data: 'class-features' },
    'weapons': { data: 'weapons', itemKind: 'weapon' },
    'armor': { data: 'armor', itemKind: 'armor' },
    'powers': { data: 'powers' },
  },
})

function check(game: ReturnType<typeof createGame>, collection: string, record: unknown) {
  const r = game.schemas[collection]!.safeParse(record)
  return r.success ? [] : fromZod(r.error.issues, { collection, id: 'x' })
}

const feature = (mechanics: unknown[]) => ({ id: 'f', name: 'F', klass: 'adept', level: 1, mechanics })

describe('game definition', () => {
  it('rejects game mechanics outside the game namespace', () => {
    expect(() => createGame({ ...base, mechanics: [{ type: 'shields', fields: () => ({}) }] })).toThrow(/namespaced/)
  })

  it('rejects an alias pointing at a value the enum does not have', () => {
    expect(() => createGame({ ...base, enums: { aliases: { senses: { a: 'nope' } } } })).toThrow(/alias target/)
  })
})

describe('mechanics registry', () => {
  const game = createGame(base)

  it('accepts core and namespaced mechanics', () => {
    expect(check(game, 'class-features', feature([
      { type: 'asi', ability: 'dex', amount: 1 },
      { type: 'tst:shields', capacity: { type: 'flat', value: 5 } },
    ]))).toEqual([])
  })

  it('accepts a legacy spelling and reports it as info', () => {
    const issues = check(game, 'class-features', feature([{ type: 'shields', capacity: { type: 'flat', value: 5 } }]))
    expect(issues).toHaveLength(1)
    expect(issues[0]).toMatchObject({ severity: 'info', category: 'legacy', rule: 'mechanic-legacy-type' })
  })

  it('reports unknown and untyped mechanics as errors with paths', () => {
    const issues = check(game, 'class-features', feature([{ type: 'nope' }, { value: 1 }]))
    expect(issues.map(i => [i.severity, i.rule, i.path])).toEqual([
      ['error', 'mechanic-type-unknown', 'mechanics[0].type'],
      ['error', 'mechanic-type-missing', 'mechanics[1].type'],
    ])
  })

  it('reports unknown keys as warnings and bad values as errors, inside nested toggles', () => {
    const issues = check(game, 'class-features', feature([{
      type: 'bonus-action',
      toggle: { id: 't', whenOn: [{ type: 'resistance', value: 'cold', tpe: 'x' }, { type: 'resistance', value: 'bleed' }] },
    }]))
    expect(issues.map(i => [i.severity, i.path])).toEqual([
      ['warning', 'mechanics[0].toggle.whenOn[0]'],
      ['error', 'mechanics[0].toggle.whenOn[1].value'],
    ])
  })

  it('reads legacy enum values as info', () => {
    const issues = check(game, 'class-features', feature([{ type: 'sense', sense: 'infrared_vision', distance: 30 }]))
    expect(issues).toMatchObject([{ severity: 'info', rule: 'enum-legacy-value' }])
  })
})

describe('items', () => {
  const game = createGame(base)
  const weapon = { id: 'w', name: 'W', kind: 'weapon', weaponType: 'blaster', damage: { dieCount: 1, dieType: 6, type: 'fire' }, range: { short: 30 } }

  it('weapon properties take optional values', () => {
    expect(check(game, 'weapons', { ...weapon, properties: [{ id: 'reload', value: 16 }, { id: 'light' }, { id: 'versatile', value: { dieCount: 1, dieType: 8 } }] })).toEqual([])
    expect(check(game, 'weapons', { ...weapon, properties: ['light'] })[0]).toMatchObject({ severity: 'error', path: 'properties[0]' })
  })

  it('armor is a union on coverage: a suit has an AC, a piece has a slot', () => {
    const armor = { id: 'a', name: 'A', kind: 'armor', armorType: 'heavy' }
    expect(check(game, 'armor', { ...armor, coverage: 'suit', ac: { base: 16 } })).toEqual([])
    expect(check(game, 'armor', { ...armor, coverage: 'piece', slot: 'head' })).toEqual([])
    expect(check(game, 'armor', { ...armor, coverage: 'piece' }).map(i => i.path)).toEqual(['slot'])
  })

  it('the Item union accepts every kind', () => {
    expect(game.Item.safeParse({ ...weapon, properties: [] }).success).toBe(true)
    expect(game.Item.safeParse({ id: 'g', name: 'G', kind: 'gear', gearType: 'x' }).success).toBe(true)
    expect(game.Item.safeParse({ id: 'a', name: 'A', kind: 'armor', armorType: 'light', coverage: 'suit' }).success).toBe(true)
  })
})

describe('power system', () => {
  const game = createGame(base)
  const entry = { castingTime: { length: 1, unit: 'action' }, duration: { length: 0, unit: 'instant' }, concentration: false, range: { short: 30 } }
  const power = { id: 'p', name: 'P', level: 2, powerType: 'biotic', tags: [], casting: [entry, { damage: [{}, { dieCount: 3 }] }] }

  it('takes a full first entry and partial upcast deltas', () => {
    expect(check(game, 'powers', power).filter(i => i.severity === 'error')).toEqual([])
  })

  it('caps power level and slot levels at the game maximum', () => {
    expect(check(game, 'powers', { ...power, level: 6 }).map(i => i.path)).toContain('level')
    const slots = { type: 'powercasting-slots', mod: 'wis', known: false, multiclassConversion: 1, slots: { 6: Array(20).fill(0) } }
    expect(check(game, 'class-features', feature([slots])).map(i => i.rule)).toContain('power-level-range')
  })

  it('casting ability can follow the power alignment', () => {
    const points = { type: 'powercasting-points', mod: { byAlignment: { light: 'wis', dark: 'cha', universal: ['wis', 'cha'] } }, known: false, points: Array(20).fill(1), maxPowerLevel: Array(20).fill(1), multiclassConversion: 1 }
    expect(check(game, 'class-features', feature([points]))).toEqual([])
  })
})
