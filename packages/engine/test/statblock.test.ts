import { describe, expect, it } from 'vitest'
import type { Translate } from '../app/utils/powers'
import {
  abilityModifier, abilityScoreText, attackDescription, averageRoll, challengeText, conditionsText, creatureKindText,
  damageImmunities, damageRollText, entryListKind, entryTitle, groupDigits, hitPointsText, inlineTokens, innatePowerLines, itemUseLines,
  leveledPowerLines, modifierText, passivePerception, saveDc, savingThrowsText, sensesText, shownEntries, skillsText,
  sortActions, sortLegendary, speedText, statBlockRefIds, weaponAttackEntry, type StatBlockRules, type StatWeapon,
} from '../app/utils/statblock'

// A stand-in for vue-i18n's `t` over the ME5e messages the stat block uses
// (linked messages written out). Plurals pick 2 or 3 choices as vue-i18n does.
const messages: Record<string, string> = {
  'none': 'None',
  'lists.comma_list[1]': '{0}',
  'lists.comma_list[2]': '{0}, {1}',
  'lists.comma_list[3]': '{0}, {1}, {2}',
  'lists.and_list[1]': '{0}',
  'lists.and_list[2]': '{0} and {1}',
  'lists.sentences[1]': '{0}.',
  'lists.sentences[2]': '{0}. {1}.',
  'lists.sentences[3]': '{0}. {1}. {2}.',
  'dice': '{dieCount}d{dieType}',
  'dice_average': '{avg} ({formula})',
  'dice_formulas.plus': '{dice} + {n}',
  'dice_formulas.minus': '{dice} - {n}',
  'dice_formulas.base': '{dice}',
  'digit_separator': ',',
  'markdown_label': '{label}:',
  'sizes.small': 'small',
  'npc.types.synthetic': 'Synthetic',
  'alignments.nn': 'neutral',
  'abilities.dex.abbr': 'DEX',
  'abilities.wis.abbr': 'WIS',
  'abilities.str.title': 'Strength',
  'passive_perception_title': 'Passive Perception',
  'senses.infrared_vision_title': 'Infrared Vision',
  'speeds.burrow.label': 'burrow',
  'damage_types.poison_title': 'Poison',
  'damage_types.psychic_title': 'Psychic',
  'damage_types.bludgeoning_damage': 'bludgeoning damage',
  'damage_types.acid_damage': 'acid damage',
  'damage_types.piercing_damage': 'piercing damage',
  'npc.cr_text': '{n} ({xp} xp)',
  'npc.feature_w_limitation': '{name} ({limitation})',
  'npc.uses_per_day': '{amount}/Day',
  'npc.uses': '0 uses | {n} use | {n} uses',
  'npc.recharges[2]': 'Recharge {0}-{1}',
  'npc.rest_recharge.short': 'Recharges after a Short or Long Rest',
  'npc.legendary_cost': 'Costs {n} Actions',
  'npc.to_hit.positive': '+{n} to hit',
  'npc.to_hit.negative': '-{n} to hit',
  'npc.range_types.reach': 'reach {range}',
  'npc.range_types.range': 'range ({short}/{long})',
  'npc.target_types.one': 'one target',
  'npc.attack_types.melee': 'Melee Weapon Attack',
  'npc.attack_types.ranged': 'Ranged Weapon Attack',
  'npc.hit_title': 'Hit',
  'npc.miss_title': 'Miss',
  'npc.save_dc': 'DC {dc} {ability} saving throw',
  'npc.at_will': 'At Will',
  'npc.higher_power_level': 'as a {level_adj} power',
  'npc.slots': '{n} slot | {n} slots',
  'level_adj': '{nth}-level',
  'level_nth': '{nth} level',
  'ordinal_numbers[1]': '1st',
  'ordinal_numbers[2]': '2nd',
  'class_feature_columns.cantrips': 'Cantrips',
  'marks.iii': 'III',
}
const t = ((key: string, a?: unknown, b?: unknown) => {
  let text = messages[key] ?? key
  const plural = typeof a === 'number' ? a : typeof b === 'number' ? b : undefined
  const choices = text.split(' | ')
  if (choices.length > 1) {
    const n = plural ?? 1
    text = choices.length === 2 ? choices[n === 1 ? 0 : 1]! : choices[Math.min(n, 2)]!
  }
  const named: Record<string, unknown> = Array.isArray(a) ? Object.fromEntries(a.map((v, i) => [i, v])) : typeof a === 'object' && a ? a as Record<string, unknown> : {}
  if (plural !== undefined) named.n ??= plural
  return text.replace(/\{(\w+)\}/g, (_, k: string) => String(named[k]))
}) as Translate

