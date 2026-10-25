import { describe, expect, it } from 'vitest'
import {
  mechanicsOfType, sameAsi, sameSpeeds, summarizeAsi, summarizeImmunities, summarizeMechanics,
  summarizeResistances, summarizeSenses, summarizeSkills, summarizeSpeeds,
} from '../app/utils/mechanics'
import type { Translate } from '../app/utils/powers'

// A stand-in for vue-i18n's `t` over the ME5e messages these summaries use.
const messages: Record<string, string> = {
  'none': 'None',
  'ability_bonus_all': '+1 to all ability scores',
  'abilities.str.title': 'Strength',
  'abilities.dex.title': 'Dexterity',
  'abilities.con.title': 'Constitution',
  'abilities.int.title': 'Intelligence',
  'abilities.wis.title': 'Wisdom',
  'abilities.cha.title': 'Charisma',
  'string_numbers[1]': 'one',
  'string_numbers[2]': 'two',
  'string_numbers[3]': 'three',
  'lists.comma_list[1]': '{0}',
  'lists.comma_list[2]': '{0}, {1}',
  'lists.comma_list[3]': '{0}, {1}, {2}',
  'lists.or_list[2]': '{0} or {1}',
  'lists.or_list[3]': '{0}, {1}, or {2}',
  'lists.and_list[2]': '{0} and {1}',
  'lists.and_list[3]': '{0}, {1}, and {2}',
  'mechanics.asi_choice_any': '+{amount} to one ability score of your choice | +{amount} to {number} different ability scores of your choice',
  'mechanics.asi_choice_limit': '+{amount} to your choice of {abilities} | +{amount} to {number} of {abilities}',
  'mechanics.speed_note': 'Your base {type} speed is {distance} ({note}).',
  'mechanics.falling_damage': 'falling damage',
  'mechanics.expertise': 'expertise',
  'mechanics.skill_choice_any': 'one skill of your choice | {number} skills of your choice',
  'mechanics.skill_choice_limit': '{number} of {skills}',
  'speed_trait': 'Your base {type} speed is {distance}.',
  'speeds.walk.text': 'walking',
  'speeds.walk.title': 'Walking',
  'speeds.fly.text': 'flying',
  'speeds.fly.title': 'Flying',
  'senses.darkvision': 'darkvision',
  'senses.infrared_vision': 'infrared vision',
  'senses.truesight': 'truesight',
  'damage_types.cold': 'cold',
  'damage_types.lightning': 'lightning',
  'damage_types.poison': 'poison',
}
const t = ((key: string, a?: unknown, b?: unknown) => {
  let text = messages[key] ?? key
  const plural = typeof a === 'number' ? a : typeof b === 'number' ? b : undefined
  if (text.includes(' | ')) {
    const forms = text.split(' | ')
    text = forms.length === 3 ? forms[Math.min(plural ?? 2, 2)]! : forms[plural === 1 ? 0 : 1]!
  }
  const named = Array.isArray(a) ? Object.fromEntries(a.map((v, i) => [i, v])) : typeof a === 'object' ? { n: plural, ...a as object } : { n: plural }
  return text.replace(/\{(\w+)\}/g, (_, k: string) => String((named as Record<string, unknown>)[k]))
}) as Translate
const meters = (feet: number) => `${feet * 0.4} meters`

describe('ability score increases', () => {
  it('lists fixed increases, and +1 to all six as one phrase', () => {
    expect(summarizeAsi(t, [{ type: 'asi', ability: 'cha', amount: 2 }, { type: 'asi', ability: 'con', amount: 1 }, { type: 'speed', speed: 'walk', distance: 30 }]))
      .toBe('+2 Charisma, +1 Constitution')
    const human = ['str', 'dex', 'con', 'int', 'wis', 'cha'].map(ability => ({ type: 'asi', ability, amount: 1 }))
    expect(summarizeAsi(t, human)).toBe('+1 to all ability scores')
    expect(summarizeAsi(t, human.slice(3))).toBe('+1 Intelligence, +1 Wisdom, +1 Charisma')
    expect(summarizeAsi(t, [...human.slice(1), { type: 'asi', ability: 'wis', amount: 1 }])).not.toBe('+1 to all ability scores')
    // A subspecies' increase adds to its species'.
    expect(summarizeAsi(t, [{ type: 'asi', ability: 'wis', amount: 1 }, { type: 'asi', ability: 'int', amount: 1 }, { type: 'asi', ability: 'wis', amount: 1 }]))
      .toBe('+2 Wisdom, +1 Intelligence')
    expect(summarizeAsi(t, [])).toBe('')
    expect(summarizeAsi(t, undefined)).toBe('')
  })

  it('describes choices: any ability, a limited list, several picks', () => {
    expect(summarizeAsi(t, [{ type: 'asi-choice', options: true }])).toBe('+1 to one ability score of your choice')
    expect(summarizeAsi(t, [{ type: 'asi-choice', options: true, total: 2, selections: 2, max: 1 }])).toBe('+1 to two different ability scores of your choice')
    expect(summarizeAsi(t, [{ type: 'asi-choice', limit: ['str', 'dex'], options: true }])).toBe('+1 to your choice of Strength or Dexterity')
    expect(summarizeAsi(t, [{ type: 'asi-choice', limit: ['int', 'dex', 'wis'], amount: 1, selections: 2 }])).toBe('+1 to two of Intelligence, Dexterity, and Wisdom')
    expect(summarizeAsi(t, [{ type: 'asi', ability: 'con', amount: 2 }, { type: 'asi-choice', options: true, limit: ['str', 'dex'] }]))
      .toBe('+2 Constitution, +1 to your choice of Strength or Dexterity')
  })

  it('compares two records\' increases in any order', () => {
    const a = [{ type: 'asi', ability: 'str', amount: 2 }, { type: 'asi', ability: 'con', amount: 1 }]
    expect(sameAsi(a, [...a].reverse())).toBe(true)
    expect(sameAsi(a, [{ type: 'asi', ability: 'str', amount: 2 }])).toBe(false)
    expect(sameAsi(a, [{ type: 'asi', ability: 'str', amount: 1 }, { type: 'asi', ability: 'con', amount: 1 }])).toBe(false)
    expect(sameAsi([{ type: 'asi-choice', limit: ['str', 'dex'] }], [{ type: 'asi-choice', limit: ['dex', 'str'] }])).toBe(true)
    expect(sameAsi(undefined, [])).toBe(true)
  })
})

