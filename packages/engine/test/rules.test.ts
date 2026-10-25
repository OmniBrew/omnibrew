import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { characterSchema, upgradeCharacter, type Character } from '../character'
import { sw5eFixture } from '../fixtures/sw5e/game'
import { coreHandlers, createRules, damageText, dieIncrease, HandlerRegistry, type GameRules, type Rec } from '../rules'
import { loadRules } from '../rules/load'
import { coreMechanics, createGame, defineGame } from '../schemas'

/**
 * The rules engine against a small 5e-shaped test game (records in memory),
 * plus the SW5e fixture game from disk: one engine, two games, no game checks.
 * Parity with the live ME5e site is apps/me5e/test/parity.test.ts.
 */
const testRules: GameRules = {
  handlers: [{ type: 'test:flagged', describe: 'raises a flag', flags: ['cantrip-upcast-early'] }],
  armor: {
    base: 10,
    bonus: { suit: { light: 1, medium: 3, heavy: 6 }, chest: { light: 1, medium: 2, heavy: 3 } },
    suitPieces: 1,
    maxDex: { medium: 2, heavy: 0 },
    strength: [{ type: 'heavy', pieces: 1, str: 15 }],
    strengthPenalty: 10,
    proficiencyPenalty: { disadvantage: 1, noPowercasting: 1 },
  },
  powers: {
    classAbility: { wizard: 'int', fighter: false },
    typeAbility: { arcane: 'int' },
    multiclass: {
      slots: [[2, 3, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4], [0, 0, 2, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3]],
      points: Array.from({ length: 20 }, (_, i) => (i + 1) * 2),
      pointLimit: Array.from({ length: 20 }, (_, i) => Math.ceil((i + 1) / 4)),
      pactSlotLevel: Array.from({ length: 20 }, () => 1),
      pactSlots: Array.from({ length: 20 }, () => 1),
    },
    cantripLevels: { normal: [5, 11, 17], early: [0, 5, 11] },
    maxLevel: 2,
  },
  multiclassProfs: { fighter: { armor: { has: ['medium'] } } },
  builtins: { backgrounds: [{ id: 'custom-background', name: 'Custom', mechanics: [] }] },
  families: { collection: 'edges', field: 'type' },
  placeholders: () => ({ answer: 42 }),
  weapons: {
    meleeTypes: ['martial_melee', 'natural-melee'],
    alwaysProficient: ['natural-melee'],
    finesse: ['finesse'],
    weaponOnly: [],
    modSlots: () => [],
    unarmed: { type: 'natural-melee', name: 'Unarmed Strike', damage: { dieCount: 1, dieType: null, type: 'bludgeoning' }, range: { short: 5 }, properties: [], notes: [] },
  },
}

const testGame = createGame(defineGame({
  id: 'test',
  name: 'Test 5e',
  namespace: 'test',
  ruleset: '5e-2014',
  enums: { replace: { weaponTypes: ['martial_melee', 'martial_ranged'] } },
  mechanics: [{ type: 'test:flagged', fields: () => ({}) }],
  powerSystem: { maxLevel: 2, pools: [{ id: 'slots', kind: 'slots', powerTypes: ['arcane'] }, { id: 'points:psi', kind: 'points', powerTypes: ['psi'] }] },
  sources: {},
  rules: testRules,
}))

const recs = (collections: Record<string, Rec[]>) => new Map(Object.entries(collections).map(([c, list]) => [c, new Map(list.map(r => [r.id, r]))]))