const ft = (feet: number | undefined) => `${feet}ft`
// The FENRIS Mech.
const scores = { str: 12, dex: 16, con: 11, int: 10, wis: 14, cha: 8 }

describe('stat block numbers', () => {
  it('works out ability modifiers', () => {
    expect([1, 7, 8, 10, 11, 12, 30].map(abilityModifier)).toEqual([-5, -2, -1, 0, 0, 1, 10])
    expect(abilityScoreText(8)).toBe('8 (-1)')
    expect(abilityScoreText(16)).toBe('16 (+3)')
    expect(modifierText(0)).toBe('+0')
  })

  it('writes hit points as the rounded-down average with the Con bonus per die', () => {
    expect(averageRoll(6, 10)).toBe(35)
    expect(averageRoll(8, 3)).toBe(13)
    expect(hitPointsText(t, { dieCount: 10, dieType: 6 }, 11)).toBe('35 (10d6)')
    expect(hitPointsText(t, { dieCount: 8, dieType: 8 }, 14)).toBe('52 (8d8 + 16)')
    expect(hitPointsText(t, { dieCount: 4, dieType: 8 }, 8)).toBe('14 (4d8 - 4)')
  })

  it('lists saves (never below +0), skills with expertise, and passive Perception', () => {
    expect(savingThrowsText(t, ['dex', 'wis'], { ...scores, wis: 6 }, 2)).toBe('DEX +5, WIS +0')
    const skills = { perception: { name: 'Perception', link: 'wis' }, stealth: { name: 'Stealth', link: 'dex' } }
    expect(skillsText(t, ['perception', 'stealth*'], scores, 2, skills)).toBe('Perception +4, Stealth +7')
    expect(passivePerception(scores, 2)).toBe(12)
    expect(passivePerception(scores, 2, ['perception'])).toBe(14)
    expect(passivePerception(scores, 2, ['perception*'])).toBe(16)
  })

  it('describes senses, speeds, defenses and the creature', () => {
    expect(sensesText(t, 14, { 'infrared-vision': 30 }, ft)).toBe('Passive Perception 14, Infrared Vision 30ft')
    expect(speedText(t, { walk: 50, burrow: 35 }, ft)).toBe('50ft, burrow 35ft')
    expect(damageImmunities({ damImm: ['poison', 'psychic'] })).toEqual(['poison', 'psychic'])
    expect(conditionsText(t, ['poisoned', 'charmed'], { charmed: 'Charmed', poisoned: 'Poisoned' })).toBe('Charmed, Poisoned')
    expect(creatureKindText(t, { size: 'small', type: 'synthetic', alignment: 'nn' })).toBe('Small synthetic, neutral')
  })

  it('looks up the challenge rating with grouped XP', () => {
    expect(groupDigits(120000, ',')).toBe('120,000')
    expect(challengeText(t, { cr: '1/2', xp: 100 })).toBe('1/2 (100 xp)')
    expect(challengeText(t, { cr: '28', xp: 120000 })).toBe('28 (120,000 xp)')
    expect(challengeText(t, undefined)).toBe('')
  })

  it('works out save DCs', () => {
    expect(saveDc({ save: 'str', mod: 'str' }, scores, 2)).toBe(11)
    expect(saveDc({ save: 'dex', base: 11, proficient: false }, scores, 2)).toBe(11)
  })
})

