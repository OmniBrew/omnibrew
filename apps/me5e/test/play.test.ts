import { newCharacter, type Character } from '@omnibrew/engine/character'
import { actions, actionSections, choiceView, createRules, setChoice, sheetToggles, toggleAsi, withAnswers, type Rec } from '@omnibrew/engine/rules'
import { createGame } from '@omnibrew/engine/schemas'
import { describe, expect, it } from 'vitest'
import { meCharacter } from '../game/character'
import { me5eDefinition } from '../game/definition'
import { shoulderMounts, toggleShoulderMount } from '../game/play'

/**
 * Playing a sheet (engine rules/actions.ts with ME's `GamePlay`, plan/24): damage
 * through the pools, rests, toggles, equip rules, the power picker and the builder's
 * choices, on records in memory.
 */
const game = createGame(me5eDefinition)
const recs = (collections: Record<string, Rec[]>) => new Map(Object.entries(collections).map(([c, list]) => [c, new Map(list.map(r => [r.id, r]))]))
const perLevel = (f: (l: number) => number) => Array.from({ length: 20 }, (_, i) => f(i + 1))

const content = recs({
  'species': [{ id: 'human', name: 'Human', mechanics: [{ type: 'asi-choice', options: true, selections: 2, total: 2, max: 1 }] }],
  'classes': [
    { id: 'sentinel', name: 'Sentinel', hitDie: 8, profs: { skill: { choices: { items: ['athletics', 'insight', 'stealth'], count: 2 } } }, progression: { abi: [4], subclass: [3] } },
    { id: 'vanguard', name: 'Vanguard', hitDie: 10, profs: {}, progression: { abi: [4], subclass: [3] } },
  ],
  'class-features': [
    { id: 'barrier-vanguard', name: 'Barrier', klass: 'vanguard', level: 1, mechanics: [{ type: 'me:barrier', dieCount: 1, dieType: 8, multiclassConversion: 1, ticks: perLevel(() => 3), uses: perLevel(() => 2) }] },
    { id: 'sentinel-shields', name: 'Shields', klass: 'sentinel', level: 1, mechanics: [{ type: 'me:shields', capacity: { type: 'flat', value: 10 }, regen: { type: 'flat', value: 4 } }] },
    {
      id: 'tech-armor',
      name: 'Tech Armor',
      klass: 'sentinel',
      level: 1,
      mechanics: [
        { type: 'me:tech-armor' },
        { type: 'bonus-action', name: 'Tech Armor', toggle: { id: 'tech-armor', whenOn: [{ type: 'resource', id: 'tech-armor-hp', method: 'set', value: { type: 'flat', value: 7 } }, { type: 'resource', id: 'tech-armor', method: 'add', value: { type: 'flat', value: 1 } }], whenOff: [{ type: 'resource', id: 'tech-armor-hp', method: 'set', value: { type: 'flat', value: 0 } }] } },
      ],
    },
    { id: 'pc-sentinel', name: 'Powercasting', klass: 'sentinel', level: 1, mechanics: [{ type: 'powercasting-points', points: perLevel(l => l * 2), limit: perLevel(() => 1), known: perLevel(() => 2), multiclassConversion: 1, mod: 'int' }, { type: 'use-class-for-power-list', klass: 'vanguard' }] },
    { id: 'cantrips-sentinel', name: 'Cantrips', klass: 'sentinel', level: 1, mechanics: [{ type: 'cantrips', known: perLevel(() => 1) }] },
    { id: 'recovery', name: 'Recovery', klass: 'sentinel', level: 1, mechanics: [{ type: 'regain-all-hit-dice' }, { type: 'min-hit-die-roll', bonus: { type: 'flat', value: 3 } }, { type: 'action', name: 'Overload', resource: { id: 'overload', reset: 'short', max: { type: 'flat', value: 2 } } }] },
  ],
  'powers': [
    { id: 'throw', name: 'Throw', level: 1, powerType: 'biotic', classes: ['vanguard'], casting: [{ castingTime: { unit: 'action', length: 1 } }], advancements: [{ id: 'far', name: 'Far', text: 'Farther.' }] },
    { id: 'overload-power', name: 'Overload', level: 1, powerType: 'tech', classes: ['sentinel'], casting: [{ castingTime: { unit: 'action', length: 1 } }] },
    { id: 'spark', name: 'Spark', level: 0, powerType: 'tech', classes: ['sentinel'], casting: [{ castingTime: { unit: 'action', length: 1 } }] },
    { id: 'pull', name: 'Pull', level: 0, powerType: 'biotic', classes: ['vanguard'], casting: [{ castingTime: { unit: 'action', length: 1 } }] },
  ],
  'weapons': [
    { id: 'rifle', name: 'Rifle', kind: 'weapon', weaponType: 'assault_rifle', slots: 2, damage: { dieCount: 2, dieType: 8, type: 'piercing' }, range: { short: 60, long: 240 }, properties: [] },
    { id: 'pistol', name: 'Pistol', kind: 'weapon', weaponType: 'heavy_pistol', slots: 1, damage: { dieCount: 1, dieType: 8, type: 'piercing' }, range: { short: 30, long: 120 }, properties: [] },
  ],
  'gear': [
    { id: 'program', name: 'Program', kind: 'gear', type: 'omni_tool_program' },
    { id: 'mounts', name: 'Mounts', kind: 'gear', type: 'tool', mechanics: [{ type: 'me:shoulder-mounts', max: 1, slots: 2 }] },
  ],
  'skills': [
    { id: 'athletics', name: 'Athletics', link: 'str' },
    { id: 'insight', name: 'Insight', link: 'wis' },
    { id: 'stealth', name: 'Stealth', link: 'dex' },
  ],
  'actions': [{ id: 'dash', name: 'Dash', type: 'action' }, { id: 'opportunity-attack', name: 'Opportunity Attack', type: 'reaction' }],
  'edges': [],
})
const rules = createRules(game, content)

