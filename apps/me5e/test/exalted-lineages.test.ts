import { createGame } from '@omnibrew/engine/schemas'
import { describe, expect, it } from 'vitest'
import { me5e } from '../game'
import { generateExaltedLineages } from '../game/exalted-lineages'

const rec = (rows: Array<[string, Record<string, unknown>]>) => new Map(rows)

const species = rec([
  ['kett', { name: 'Kett', subspecies: 'exaltation', mechanics: [{ type: 'speed', speed: 'walk', distance: 30 }] }],
  ['asari', { name: 'Asari', subspecies: 'lifestage', mechanics: [{ type: 'speed', speed: 'walk', distance: 30 }] }],
  ['lifestage-maiden', { name: 'Maiden', type: 'subspecies', species: 'asari', mechanics: [{ type: 'asi', ability: 'dex', amount: 1 }] }],
  ['geth', { name: 'Geth', subspecies: 'mobile-platform' }],
  ['mobile-platform-trooper', { name: 'Trooper', type: 'subspecies', species: 'geth', mechanics: [{ type: 'asi', ability: 'con', amount: 1 }] }],
  ['ardat-yakshi', { name: 'Ardat-Yakshi', type: 'variant', species: 'asari', subspecies: 'ay-disposition' }],
  ['ay-disposition-chaste', { name: 'Chaste', type: 'subspecies', species: 'ardat-yakshi', mechanics: [{ type: 'asi', ability: 'wis', amount: 1 }] }],
  ['krogan', { name: 'Krogan', mechanics: [{ type: 'asi', ability: 'str', amount: 2 }] }],
  ['tankbred', { name: 'Tankbred', type: 'variant', species: 'krogan' }],
  ['drell', { name: 'Drell', mechanics: [{ type: 'asi', ability: 'dex', amount: 2 }, { type: 'skill', value: 'stealth' }] }],
])
const traits = rec([
  ['krogan-hide', { name: 'Hide', species: ['krogan', 'tankbred'], mechanics: [{ type: 'resistance', value: 'fire', note: 'to your hit points' }] }],
  ['wings', { name: 'Wings', species: ['drell'], mechanics: [{ type: 'speed', speed: 'fly', distance: 30 }, { type: 'fall-damage', resistance: true }] }],
  ['eyes', { name: 'Eyes', species: ['drell'], mechanics: [{ type: 'sense', sense: 'infrared-vision', distance: 60 }, { type: 'condition-immunity', value: 'blinded' }] }],
  ['synthetic-construct', { name: 'Synthetic Construct', species: ['geth'], mechanics: [{ type: 'immunity', value: 'poison' }, { type: 'condition-immunity', value: 'poisoned' }] }],
  ['hermetic-suit', { name: 'Suit', species: ['drell'], mechanics: [{ type: 'resistance', value: 'poison' }] }],
])

describe('Exalted Lineages', () => {
  const lineages = generateExaltedLineages(species, traits)
  const byId = new Map(lineages.map(l => [l.id, l]))

  it('makes one lineage per species, skipping the kett and species that only offer subspecies', () => {
    expect(lineages.map(l => l.id)).toEqual(['EXL_ay-disposition-chaste', 'EXL_lifestage-maiden', 'EXL_drell', 'EXL_mobile-platform-trooper', 'EXL_krogan', 'EXL_tankbred'])
    expect(byId.get('EXL_lifestage-maiden')?.name).toBe('Asari (Maiden)')
    expect(byId.get('EXL_ay-disposition-chaste')?.name).toBe('Ardat-Yakshi (Chaste)')
  })

  it('takes ability increases, resistances, immunities, senses and non-walking speeds, not skills or suits', () => {
    expect(byId.get('EXL_drell')?.mechanics).toEqual([
      { type: 'asi', ability: 'dex', amount: 2 },
      { type: 'speed', speed: 'fly', distance: 30 },
      { type: 'fall-damage', resistance: true },
      { type: 'sense', sense: 'infrared-vision', distance: 60 },
      { type: 'condition-immunity', value: 'blinded' },
    ])
    expect(byId.get('EXL_drell')?.body).toBe([
      '**Ability Score Increase**', '', '+2 DEX', '',
      '**Resistances**', '', 'falling damage', '',
      '**Condition Immunities**', '', ':condition{id=blinded}', '',
      '**Speeds**', '', 'flying :distance{length=30}', '',
      '**Senses**', '', 'infrared vision :distance{length=60}',
    ].join('\n'))
  })

  it('gives a subspecies its parent species\' traits', () => {
    expect(byId.get('EXL_mobile-platform-trooper')?.mechanics).toEqual([
      { type: 'asi', ability: 'con', amount: 1 },
      { type: 'immunity', value: 'poison' },
      { type: 'condition-immunity', value: 'poisoned' },
    ])
    expect(byId.get('EXL_mobile-platform-trooper')?.body).toContain('**Damage Immunities**\n\npoison\n\n**Condition Immunities**\n\n:condition{id=poisoned}')
  })

  it('gives a variant without mechanics its parent\'s, and leaves the records unchanged', () => {
    expect(byId.get('EXL_tankbred')?.mechanics).toEqual([{ type: 'asi', ability: 'str', amount: 2 }, { type: 'resistance', value: 'fire', note: 'to your hit points' }])
    expect(species.get('krogan')?.mechanics).toHaveLength(1)
  })

  it('produces valid edges', () => {
    const schema = createGame(me5e).schemas.edges!
    for (const l of lineages) expect(schema.safeParse(l).success, l.id).toBe(true)
  })
})