describe('stat block entries', () => {
  it('titles entries with their uses, recharge or cost', () => {
    expect(entryTitle(t, { name: 'Aggressive' })).toBe('Aggressive.')
    expect(entryTitle(t, { name: 'Barrier', uses: 2, perDay: true })).toBe('Barrier (2/Day).')
    expect(entryTitle(t, { name: 'Shot', uses: 1 })).toBe('Shot (1 use).')
    expect(entryTitle(t, { name: 'Breath', recharge: ['5', '6'] })).toBe('Breath (Recharge 5-6).')
    expect(entryTitle(t, { name: 'Leadership', recharge: 'short' })).toBe('Leadership (Recharges after a Short or Long Rest).')
    expect(entryTitle(t, { name: 'Acid Spit Attack', cost: 2 })).toBe('Acid Spit Attack (Costs 2 Actions).')
    expect(entryTitle(t, { name: 'Move', cost: 1 })).toBe('Move.')
  })

  it('writes attacks from the ability scores and proficiency', () => {
    const pounce = { attack: 'melee', proficient: true, range: 10, mod: 'str', target: 'one', damage: [{ dieCount: 2, dieType: 6, mod: true, type: 'bludgeoning' }], hit: ' If the target is a creature, it is knocked prone' }
    expect(attackDescription(t, pounce, scores, 2, ft)).toBe('*Melee Weapon Attack:* +3 to hit, reach 10ft, one target. *Hit:* 8 (2d6 + 1) bludgeoning damage. If the target is a creature, it is knocked prone.')
    const spit = { attack: 'ranged', range: 30, mod: 'cha', target: 'one creature', miss: 'Nothing happens' }
    expect(attackDescription(t, spit, scores, 2, ft)).toBe('*Ranged Weapon Attack:* -1 to hit, range (30ft/90ft), one creature. *Miss:* Nothing happens.')
    // Thresher maw's grasp: two damage rolls, each with the Str modifier.
    const grasp = { attack: 'melee', proficient: true, range: 10, mod: 'str', target: 'one', damage: [{ dieCount: 3, dieType: 12, mod: true, type: 'bludgeoning' }, { dieCount: 2, dieType: 12, mod: true, type: 'acid' }] }
    expect(attackDescription(t, grasp, { str: 30 }, 9, ft)).toContain('+19 to hit')
    expect(attackDescription(t, grasp, { str: 30 }, 9, ft)).toContain('*Hit:* 29 (3d12 + 10) bludgeoning damage and 23 (2d12 + 10) acid damage.')
    expect(attackDescription(t, { ...pounce, damage: undefined, hit: undefined, save: 'str' }, scores, 2, ft)).toContain('one target. DC 11 Strength saving throw.')
  })

  it('writes damage rolls with and without the modifier', () => {
    expect(damageRollText(t, { dieCount: 2, dieType: 6, mod: true }, -1)).toBe('6 (2d6 - 1)')
    expect(damageRollText(t, { dieCount: 8, dieType: 10 }, 3)).toBe('44 (8d10)')
  })

  it('turns weapon refs into attacks', () => {
    const rules: StatBlockRules = { titleProperties: ['two-handed', 'hip-fire'], finesseProperties: ['finesse', 'recoil'], rangedWeapon: w => w.weaponType !== 'melee' }
    const piranha: StatWeapon = { name: 'N7 Piranha', weaponType: 'shotgun', damage: { dieCount: 2, dieType: 4, type: 'piercing' }, properties: [{ id: 'two-handed' }, { id: 'hip-fire' }, { id: 'recoil' }], range: { short: 10, long: 20 } }
    const slayer = { str: 16, dex: 14 }
    const attack = weaponAttackEntry({ ref: 'weapon', weaponId: 'n-7-piranha', proficient: true }, piranha, slayer, rules)
    expect(attack).toMatchObject({ name: 'N7 Piranha', attack: 'ranged', mod: 'str', props: ['two-handed', 'hip-fire'], target: 'one' })
    expect(entryTitle(t, attack)).toBe('N7 Piranha (two-handed, hip-fire).')
    expect(attackDescription(t, attack, slayer, 3, ft)).toBe('*Ranged Weapon Attack:* +6 to hit, range (10ft/20ft), one target. *Hit:* 8 (2d4 + 3) piercing damage.')

    const baton: StatWeapon = { name: 'Stun Baton', weaponType: 'melee', damage: { dieCount: 1, dieType: 6, type: 'bludgeoning' }, properties: [{ id: 'light' }], range: { short: 5 } }
    const trooper = { str: 12, dex: 13 }
    const melee = weaponAttackEntry({ proficient: true }, baton, trooper, rules)
    expect(melee).toMatchObject({ attack: 'melee', mod: 'str', props: undefined })
    expect(attackDescription(t, melee, trooper, 2, ft)).toBe('*Melee Weapon Attack:* +3 to hit, reach 5ft, one target. *Hit:* 4 (1d6 + 1) bludgeoning damage.')
    // Without game rules: no finesse match, and the long range decides.
    expect(weaponAttackEntry({}, piranha, slayer)).toMatchObject({ attack: 'ranged', mod: 'dex', props: undefined })
    expect(weaponAttackEntry({ mod: 'cha' }, baton, trooper)).toMatchObject({ attack: 'melee', mod: 'cha' })
    // Finesse ties go to Dex.
    expect(weaponAttackEntry({}, { ...baton, properties: ['finesse'] }, { str: 14, dex: 15 }, rules).mod).toBe('dex')
  })

  it('orders and filters entries', () => {
    expect(sortActions([{ id: 'claw' }, { id: 'multiattack' }]).map(a => a.id)).toEqual(['multiattack', 'claw'])
    expect(sortLegendary([{ name: 'Spit', cost: 2 }, { name: 'Tail', cost: 1 }, { name: 'Move', cost: 1 }]).map(a => a.name)).toEqual(['Move', 'Tail', 'Spit'])
    expect(shownEntries([{ name: 'Bite' }, { attack: 'ranged' }, { ref: 'weapon', weaponId: 'scorpion' }])).toHaveLength(2)
  })
})

