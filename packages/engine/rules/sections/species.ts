import type { Sheet } from '../sheet'
import type { MechanicSource, Rec } from '../types'

export interface SpeciesView extends Rec {
  id: string
  name: string
  parentId?: string
  parentName?: string
}

/**
 * The character's species record. A variant is its parent's record with the
 * variant's fields on top; a subspecies also keeps its parent's mechanics
 * (the live store's `species` getter).
 */
export function computeSpecies(sheet: Sheet): SpeciesView | null {
  const id = sheet.character.species
  if (!id) return null
  const species = sheet.content.get('species', id)
  if (!species) return null
  if (species.type !== 'variant' && species.type !== 'subspecies') return species as SpeciesView
  const parent = sheet.content.get('species', species.species) ?? {}
  if (species.type === 'variant') return { ...parent, ...species, parentName: parent.name } as SpeciesView
  return { ...parent, ...species, mechanics: [...parent.mechanics ?? [], ...species.mechanics ?? []], parentName: parent.name, parentId: parent.id } as unknown as SpeciesView
}

/** The species' traits: traits listing the species, or a subspecies' parent. */
export function speciesTraits(sheet: Sheet): Rec[] {
  const s = sheet.species
  if (!s) return []
  return sheet.content.list('traits').filter(t => t.species?.includes(s.id) || (s.parentId && t.species?.includes(s.parentId)))
}

/**
 * Species mechanic sources. With Tasha's option the species' fixed and chosen
 * ability increases are dropped for one free `asi-choice`; species ability
 * choices are offered under `traits/asi`, as on the live builder.
 */
export function speciesSources(sheet: Sheet): MechanicSource[] {
  const s = sheet.species
  if (!s) return []
  const tashas = sheet.character.options.tashas
  const mechanics: Rec[] = (s.mechanics ?? []).filter((m: Rec) => (tashas ? !m.type.startsWith('asi') : true))
  const asiOptions = tashas ? [] : mechanics.filter(m => m.type === 'asi-choice')
  const path = `species/${s.id}`
  const out: MechanicSource[] = [{ path, mechanics: mechanics.filter(m => m.type !== 'asi-choice') }]
  if (tashas) out.push({ path: `${path}/traits/asi`, mechanics: [{ type: 'asi-choice', options: true }] })
  if (asiOptions.length) out.push({ path: `${path}/traits/asi`, mechanics: asiOptions })
  for (const t of speciesTraits(sheet)) out.push({ path: `${path}/traits/${t.id}`, mechanics: t.mechanics ?? [] })
  return out
}