const content = recs({
  'species': [
    { id: 'elf', name: 'Elf', mechanics: [{ type: 'asi', ability: 'dex', amount: 2 }, { type: 'speed', speed: 'walk', distance: 30 }, { type: 'asi-choice', options: true }] },
    { id: 'high-elf', name: 'High', type: 'subspecies', species: 'elf', mechanics: [{ type: 'asi', ability: 'int', amount: 1 }] },
    { id: 'dragonkin', name: 'Dragonkin', mechanics: [{ type: 'speed', speed: 'walk', distance: 25 }, { type: 'speed', speed: 'fly', distance: 20 }] },
  ],
  'traits': [
    { id: 'keen-senses', name: 'Keen Senses', species: ['elf'], mechanics: [{ type: 'skill', value: 'perception' }, { type: 'sense', sense: ['darkvision'], distance: 60 }] },
    { id: 'trance', name: 'Trance', species: ['elf'], mechanics: [{ type: 'condition-immunity', value: 'charmed', note: 'magical sleep' }, { type: 'fall-damage', resistance: true }] },
  ],
  'classes': [
    { id: 'wizard', name: 'Wizard', hitDie: 6, profs: { 'saving-throw': { has: ['int', 'wis'] }, 'skill': { choices: { count: 2, items: ['arcana', 'history', 'insight'] } } }, progression: { abi: [4, 8] } },
    { id: 'fighter', name: 'Fighter', hitDie: 10, profs: { armor: { has: ['light', 'medium', 'heavy'] }, weapon: { has: ['martial_melee', 'martial_ranged'] } }, progression: { abi: [4] } },
  ],
  'subclasses': [{ id: 'evoker', name: 'Evoker', klass: 'wizard' }],
  'class-features': [
    { id: 'spellcasting', name: 'Spellcasting', klass: 'wizard', level: 1, mechanics: [
      { type: 'powercasting-slots', mod: 'int', known: false, prepared: { levelMultiplier: 1, modBonus: true }, slots: { 1: [2, 3, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4], 2: [0, 0, 2, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3] }, multiclassConversion: 1 },
      { type: 'cantrips', known: [3, 3, 3, 4, 4, 4, 4, 4, 4, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5] },
    ] },
    { id: 'arcane-ward', name: 'Arcane Ward', klass: 'wizard', level: 2, mechanics: [
      { type: 'other', resource: { reset: 'long', max: { type: 'level', value: 'wizard', multiplier: 2 } }, shortDesc: 'Ward of {{ 2 + level }} hp, DC {{ dc }}, {{ answer }}, {{ unknownKey }}', dc: { save: 'con', mod: 'int' }, toggle: { id: 'ward', whenOn: [{ type: 'ac', bonus: { type: 'flat', value: 2 } }] } },
    ] },
    { id: 'evoker-focus', name: 'Focus', klass: 'wizard', subclass: 'evoker', level: 2, mechanics: [
      { type: 'model-choice', model: 'feats', options: true },
      { type: 'augment', value: { model: 'wizard', id: 'arcane-ward' }, merge: { shortDesc: 'Sculpted ward' } },
    ] },
    { id: 'second-wind', name: 'Second Wind', klass: 'fighter', level: 1, mechanics: [{ type: 'bonus-action', damage: [{ dieCount: 1, dieType: 10, type: 'hp', bonus: { type: 'level', value: 'fighter' } }], resource: { reset: 'short' } }] },
  ],
  'feats': [{ id: 'tough', name: 'Tough', mechanics: [{ type: 'hp', bonus: { type: 'level', multiplier: 2 } }, { type: 'skill-choice', options: true, limit: ['athletics'] }] }],
  'backgrounds': [{ id: 'sage', name: 'Sage', mechanics: [{ type: 'skill', value: 'history' }, { type: 'model-choice', model: 'styles', options: true }] }],
  'edges': [{ id: 'style-defense', name: 'Defense', type: 'styles', mechanics: [{ type: 'ac', bonus: { type: 'flat', value: 1 }, limit: ['light', 'medium', 'heavy'] }] }],
  'skills': ['arcana', 'athletics', 'history', 'insight', 'perception'].map(id => ({ id, name: id, link: id === 'athletics' ? 'str' : id === 'insight' || id === 'perception' ? 'wis' : 'int' })),
  'powers': [
    { id: 'firebolt', name: 'Firebolt', level: 0, powerType: 'arcane', casting: [
      { castingTime: { unit: 'action' }, duration: { length: 0 }, concentration: false, range: { short: 120 }, attack: { type: 'ranged', mod: 'pc', proficient: true }, damage: [{ dieCount: 1, dieType: 10, type: 'fire' }], resource: { reset: 'long' } },
      { damage: [{ dieCount: 2 }] }, { damage: [{ dieCount: 3 }] }, { damage: [{ dieCount: 4 }] },
    ] },
    { id: 'shield-wall', name: 'Shield Wall', level: 1, powerType: 'arcane', advancements: [{ id: 'wide', name: 'Wide', text: '', casting: [{ range: { aoe: { type: 'cube', size: 20 } } }] }], casting: [
      { castingTime: { unit: 'reaction' }, duration: { length: 1, unit: 'round' }, concentration: false, range: { short: 0, aoe: { type: 'cube', size: 10 } }, dc: { save: 'dex', mod: 'pc' }, damage: [{ dieCount: 2, dieType: 6, type: 'force' }] },
      { damage: [{ dieCount: 3 }] },
    ] },
  ],
  'weapons': [
    { id: 'rapier', name: 'Rapier', weaponType: 'martial_melee', damage: { dieCount: 1, dieType: 8, type: 'piercing' }, properties: [{ id: 'finesse' }, { id: 'light' }], range: { short: 5 } },
    { id: 'longsword', name: 'Longsword', weaponType: 'martial_melee', damage: { dieCount: 1, dieType: 8, type: 'slashing' }, properties: [{ id: 'versatile', value: { dieCount: 1, dieType: 10 } }], range: { short: 5 } },
    { id: 'dagger', name: 'Dagger', weaponType: 'martial_melee', damage: { dieCount: 1, dieType: 4, type: 'piercing' }, properties: [{ id: 'light' }], range: { short: 5 } },
  ],
  'weapon-properties': [{ id: 'finesse', name: 'Finesse' }, { id: 'light', name: 'Light' }, { id: 'versatile', name: 'Versatile' }],
  'armor': [
    { id: 'chain', name: 'Chain', kind: 'armor', armorType: 'heavy', coverage: 'suit' },
    { id: 'plate-5e', name: 'Plate', kind: 'armor', armorType: 'heavy', coverage: 'suit', ac: { base: 18 } },
    { id: 'breastplate', name: 'Breastplate', kind: 'armor', armorType: 'medium', coverage: 'piece', slot: 'chest', mechanics: [{ type: 'resistance', value: 'fire', resource: { reset: 'long' } }] },
  ],
  'gear': [{ id: 'grenade', name: 'Grenade', subsets: [{ id: 'grenade-ii', name: 'Grenade II', mechanics: [{ type: 'action', name: 'Grenade II', resource: { reset: 'off' } }] }] }],
  'set-bonuses': [],
})