function character(patch: (c: Character) => void = () => {}) {
  const c = newCharacter({ id: 'me5e', character: meCharacter }, 'Test')
  c.species = 'human'
  c.classes = [{ id: 'sentinel', levels: 4, subclass: null, hitPoints: [8, 5, 5, 5], rolledHitPoints: false, asi: {} }]
  c.abilityScores = { method: 'manual', base: { str: 10, dex: 10, con: 14, int: 16, wis: 10, cha: 10 }, bonus: { str: null, dex: null, con: null, int: null, wis: null, cha: null }, override: { str: null, dex: null, con: null, int: null, wis: null, cha: null } }
  patch(c)
  return rules.characterSchema.parse(c)
}
const sheet = (c: Character) => rules.sheet(c)

describe('a new character', () => {
  it('validates with the game parts filled in', () => {
    expect(rules.characterSchema.safeParse(newCharacter({ id: 'me5e', character: meCharacter })).success).toBe(true)
  })
})

describe('vitals', () => {
  it('lists ME pools in the order damage applies', () => {
    const s = sheet(character(c => c.classes.push({ id: 'vanguard', levels: 1, subclass: null, hitPoints: [6], rolledHitPoints: false, asi: {} })))
    expect(actions.vitalPools(s).map(p => p.id)).toEqual(['barrier', 'tech-armor', 'shields'])
  })

  it('takes damage through tech armor, shields, temp HP, then hit points', () => {
    let c = character(c => {
      c.state.resources['tech-armor-hp'] = 3
      c.state.tempHp = { max: 4, value: 4 }
    })
    expect(sheet(c).hp.max).toBe(31)
    c = actions.damage(sheet(c), 20)
    const g = c.state.game as Record<string, number>
    expect(c.state.resources['tech-armor-hp']).toBe(0)
    expect(g.techArmorMax).toBe(0)
    expect(g.shieldsLost).toBe(10)
    expect(c.state.tempHp).toEqual({ max: 0, value: 0 })
    expect(c.state.hitPointsLost).toBe(3)
  })

  it('bypasses or doubles damage to shields, and regenerates them', () => {
    const base = character()
    expect(actions.damage(sheet(base), 5, { bypass: true }).state.hitPointsLost).toBe(5)
    const doubled = actions.damage(sheet(base), 7, { double: true })
    expect((doubled.state.game as Record<string, number>).shieldsLost).toBe(10)
    expect(doubled.state.hitPointsLost).toBe(2)
    const back = actions.regen(sheet(doubled), 'shields')
    expect((back.state.game as Record<string, number>).shieldsLost).toBe(6)
  })

  it('heals, clearing death saves from 0', () => {
    let c = character(c => {
      c.state.hitPointsLost = 31
      c.state.deathSaves = { successes: 1, failures: 2 }
    })
    c = actions.heal(sheet(c), 5)
    expect(c.state.hitPointsLost).toBe(26)
    expect(c.state.deathSaves).toEqual({ successes: 0, failures: 0 })
    expect(actions.addTempHp(sheet(c), 3).state.tempHp).toEqual({ max: 3, value: 3 })
  })
})

describe('toggles', () => {
  it('run their resource effects', () => {
    const c = character()
    const { toggle } = sheetToggles(sheet(c)).find(t => t.toggle.id === 'tech-armor')!
    const on = actions.setToggle(sheet(c), toggle, true)
    expect(on.state.toggles['tech-armor']).toBe(true)
    expect(on.state.resources['tech-armor-hp']).toBe(7)
    expect(on.state.resources['tech-armor']).toBe(1)
    expect(actions.vitalPools(sheet(on)).find(p => p.id === 'tech-armor')!.current).toBe(7)
    const off = actions.setToggle(sheet(on), toggle, false)
    expect(off.state.resources['tech-armor-hp']).toBe(0)
  })
})