describe('speeds and senses', () => {
  const speeds = [
    { type: 'speed', speed: 'walk', distance: 30 },
    { type: 'speed', speed: 'fly', distance: 5, note: 'while lifted or in zero-g' },
    { type: 'speed-note', note: 'Ignore difficult terrain caused by high gravity' },
  ]

  it('reads speeds as the species trait sentences, or short', () => {
    expect(summarizeSpeeds(t, speeds, meters, true)).toEqual([
      'Your base walking speed is 12 meters.',
      'Your base flying speed is 2 meters (while lifted or in zero-g).',
      'Ignore difficult terrain caused by high gravity',
    ])
    expect(summarizeSpeeds(t, speeds.slice(0, 2), meters)).toEqual(['Walking 12 meters', 'Flying 2 meters (while lifted or in zero-g)'])
  })

  it('compares speeds by kind and distance', () => {
    expect(sameSpeeds([speeds[0]], [{ type: 'speed', speed: 'walk', distance: 30 }])).toBe(true)
    expect(sameSpeeds([speeds[0]], [{ type: 'speed', speed: 'walk', distance: 25 }])).toBe(false)
    expect(sameSpeeds(speeds, [speeds[0]])).toBe(false)
  })

  it('names senses with their range or note', () => {
    expect(summarizeSenses(t, [
      { type: 'sense', sense: 'darkvision', distance: 60 },
      { type: 'sense', sense: 'infrared-vision', distance: 60 },
      { type: 'sense', sense: 'truesight', note: 'when you take the Search action' },
    ], meters)).toEqual(['darkvision 24 meters', 'infrared vision 24 meters', 'truesight (when you take the Search action)'])
  })
})

describe('defenses and skills', () => {
  it('lists resistances, falling damage included, and immunities', () => {
    const mechanics = [
      { type: 'resistance', value: 'lightning', note: 'to your hit points' },
      { type: 'resistance', value: 'cold' },
      { type: 'fall-damage', resistance: true },
      { type: 'fall-damage', reduce: { dieCount: 4, dieType: 6 } },
      { type: 'immunity', value: 'poison' },
      { type: 'condition-immunity', value: 'prone', note: 'if the device works' },
    ]
    expect(summarizeResistances(t, mechanics)).toEqual(['lightning (to your hit points)', 'cold', 'falling damage'])
    expect(summarizeImmunities(t, mechanics)).toEqual(['poison', 'prone (if the device works)'])
  })

  it('names skills and skill choices', () => {
    const name = (id: string) => id.toUpperCase()
    expect(summarizeSkills(t, [
      { type: 'skill', value: 'stealth' },
      { type: 'skill', value: 'perception', expertise: true },
      { type: 'skill-choice', options: true, limit: ['insight', 'perception'] },
      { type: 'skill-choice', options: true, selections: 2 },
      { type: 'skill-choice', options: true, selections: 2, limit: ['athletics', 'stealth', 'survival'] },
    ], name)).toEqual(['STEALTH', 'PERCEPTION (expertise)', 'INSIGHT or PERCEPTION', 'two skills of your choice', 'two of ATHLETICS, STEALTH, and SURVIVAL'])
  })

  it('summarizes a list of mechanics by kind, skipping kinds it lacks and unknown types', () => {
    const lineage = [
      { type: 'asi', ability: 'dex', amount: 2 },
      { type: 'speed', speed: 'fly', distance: 30 },
      { type: 'fall-damage', resistance: true },
      { type: 'sense', sense: 'infrared-vision', distance: 60 },
      { type: 'me:shields', capacity: { type: 'flat', value: 5 } },
      'not a mechanic',
    ]
    expect(summarizeMechanics(t, lineage, meters)).toEqual([
      { key: 'asi', label: 'ability_score_increase_title', text: '+2 Dexterity' },
      { key: 'speeds', label: 'speed_title', text: 'Flying 12 meters' },
      { key: 'senses', label: 'senses_title', text: 'infrared vision 24 meters' },
      { key: 'resistances', label: 'npc.damage_resistances', text: 'falling damage' },
    ])
    expect(mechanicsOfType(lineage, 'sense', 'speed')).toHaveLength(2)
    expect(summarizeMechanics(t, null, meters)).toEqual([])
  })
})