const character = (patch: Partial<Character> = {}): Character => ({
  version: 1,
  game: 'test',
  name: 'Test',
  experience: { points: 0, milestone: 1, useMilestone: false },
  species: 'high-elf',
  background: 'sage',
  classes: [{ id: 'wizard', levels: 5, subclass: 'evoker', hitPoints: [6, 4, 4, 4, 4], rolledHitPoints: false, asi: { 4: 'asi', 8: null } }],
  abilityScores: {
    method: 'standard',
    base: { str: 8, dex: 14, con: 13, int: 15, wis: 12, cha: 10 },
    bonus: { str: null, dex: null, con: null, int: null, wis: null, cha: 1 },
    override: { str: null, dex: null, con: null, int: null, wis: null, cha: null },
  },
  choices: [
    { path: 'species/high-elf/traits/asi/asi', values: [{ ability: 'con', amount: 1 }] },
    { path: 'class/wizard/skill', values: ['arcana', 'insight'] },
    { path: 'class/wizard/4/asi', values: [{ ability: 'int', amount: 2 }] },
    { path: 'class/wizard/evoker-focus/feats', values: ['tough'] },
    { path: 'class/wizard/evoker-focus/feats/tough/skill', values: ['athletics'] },
    { path: 'background/sage/styles', values: ['style-defense'] },
  ],
  powers: [{ id: 'firebolt', class: 'wizard', advancement: null }, { id: 'shield-wall', class: 'wizard', advancement: 'wide' }],
  equipment: [
    { uuid: 'a-rapier', id: 'rapier', kind: 'weapon', equipped: true },
    { uuid: 'b-dagger', id: 'dagger', kind: 'weapon', equipped: true, bonusHit: 1 },
    { uuid: 'c-longsword', id: 'longsword', kind: 'weapon', equipped: false },
    { uuid: 'd-breastplate', id: 'breastplate', kind: 'armor', equipped: true },
    { uuid: 'e-grenade', id: 'grenade-ii', kind: 'gear', equipped: true },
  ],
  companions: [],
  customFeatures: [],
  details: { characteristics: {}, notes: '' },
  state: { hitPointsLost: 3, tempHp: { max: 0, value: 0 }, hitDiceUsed: {}, deathSaves: { successes: 0, failures: 0 }, inspiration: false, conditions: [], exhaustion: 0, credits: 0, pointsUsed: {}, slotsUsed: { 1: 1 }, resources: {}, toggles: {}, game: {} },
  overrides: {
    hp: null, ac: null, acBonus: 0, speeds: {}, senses: {},
    attack: { all: 0, melee: 0, ranged: 0, power: 0 }, damage: { all: 0, melee: 0, ranged: 0, power: 0 },
    defenses: { resistance: [], immunity: [], vulnerability: [], conditionImmunity: [] },
    profs: { skill: [], expertise: [], savingThrow: [], armor: [], weapon: [], tool: [] },
    powercasting: {}, game: {},
  },
  options: { tashas: false, armorSpeedPenalty: true, armorProficiencyPenalty: true, abilityScoreOnTop: false, game: {} },
  meta: {},
  ...patch,
})