describe('rests', () => {
  it('short: spends hit dice, resets short-rest resources, restores shields and barrier', () => {
    const c = character(c => {
      c.state.hitPointsLost = 10
      c.state.resources.overload = 2
      ;(c.state.game as Record<string, unknown>).shieldsLost = 6
      ;(c.state.game as Record<string, { used: number, ticksUsed: number }>).barrier = { used: 1, ticksUsed: 1 }
    })
    const next = actions.rest(sheet(c), 'short', { hitDice: { sentinel: { used: 2, hp: 9 } } })
    expect(next.state.hitPointsLost).toBe(1)
    expect(next.state.hitDiceUsed.sentinel).toBe(2)
    expect(next.state.resources.overload).toBe(0)
    expect((next.state.game as Record<string, unknown>).shieldsLost).toBe(0)
    expect((next.state.game as Record<string, { used: number }>).barrier.used).toBe(0)
    expect(actions.minHitDieRoll(sheet(c))).toBe(3)
  })

  it('long: full hit points and points, every hit die (regain-all-hit-dice), exhaustion and indoctrination on request', () => {
    const c = character(c => {
      c.state.hitPointsLost = 10
      c.state.pointsUsed['points:tech'] = 3
      c.state.hitDiceUsed.sentinel = 4
      c.state.exhaustion = 2
      ;(c.state.game as Record<string, number>).indoctrination = 1
    })
    const next = actions.rest(sheet(c), 'long', { reduceExhaustion: true, game: { reduceIndoctrination: true } })
    expect(next.state.hitPointsLost).toBe(0)
    expect(next.state.pointsUsed).toEqual({})
    expect(next.state.hitDiceUsed.sentinel).toBe(0)
    expect(next.state.exhaustion).toBe(1)
    expect((next.state.game as Record<string, number>).indoctrination).toBe(0)
  })

  it('casts from points and recovers them', () => {
    const c = character()
    expect(sheet(c).powercasting.points['points:tech']).toMatchObject({ max: 8, used: 0 })
    const cast = actions.cast(sheet(c), 'tech', 1)
    expect(cast.state.pointsUsed['points:tech']).toBe(1)
    expect(actions.rest(sheet(cast), 'short', { recovered: [1] }).state.pointsUsed['points:tech']).toBe(0)
  })
})

describe('conditions', () => {
  it('has exhaustion and indoctrination as graded conditions', () => {
    const s = sheet(character())
    expect(actions.gradientConditions(s).map(g => [g.id, g.max])).toEqual([['exhaustion', 6], ['indoctrinated', 6]])
    const c = actions.setGradient(s, 'indoctrinated', 9)
    expect((c.state.game as Record<string, number>).indoctrination).toBe(6)
    expect(actions.setCondition(c, 'prone', true).state.conditions).toEqual(['prone'])
  })
})

describe('equipment', () => {
  it('limits weapon slots and installed programs', () => {
    let c = character()
    for (const id of ['rifle', 'rifle', 'pistol']) c = actions.addItem(c, { id, kind: 'weapon' })
    for (let i = 0; i < 4; i++) c = actions.addItem(c, { id: 'program', kind: 'gear' })
    const [r1, r2, p] = c.equipment
    c = actions.setEquipped(sheet(c), r1!.uuid, true)
    c = actions.setEquipped(sheet(c), r2!.uuid, true)
    expect(actions.equipCheck(sheet(c), p!.uuid)).toEqual({ key: 'sheet.equip.weapon_slots', params: { max: 4 } })
    const programs = c.equipment.filter(e => e.id === 'program')
    for (const e of programs.slice(0, 3)) c = actions.setEquipped(sheet(c), e.uuid, true)
    expect(actions.equipCheck(sheet(c), programs[3]!.uuid)?.key).toBe('sheet.equip.programs')
  })

  it('mounts a ranged weapon on the shoulder mounts outside the weapon slots', () => {
    let c = character()
    c = actions.addItem(c, { id: 'mounts', kind: 'gear' })
    c = actions.setEquipped(sheet(c), c.equipment[0]!.uuid, true)
    for (const id of ['rifle', 'rifle', 'rifle']) c = actions.addItem(c, { id, kind: 'weapon' })
    const [, a, b, extra] = c.equipment
    c = toggleShoulderMount(sheet(c), extra!.uuid)
    c = actions.setEquipped(sheet(c), a!.uuid, true)
    c = actions.setEquipped(sheet(c), b!.uuid, true)
    const mounts = shoulderMounts(sheet(c))!
    expect(mounts.mounted).toEqual([extra!.uuid])
    expect(c.equipment.find(e => e.uuid === extra!.uuid)!.equipped).toBe(true)
    // A third two-slot weapon: the two in the slots fill them, the mount holds the third.
    expect(actions.equipCheck(sheet(c), extra!.uuid)).toBeNull()
    expect(mounts.weapons.find(w => w.weapon.entry.uuid === a!.uuid)!.mountable).toBe(false)
    c = actions.setEquipped(sheet(c), extra!.uuid, false)
    expect((c.state.game as { shoulderMounts: string[] }).shoulderMounts).toEqual([])
  })
})

