import { describe, expect, it } from 'vitest'
import { z } from 'zod'
import { newCharacter, newCompanion, readCompanion, type CompanionExtension } from '../character'
import { companions as play } from '../rules'

const shields: CompanionExtension = {
  fields: () => ({ shields: z.coerce.number().catch(0), currentShields: z.coerce.number().catch(0), regen: z.coerce.number().catch(0) }),
  defaults: () => ({ shields: 0, currentShields: 0, regen: 0 }),
  pools: [{ id: 'shields', label: 'sheet.vitals.shields', color: 'text-x', current: 'currentShields', max: 'shields', regen: 'regen' }],
}
const skills = [{ id: 'perception', name: 'Perception', ability: 'wis' as const }, { id: 'stealth', name: 'Stealth', ability: 'dex' as const }]

/** A companion as the live sheet stored it: numbers as strings, no conditions, an unknown key. */
const live = {
  uuid: 'companion-1',
  name: 'Drone',
  str: '8',
  dex: 16,
  con: '12',
  int: 10,
  wis: 14,
  cha: 6,
  profBonus: '3',
  ac: 15,
  hp: 20,
  currentHp: '12',
  shields: 10,
  currentShields: '4',
  regen: 3,
  speed: { walk: 30, fly: '40' },
  senses: { darkvision: 60 },
  skills: ['stealth', 'perception'],
  expertises: ['stealth'],
  savingThrows: ['dex'],
  dmgRes: ['fire'],
  features: [
    { uuid: 'f1', name: 'Zap', type: 'Attack', hit: '5', dmgDieCount: 2, dmgDieType: 6, dmgBonus: 3, dmgType: 'lightning', resourceMax: 3, remainingResources: 2, resourceDisplay: 'Counter' },
    { name: 'Hover', type: 'Bonus Action', description: 'Moves.' },
    { uuid: 'f3', name: 'Odd', type: 'Something' },
  ],
  somethingLive: true,
}

describe('reading companions', () => {
  it('reads the live shape, numbers stored as strings included, and keeps unknown keys', () => {
    const c = readCompanion(live, shields)
    expect(c).toMatchObject({ str: 8, profBonus: 3, currentHp: 12, currentShields: 4, conditions: [], somethingLive: true })
    expect(c.speed).toEqual({ walk: 30, fly: 40 })
    expect(c.features[1]!.uuid).toMatch(/^companion-feature-/)
    expect(c.features[2]!.type).toBe('Action')
  })

  it('makes new companions with the live defaults and the game’s', () => {
    expect(newCompanion(shields, 'c')).toMatchObject({ uuid: 'c', name: 'New Companion', ac: 10, hp: 10, currentHp: 10, speed: { walk: 30 }, shields: 0, features: [] })
  })
})

describe('the stat block', () => {
  const view = play.companionSheet(live, shields, skills)

  it('computes modifiers, saves, skills with expertise, and passive Perception', () => {
    expect(view.abilities.map(a => a.mod)).toEqual([-1, 3, 1, 0, 2, -2])
    expect(view.saves.find(s => s.key === 'dex')).toEqual({ key: 'dex', mod: 6, proficient: true })
    expect(view.skills).toEqual([{ id: 'perception', name: 'Perception', mod: 5, expertise: false }, { id: 'stealth', name: 'Stealth', mod: 9, expertise: true }])
    expect(view.passivePerception).toBe(15)
  })

  it('lists hit points, then the game’s pools the companion has', () => {
    expect(view.pools.map(p => [p.id, p.current, p.max, p.regen])).toEqual([['hp', 12, 20, 0], ['shields', 4, 10, 3]])
    expect(play.companionSheet({ ...live, shields: 0 }, shields).pools.map(p => p.id)).toEqual(['hp'])
  })

  it('groups actions by type with roll notations', () => {
    expect(view.actions.map(g => g.type)).toEqual(['Attack', 'Action', 'Bonus Action'])
    expect(view.actions[0]!.items[0]).toMatchObject({ hit: 5, hitNotation: '1d20+5', damageNotation: '2d6+3' })
  })
})

describe('playing companions', () => {
  it('takes damage through shields, then hit points (not below 0); bypass skips shields', () => {
    const c = readCompanion(live, shields)
    play.damageCompanion(c, 6, shields)
    expect([c.currentShields, c.currentHp]).toEqual([0, 10])
    play.damageCompanion(c, 50, shields)
    expect(c.currentHp).toBe(0)
    const d = readCompanion(live, shields)
    play.damageCompanion(d, 5, shields, { bypass: true })
    expect([d.currentShields, d.currentHp]).toEqual([4, 7])
  })

  it('heals up to the maximum, regains shields by regen, sets pools and resources within bounds', () => {
    const c = readCompanion(live, shields)
    play.healCompanion(c, 100)
    expect(c.currentHp).toBe(20)
    play.regenCompanion(c, shields)
    play.regenCompanion(c, shields)
    expect(c.currentShields).toBe(10)
    play.setCompanionPool(c, shields.pools![0]!, -3)
    expect(c.currentShields).toBe(0)
    play.setCompanionResource(c, 'f1', 9)
    expect(c.features[0]!.remainingResources).toBe(3)
  })

  it('adds, edits and removes companions on a character', () => {
    let ch = newCharacter({ id: 'me5e' }, 'Shep')
    ch = play.addCompanion(ch, readCompanion(live, shields))
    ch = play.editCompanion(ch, 'companion-1', (c) => {
      c.name = 'Drone Mk II'
    }, shields)
    expect((ch.companions[0] as { name: string }).name).toBe('Drone Mk II')
    expect(play.removeCompanion(ch, 'companion-1').companions).toEqual([])
  })
})