const rules = createRules(testGame, content)

describe('character model', () => {
  it('validates a character and rejects unknown fields', () => {
    const schema = characterSchema()
    expect(schema.safeParse(character()).success).toBe(true)
    expect(schema.safeParse({ ...character(), extra: 1 }).success).toBe(false)
    expect(schema.safeParse({ ...character(), version: 2 }).success).toBe(false)
  })

  it('upgrades step by step and refuses newer versions', () => {
    const steps = { 1: (c: Record<string, unknown>) => ({ ...c, renamed: true }) }
    expect(upgradeCharacter({ version: 1 }, steps, 2)).toEqual({ version: 2, renamed: true })
    expect(upgradeCharacter({ version: 1 })).toEqual({ version: 1 })
    expect(() => upgradeCharacter({ version: 3 })).toThrow(/newer/)
    expect(() => upgradeCharacter({})).toThrow(/no model version/)
  })
})

describe('mechanic collection', () => {
  const sheet = rules.sheet(character())

  it('resolves choices by path, recursing into picked records and families', () => {
    const sources = sheet.mechanics.map(m => m.source)
    expect(sources).toContain('class/wizard/evoker-focus/feats/tough')
    expect(sheet.ofType('ac').map(m => m.source)).toEqual(['background/sage/styles/style-defense'])
    expect(sheet.unusedChoices).toEqual([])
  })

  it('applies augments to the mechanics they name', () => {
    expect(sheet.actions.find(a => a.name === 'Arcane Ward')?.shortDesc).toBe('Sculpted ward')
  })

  it('gives card mechanics their record name and resources their record id (build-data defaults)', () => {
    const ward = sheet.actions.find(a => a.name === 'Arcane Ward')
    expect(ward?.resource.id).toBe('arcane-ward')
    expect(ward?.moreInfo).toEqual({ model: 'class-features', id: 'arcane-ward' })
    expect(sheet.content.get('powers', 'firebolt')?.casting[0].resource.id).toBe('firebolt')
  })

  it('adds toggled mechanics only while the toggle is on', () => {
    const off = rules.sheet(character())
    const on = rules.sheet(character({ state: { ...character().state, toggles: { ward: true } } }))
    expect(on.ac - off.ac).toBe(2)
  })

  it('keeps choices nothing asks for as unused', () => {
    const s = rules.sheet(character({ choices: [...character().choices, { path: 'class/wizard/99/asi', values: [] }] }))
    expect(s.unusedChoices.map(c => c.path)).toEqual(['class/wizard/99/asi'])
  })
})