describe('the power picker', () => {
  it('offers the class list plus other classes\' lists, with counts', () => {
    let c = character()
    const picker = actions.powerPicker(sheet(c), 'sentinel')
    expect(picker.rows.map(r => r.power.id)).toEqual(['spark', 'pull', 'overload-power', 'throw'])
    expect(picker.limits).toMatchObject({ numPowers: 2, numCantrips: 1 })
    c = actions.togglePower(c, 'sentinel', 'throw')
    c = actions.setPowerAdvancement(c, 'sentinel', 'throw', 'far')
    const after = actions.powerPicker(sheet(c), 'sentinel')
    expect(after.powers).toBe(2)
    expect(after.canLearn).toBe(true)
    expect(sheet(c).powers.find(p => p.id === 'throw')!.advancement).toMatchObject({ id: 'far' })
  })
})

describe('the builder\'s choices', () => {
  const labels = { weapon: (w: string) => w, ability: (a: string) => a }

  it('lists offered choices with what they offer and what is missing', () => {
    const s = sheet(character())
    const views = s.offeredChoices.map(p => choiceView(s, p, labels))
    const skill = views.find(v => v.point.path === 'class/sentinel/skill')!
    expect(skill).toMatchObject({ kind: 'pick', needed: 2, missing: 2 })
    expect(skill.items.map(i => i.value)).toEqual(['athletics', 'insight', 'stealth'])
    const asi = views.find(v => v.point.path === 'species/human/traits/asi/asi')!
    expect(asi).toMatchObject({ kind: 'asi', needed: 2, missing: 2, max: 1 })
  })

  it('stores picks under the choice path, and the sheet reads them', () => {
    let c = character()
    c = setChoice(c, 'class/sentinel/skill', ['athletics', 'stealth'])
    let s = sheet(c)
    const asi = choiceView(s, s.offeredChoices.find(p => p.key === 'asi')!, labels)
    c = setChoice(c, asi.point.path, toggleAsi(asi, 'str'))
    s = sheet(c)
    c = setChoice(c, asi.point.path, toggleAsi(choiceView(s, s.offeredChoices.find(p => p.key === 'asi')!, labels), 'dex'))
    s = sheet(c)
    expect(s.skills.athletics!.proficient).toBe(true)
    expect(s.abilities.str!.total).toBe(11)
    expect(s.abilities.dex!.total).toBe(11)
    expect(s.offeredChoices.map(p => choiceView(s, p, labels)).filter(v => v.kind !== 'hidden').every(v => v.missing === 0 || v.point.path.startsWith('class/sentinel/4'))).toBe(true)
  })
})

describe('the Actions tab', () => {
  it('groups cards by section, with the base actions and powers by casting time', () => {
    const c = actions.togglePower(character(), 'sentinel', 'overload-power')
    const sections = actionSections(sheet(c))
    const titles = (k: keyof typeof sections) => sections[k].map(e => ('card' in e ? e.card.name : 'key' in e.group.title ? e.group.title.key : e.group.title.text))
    expect(titles('action')).toEqual(['sheet.actions.in_combat.action', 'sheet.actions.powers', 'Overload'])
    expect(titles('bonus-action')).toEqual(['Tech Armor'])
    expect(titles('reaction')).toEqual(['sheet.actions.in_combat.reaction'])
  })

  it('folds the roll dialog\'s answers into an attack', () => {
    const card = { name: 'Shot', attack: { bonus: { type: 'flat', value: 2 } }, damage: [{ dieCount: 1, dieType: 8, type: 'piercing' }], options: [{ ask: 'Marked?', hit: 1, damage: 2, dc: 0, addDamage: [{ dieCount: 1, dieType: 6 }] }] }
    const s = sheet(character())
    expect(s.card(withAnswers(card, [false])).hit!.bonus).toBe(2)
    const yes = s.card(withAnswers(card, [true]))
    expect(yes.hit!.bonus).toBe(3)
    expect(yes.damages![0]!.types.piercing).toMatchObject({ 8: 1, 6: 1, bonus: 2 })
  })
})