describe('stat block lists', () => {
  const powers = { 'decoy': { name: 'Decoy', level: 1 }, 'overload': { name: 'Overload', level: 1 }, 'charge': { name: 'Charge', level: 0 }, 'biotic-slash': { name: 'Biotic Slash', level: 1 } }

  it('tells power and item lists apart', () => {
    expect(entryListKind({ ref: 'power', list: ['charge'] })).toBe('leveled')
    expect(entryListKind({ ref: 'power', list: [{ id: 'decoy', perDay: 3 }] })).toBe('innate')
    expect(entryListKind({ list: [{ id: 'frag-grenade', uses: 2 }] })).toBe('items')
    expect(entryListKind({ list: [{ id: 'frag-grenade', perDay: 1 }] })).toBe('items')
    expect(entryListKind({ text: 'No list' })).toBeUndefined()
  })

  it('groups innate powers by uses per day', () => {
    const lines = innatePowerLines(t, { list: [{ id: 'overload', perDay: 5, level: 2 }, { id: 'decoy', perDay: 3 }, { id: 'charge', perDay: 'at_will' }, { id: 'missing', perDay: 1 }] }, powers)
    expect(lines).toEqual([
      { label: 'At Will:', links: [{ id: 'charge', text: 'charge', note: undefined }] },
      { label: '3/Day:', links: [{ id: 'decoy', text: 'decoy', note: undefined }] },
      { label: '5/Day:', links: [{ id: 'overload', text: 'overload', note: '(as a 2nd-level power)' }] },
    ])
  })

  it('lists cantrips and the power levels the caster has slots for', () => {
    const slots = [[2, 4, 6], [0, 2, 3], [0, 0, 0]]
    const lines = leveledPowerLines(t, { casterLevel: '3', list: ['charge', 'biotic-slash'] }, powers, slots)
    expect(lines).toEqual([
      { label: 'Cantrips (At Will):', links: [{ id: 'charge', text: 'charge' }] },
      { label: '1st level (6 slots):', links: [{ id: 'biotic-slash', text: 'biotic slash' }] },
      { label: '2nd level (3 slots):', links: [] },
    ])
    expect(leveledPowerLines(t, { casterLevel: 1, list: ['missing'] }, powers, slots)).toEqual([])
  })

  it('groups items by uses, with their mark', () => {
    expect(itemUseLines(t, { list: [{ id: 'frag-grenade', mark: 'iii', uses: 2 }, { id: 'flashbang-grenade', uses: 1 }] }, { 'frag-grenade': 'Frag Grenade', 'flashbang-grenade': 'Flashbang Grenade' })).toEqual([
      { label: '1 use:', links: [{ id: 'flashbang-grenade', text: 'flashbang grenade' }] },
      { label: '2 uses:', links: [{ id: 'frag-grenade', text: 'frag grenade III' }] },
    ])
  })

  it('collects the records a stat block refers to', () => {
    const stats = { entries: {
      features: [{ id: 'innate-powercasting', ref: 'power', list: [{ id: 'decoy', perDay: 3 }] }, { id: 'grenades', list: [{ id: 'frag-grenade', uses: 2 }] }],
      actions: [{ ref: 'weapon', weaponId: 'scorpion' }],
      legendary: { actions: [{ name: 'Cast', ref: 'power', list: ['charge'] }] },
    } }
    expect(statBlockRefIds(stats)).toEqual({ weapons: ['scorpion'], powers: ['decoy', 'charge'], items: ['frag-grenade'] })
  })
})

describe('stat block text', () => {
  it('splits MDC into text, emphasis and prose components', () => {
    expect(inlineTokens('*Hit:* 7 (3d4) damage within a :distance{length="10" adj}-radius sphere, :condition{id="prone"}.')).toEqual([
      { type: 'em', value: 'Hit:' },
      { type: 'text', value: ' 7 (3d4) damage within a ' },
      { type: 'component', name: 'distance', props: { length: '10', adj: true } },
      { type: 'text', value: '-radius sphere, ' },
      { type: 'component', name: 'condition', props: { id: 'prone' } },
      { type: 'text', value: '.' },
    ])
    expect(inlineTokens('**Bold** text')).toEqual([{ type: 'strong', value: 'Bold' }, { type: 'text', value: ' text' }])
  })

  it('leaves other markdown to the parser', () => {
    expect(inlineTokens('within 1[:distance{length="0"}] of it')).toBeUndefined()
    expect(inlineTokens('See [the rules](/manual)')).toBeUndefined()
    expect(inlineTokens('One.\n\nTwo.')).toBeUndefined()
  })
})