describe('sheet', () => {
  const sheet = rules.sheet(character())

  it('computes ability scores: base, species, class picks, typed bonus', () => {
    expect(sheet.abilities.dex).toMatchObject({ total: 16, mod: 3, species: 2 })
    expect(sheet.abilities.int).toMatchObject({ total: 18, species: 1, klass: 2 })
    expect(sheet.abilities.con.total).toBe(14)
    expect(sheet.abilities.cha.total).toBe(11)
  })

  it('drops species increases with Tasha\'s option, for one free pick', () => {
    const s = rules.sheet(character({ options: { ...character().options, tashas: true } }))
    expect(s.abilities.dex.total).toBe(14)
    expect(s.abilities.con.total).toBe(14)
  })

  it('computes proficiency, saves and skills', () => {
    expect(sheet.profBonus).toBe(3)
    expect(sheet.saves.int).toEqual({ proficient: true, mod: 7 })
    expect(sheet.saves.str).toEqual({ proficient: false, mod: -1 })
    expect(sheet.skills.arcana).toMatchObject({ proficient: true, mod: 7 })
    expect(sheet.skills.perception).toMatchObject({ proficient: true, mod: 4, passive: 14 })
    expect(sheet.skills.athletics.proficient).toBe(true)
  })

  it('computes HP with Con and features', () => {
    expect(sheet.hp).toEqual({ max: 6 + 16 + 5 * 2 + 10, current: 6 + 16 + 5 * 2 + 10 - 3 })
  })

  it('computes AC from armor pieces, Dex caps, limited bonuses', () => {
    expect(sheet.ac).toBe(10 + 2 + 2 + 1)
    const suit = rules.sheet(character({ equipment: [{ uuid: 'x', id: 'plate-5e', kind: 'armor', equipped: true }] }))
    expect(suit.ac).toBe(18 + 1)
  })

  it('slows a character too weak for heavy armor', () => {
    const s = rules.sheet(character({ equipment: [{ uuid: 'x', id: 'chain', kind: 'armor', equipped: true }] }))
    expect(s.speeds.walk?.distance).toBe(20)
    expect(s.armorPenalties).toEqual({ lacking: 1, disadvantage: true, noPowercasting: true })
  })

  it('reads speeds, senses (listed senses too), defenses', () => {
    expect(rules.sheet(character({ species: 'dragonkin', choices: [] })).speeds).toMatchObject({ walk: { distance: 25 }, fly: { distance: 20 }, swim: null })
    expect(sheet.senses.darkvision).toBe(60)
    expect(sheet.defenses['condition-immunity']).toEqual([{ id: 'charmed', note: 'magical sleep' }])
    expect(sheet.defenses.resistance.map(d => d.id)).toEqual(['fall', 'fire'])
  })

  it('computes powercasting: prepared count, slots, cantrips', () => {
    expect(sheet.powercasting.abilities).toEqual({ wizard: 'int' })
    expect(sheet.powercasting.byClass.wizard).toEqual({ numPowers: 9, maxPowerLevel: 2, numCantrips: 4, learned: false, powercastingType: 'slots' })
    expect(sheet.powercasting.slots).toMatchObject({ 1: { max: 4, used: 1 }, 2: { max: 3, used: 0 } })
  })

  it('uses multiclass tables when multiclassed, and multiclass proficiencies', () => {
    const s = rules.sheet(character({ classes: [...character().classes, { id: 'fighter', levels: 2, subclass: null, hitPoints: [6, 6], rolledHitPoints: false, asi: {} }] }))
    expect(s.powercasting.slots[1]?.max).toBe(4)
    expect(s.profs.armor).toEqual(['medium'])
    expect(s.level).toBe(7)
  })

  it('upcasts cantrips by character level and lists leveled powers at every level, with advancements', () => {
    const firebolt = sheet.powers.find(p => p.id === 'firebolt')!
    expect(firebolt.damage[0]).toMatchObject({ dieCount: 2, dieType: 10 })
    expect(sheet.card(firebolt).hit?.bonus).toBe(7)
    const walls = sheet.powers.filter(p => p.id === 'shield-wall')
    expect(walls.map(p => [p.level, p.upcast, p.damage[0].dieCount, p.range.aoe.size])).toEqual([[1, false, 2, 20], [2, true, 3, 20]])
    expect(sheet.card(walls[0]!).dc).toEqual({ target: 15, save: 'dex' })
  })

  it('upcasts cantrips early when a mechanic raises the flag', () => {
    const s = rules.sheet(character({ classes: [{ ...character().classes[0]!, levels: 1, asi: {} }], species: 'dragonkin', choices: [], equipment: [] }))
    expect(s.powers.find(p => p.id === 'firebolt')?.damage[0].dieCount).toBe(1)
  })

  it('builds weapon attacks: finesse, two-weapon fighting, unarmed strike', () => {
    const attacks = sheet.weaponAttacks
    const rapier = sheet.card(attacks.attacks.find(a => a.name === 'Rapier')!)
    expect(rapier.hit?.bonus).toBe(3)
    expect(rapier.damages?.map(d => d.text)).toEqual(['1d8 + 3 piercing damage'])
    expect(attacks.twf.map(a => a.name)).toEqual(['Rapier', 'Dagger'])
    expect(sheet.card(attacks.twf[1]!).damages?.[0]?.text).toBe('1d4 piercing damage')
    expect(sheet.card(attacks.attacks.find(a => a.name === 'Unarmed Strike')!).damages?.[0]?.text).toBe('1 + -1 bludgeoning damage')
  })

  it('adds a versatile roll from the property value', () => {
    const s = rules.sheet(character({ equipment: [{ uuid: 'l', id: 'longsword', kind: 'weapon', equipped: true }] }))
    expect(s.card(s.weaponAttacks.attacks[0]!).damages?.map(d => d.text)).toEqual(['1d8 + -1 slashing damage', '1d10 + -1 slashing damage'])
  })

  it('fills card placeholders, sums, and leaves unknown keys', () => {
    const ward = sheet.actions.find(a => a.name === 'Arcane Ward')!
    const card = sheet.card({ ...ward, shortDesc: 'Ward of {{ 2 + level }} hp, DC {{ dc }}, {{ answer }}, {{ unknownKey }}, {{ powercastingMod:wizard }}' })
    expect(card.shortDesc).toBe('Ward of 7 hp, DC 15, 42, {{ unknownKey }}, 4')
    expect(sheet.formula(ward.resource.max)).toBe(10)
  })

  it('fills {{ roll }} with the first roll without its type', () => {
    const s = rules.sheet(character({ classes: [{ id: 'fighter', levels: 3, subclass: null, hitPoints: [10, 6, 6], rolledHitPoints: false, asi: {} }], choices: [] }))
    const wind = s.actions.find(a => a.name === 'Second Wind')!
    expect(s.card({ ...wind, shortDesc: 'Regain {{ roll }} hit points ({{ damage }})' }).shortDesc).toBe('Regain 1d10 + 3 hit points (1d10 + 3 hp damage)')
  })

  it('resolves gear subsets and keys equipment resources by the item', () => {
    expect(sheet.actions.find(a => a.name === 'Grenade II')?.resource.id).toBe('e-grenade')
    expect(sheet.ofType('resistance')[0]?.resource.id).toBe('d-breastplate')
  })
})

