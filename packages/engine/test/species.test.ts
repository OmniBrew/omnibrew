import { describe, expect, it } from 'vitest'
import { pageSpeciesId, speciesFamily, speciesGroupIds, speciesPage, speciesSections, type SpeciesNode, type TraitNode } from '../app/utils/species'

interface Sp extends SpeciesNode { mechanics?: unknown[] }
const sp = (id: string, fields: Partial<Sp> = {}): Sp => ({ stem: `species/${id}`, name: id, ...fields })
const tr = (id: string, species: string[]): TraitNode => ({ stem: `traits/${id}`, species })
const ids = (records: Array<{ stem: string }>) => records.map(r => r.stem.split('/').pop())

const species: Sp[] = [
  sp('asari', { name: 'Asari', group: 'primary', subspecies: 'lifestage' }),
  sp('lifestage-maiden', { name: 'Maiden', type: 'subspecies', species: 'asari' }),
  sp('lifestage-matron', { name: 'Matron', type: 'subspecies', species: 'asari' }),
  sp('ardat-yakshi', { name: 'Ardat-Yakshi', type: 'variant', species: 'asari', subspecies: 'ay-disposition' }),
  sp('ay-disposition-chaste', { name: 'Chaste', type: 'subspecies', species: 'ardat-yakshi' }),
  sp('ay-disposition-embrace', { name: 'Embrace', type: 'subspecies', species: 'ardat-yakshi' }),
  sp('ay-disposition-growing-power', { name: 'Growing Power', type: 'subspecies', species: 'ardat-yakshi' }),
  sp('ay-disposition-acceptance', { name: 'Acceptance', type: 'subspecies', species: 'ardat-yakshi' }),
  sp('prothean', { name: 'Prothean', group: 'expanded', subspecies: 'avatar' }),
  sp('avatar-bravery', { name: 'Bravery', type: 'subspecies', species: 'prothean' }),
  sp('avatar-humor', { name: 'Humor', type: 'subspecies', species: 'prothean' }),
  sp('avatar-strength', { name: 'Strength', type: 'subspecies', species: 'prothean' }),
  sp('human', { name: 'Human', group: 'primary' }),
  sp('kett', { name: 'Kett', group: 'andromeda' }),
  sp('drell', { name: 'Drell', group: 'primary' }),
]
const traits = [
  tr('mind-meld', ['asari', 'ardat-yakshi']),
  tr('addiction', ['ardat-yakshi']),
  tr('dominate', ['ay-disposition-embrace', 'ay-disposition-chaste']),
  tr('youthful', ['lifestage-maiden']),
  tr('avatars-inspiration', ['avatar-humor', 'avatar-strength']),
  tr('psychometry', ['prothean']),
]
const groups = [{ stem: 'subspecies/lifestage', name: 'Lifestage' }, { stem: 'subspecies/ay-disposition', name: 'Disposition' }, { stem: 'subspecies/avatar', name: 'Avatar' }]

describe('species list', () => {
  it('lists species that are not variants or subspecies, by group in order, by name', () => {
    const sections = speciesSections(species, ['primary', 'villainous', 'expanded'])
    expect(sections.map(s => s.group)).toEqual(['primary', 'expanded', 'andromeda'])
    expect(ids(sections[0]!.species)).toEqual(['asari', 'drell', 'human'])
    expect(ids(sections[2]!.species)).toEqual(['kett'])
  })
})

describe('species pages', () => {
  it('shows a variant or subspecies on its species\' page', () => {
    expect(pageSpeciesId(species, 'asari')).toBe('asari')
    expect(pageSpeciesId(species, 'ardat-yakshi')).toBe('asari')
    expect(pageSpeciesId(species, 'ay-disposition-chaste')).toBe('asari')
    expect(pageSpeciesId(species, 'avatar-humor')).toBe('prothean')
    expect(pageSpeciesId(species, 'nope')).toBeUndefined()
  })

  it('collects the family and the subspecies records it needs', () => {
    const family = speciesFamily(species, 'asari')
    expect(family.toSorted()).toEqual(['ardat-yakshi', 'asari', 'ay-disposition-acceptance', 'ay-disposition-chaste', 'ay-disposition-embrace', 'ay-disposition-growing-power', 'lifestage-maiden', 'lifestage-matron'])
    expect(speciesGroupIds(species, family).toSorted()).toEqual(['ay-disposition', 'lifestage'])
    expect(speciesFamily(species, 'human')).toEqual(['human'])
  })

  it('joins traits, subspecies options and variants, each trait where it belongs', () => {
    const family = speciesFamily(species, 'asari')
    const page = speciesPage('asari', species.filter(s => family.includes(s.stem.slice(8))), traits, groups)!
    expect(page.species.name).toBe('Asari')
    expect(ids(page.traits.map(e => e.trait))).toEqual(['mind-meld'])
    expect(page.group?.record?.name).toBe('Lifestage')
    expect(page.group?.options.map(o => [o.species.name, ids(o.traits.map(e => e.trait))])).toEqual([['Maiden', ['youthful']], ['Matron', []]])
    // The variant lists the traits it adds, not the asari's own Mind Meld.
    const [ay] = page.variants
    expect(ay?.species.name).toBe('Ardat-Yakshi')
    expect(ids(ay!.traits.map(e => e.trait))).toEqual(['addiction'])
    expect(ay?.group?.record?.name).toBe('Disposition')
    expect(ay?.group?.options.map(o => o.species.name)).toEqual(['Acceptance', 'Chaste', 'Embrace', 'Growing Power'])
  })

  it('shows a trait most options share once, after the choice\'s text', () => {
    const page = speciesPage('prothean', species.filter(s => s.stem.includes('avatar') || s.stem.endsWith('prothean')), traits, groups)!
    expect(ids(page.group!.shared.map(e => e.trait))).toEqual(['avatars-inspiration'])
    expect(page.group!.options.every(o => !o.traits.length)).toBe(true)
    // Two of four Ardat-Yakshi dispositions is no majority: Dominate stays with each.
    const asari = speciesPage('asari', species, traits, groups)!
    expect(asari.variants[0]!.group!.shared).toEqual([])
  })

  it('anchors each record once and knows its tab', () => {
    const page = speciesPage('asari', species, traits, groups)!
    const dominate = page.variants[0]!.group!.options.map(o => o.traits.find(e => e.trait.stem === 'traits/dominate')?.anchor)
    expect(dominate).toEqual([undefined, true, false, undefined])
    expect(page.tabs).toMatchObject({
      'mind-meld': 'traits',
      'lifestage-maiden': 'subspecies',
      'youthful': 'subspecies',
      'ardat-yakshi': 'variants',
      'addiction': 'variants',
      'ay-disposition-embrace': 'variants',
      'dominate': 'variants',
    })
    expect(speciesPage('nope', species, traits, groups)).toBeUndefined()
  })
})