describe('cards and dice', () => {
  it('steps dice up, past the largest die as +1 per step, leaving rolls without dice alone', () => {
    expect(dieIncrease(8, [4, 6, 8, 10, 12], 1)).toEqual({ dieType: 10, overflow: 0 })
    expect(dieIncrease(12, [4, 6, 8, 10, 12], 2)).toEqual({ dieType: 12, overflow: 2 })
    expect(dieIncrease(false, [4, 6, 8, 10, 12], 1)).toEqual({ dieType: false, overflow: 0 })
  })

  it('prints damage as the live sheet did: dice ascending, then the bonus, types joined', () => {
    expect(damageText({ fire: { 10: 1, 6: 2, bonus: 3 }, cold: { none: 5, bonus: 0 } })).toBe('2d6 + 1d10 + 3 fire damage and 5 cold damage')
  })
})

describe('handlers', () => {
  it('has a handler for every core mechanic type', () => {
    const registry = new HandlerRegistry([])
    const types = [...coreMechanics.map(m => m.type), 'powercasting-slots', 'powercasting-points', 'powercasting-pact']
    expect(types.filter(t => !registry.get(t))).toEqual([])
    expect(coreHandlers.every(h => h.describe.length > 0)).toBe(true)
  })

  it('refuses a type registered twice', () => {
    expect(() => new HandlerRegistry([{ type: 'asi', describe: 'again' }])).toThrow(/twice/)
  })

  it('stores choices under the type without namespace and -choice, or the model', () => {
    const registry = new HandlerRegistry([])
    expect(registry.choiceKey({ type: 'asi-choice' })).toBe('asi')
    expect(registry.choiceKey({ type: 'me:advancements-choice' })).toBe('advancements')
    expect(registry.choiceKey({ type: 'model-choice', model: 'feats' })).toBe('feats')
  })
})

describe('another game: the SW5e fixture', () => {
  const sw = loadRules(join(import.meta.dirname, '../fixtures/sw5e/content'), sw5eFixture, createGame({ ...sw5eFixture, rules: { ...testRules, handlers: [{ type: 'sw:force-points-bonus', describe: 'force points' }], powers: { ...testRules.powers, classAbility: { consular: 'wis' } } } }))
  const consular = character({
    game: 'sw5e-fixture',
    species: null,
    background: null,
    classes: [{ id: 'consular', levels: 5, subclass: null, hitPoints: [6, 4, 4, 4, 4], rolledHitPoints: false, asi: {} }],
    choices: [],
    powers: [{ id: 'force-lightning', class: 'consular', advancement: null }],
    equipment: [{ uuid: 'x', id: 'battle-armor', kind: 'armor', equipped: true }, { uuid: 'y', id: 'blaster-pistol', kind: 'weapon', equipped: true }],
    state: { ...character().state, pointsUsed: { 'points:force': 3 } },
  })
  const sheet = sw.sheet(consular)

  it('casts from the force points pool and caps power level from `maxPowerLevel`', () => {
    expect(sheet.powercasting.points['points:force']).toEqual({ max: 20, used: 3, limit: undefined })
    expect(sheet.powercasting.byClass.consular).toMatchObject({ numPowers: 17, maxPowerLevel: 3, powercastingType: 'points' })
  })

  it('wears a whole suit with its own base AC, and reads valued weapon properties', () => {
    expect(sheet.ac).toBe(16)
    expect(sheet.weaponAttacks.attacks[0]?.name).toBe('Blaster pistol')
  })
})
