/**
 * The species pages' data: which species a record's page is, the cards of the
 * list page, and the join a species page shows: its traits, its subspecies
 * options (introduced by the `subspecies` record its `subspecies` field names)
 * and its variants. Variants and subspecies are species records with
 * `type: variant | subspecies` and `species` = their parent; traits name the
 * species they belong to. Pure functions, tested in test/species.test.ts.
 */
export interface SpeciesNode {
  stem: string
  name?: string | null
  type?: string | null
  species?: string | null
  subspecies?: string | null
  group?: string | null
}

export interface TraitNode {
  stem: string
  species?: string[] | null
}

/** A trait where a page shows it; `anchor` marks its first appearance, which gets the trait's id. */
export interface TraitEntry<T> {
  trait: T
  anchor: boolean
}

export interface SpeciesOption<S, T> {
  species: S
  traits: TraitEntry<T>[]
}

/**
 * A subspecies choice: the `subspecies` record (name and text), the traits
 * most options share (shown once, after the text), and the options.
 */
export interface SpeciesOptionGroup<S, G, T> {
  record?: G
  shared: TraitEntry<T>[]
  options: SpeciesOption<S, T>[]
}

export interface SpeciesVariantSection<S, G, T> {
  species: S
  traits: TraitEntry<T>[]
  group?: SpeciesOptionGroup<S, G, T>
}

/** The tabs of a species page that hold anchored records. */
export type SpeciesTab = 'traits' | 'subspecies' | 'variants'

export interface SpeciesPageModel<S, G, T> {
  species: S
  traits: TraitEntry<T>[]
  group?: SpeciesOptionGroup<S, G, T>
  variants: SpeciesVariantSection<S, G, T>[]
  /** The tab holding each anchored id (traits, options, variants). */
  tabs: Record<string, SpeciesTab>
}

const idOf = (record: { stem: string }) => record.stem.split('/').pop() ?? ''
const byStem = <R extends { stem: string }>(a: R, b: R) => (a.stem < b.stem ? -1 : a.stem > b.stem ? 1 : 0)

/**
 * The species whose page shows a record: the record itself, or for a variant
 * or subspecies the species up its `species` chain (an Ardat-Yakshi
 * disposition is on the asari page). Undefined for an unknown id.
 */
export function pageSpeciesId(records: SpeciesNode[], id: string): string | undefined {
  const byId = new Map(records.map(r => [idOf(r), r]))
  let current = byId.get(id)
  const seen = new Set<string>()
  while (current?.type && current.species && byId.has(current.species) && !seen.has(current.species)) {
    seen.add(current.species)
    current = byId.get(current.species)
  }
  return current ? idOf(current) : undefined
}

const childrenOf = <S extends SpeciesNode>(records: S[], parent: string, type: string) =>
  records.filter(r => r.type === type && r.species === parent).sort(byStem)

/** The ids a species page shows: the species, its variants and subspecies, and theirs. */
export function speciesFamily(records: SpeciesNode[], rootId: string): string[] {
  const out = [rootId]
  for (let i = 0; i < out.length; i++) {
    for (const r of records) {
      const id = idOf(r)
      if (r.type && r.species === out[i] && !out.includes(id)) out.push(id)
    }
  }
  return out
}

/** The `subspecies` records (option groups) a family's species introduce. */
export const speciesGroupIds = (records: SpeciesNode[], family: string[]) =>
  [...new Set(records.filter(r => family.includes(idOf(r)) && r.subspecies).map(r => r.subspecies!))]

/**
 * The list page's sections: species that are not a variant or subspecies,
 * by `group` in the given order (unknown groups follow), sorted by name.
 */
export function speciesSections<S extends SpeciesNode>(records: S[], order: string[]): Array<{ group: string, species: S[] }> {
  const main = records.filter(r => !r.type)
  const groups = [...new Set([...order, ...main.map(r => r.group ?? '')])]
  return groups
    .map(group => ({ group, species: main.filter(r => (r.group ?? '') === group).sort((a, b) => String(a.name ?? '').localeCompare(String(b.name ?? ''))) }))
    .filter(s => s.species.length)
}

/**
 * Joins a species page: the species' traits, its subspecies options, and its
 * variants with their own traits (those the parent species doesn't have) and
 * options. A trait most options of a group share (Avatar's Inspiration) is
 * the group's, shown once. Everything is in id order, as the old site listed
 * it. A trait shown twice is anchored (given its id) the first time.
 */
export function speciesPage<S extends SpeciesNode, G extends { stem: string }, T extends TraitNode>(
  rootId: string, records: S[], traits: T[], groups: G[],
): SpeciesPageModel<S, G, T> | undefined {
  const species = records.find(r => idOf(r) === rootId)
  if (!species) return undefined
  const sortedTraits = [...traits].sort(byStem)
  const tabs: Record<string, SpeciesTab> = {}
  const anchor = (id: string, tab: SpeciesTab) => {
    if (id in tabs) return false
    tabs[id] = tab
    return true
  }
  const entries = (list: T[], tab: SpeciesTab) => list.map(trait => ({ trait, anchor: anchor(idOf(trait), tab) }))
  const traitsOf = (id: string) => sortedTraits.filter(t => t.species?.includes(id))

  function group(parent: S, tab: SpeciesTab): SpeciesOptionGroup<S, G, T> | undefined {
    const options = childrenOf(records, idOf(parent), 'subspecies')
    if (!parent.subspecies && !options.length) return undefined
    const optionTraits = options.map(o => traitsOf(idOf(o)))
    const counts = new Map<T, number>()
    optionTraits.flat().forEach(t => counts.set(t, (counts.get(t) ?? 0) + 1))
    const isShared = (t: T) => (counts.get(t) ?? 0) >= 2 && (counts.get(t) ?? 0) > options.length / 2
    const shared = [...counts.keys()].filter(isShared).sort(byStem)
    return {
      record: groups.find(g => idOf(g) === parent.subspecies),
      shared: entries(shared, tab),
      options: options.map((o, i) => {
        anchor(idOf(o), tab)
        return { species: o, traits: entries(optionTraits[i]!.filter(t => !isShared(t)), tab) }
      }),
    }
  }

  const own = entries(traitsOf(rootId), 'traits')
  const subspecies = group(species, 'subspecies')
  const variants = childrenOf(records, rootId, 'variant').map((v) => {
    anchor(idOf(v), 'variants')
    // A variant lists the traits it adds; the ones it keeps are on the species.
    const added = traitsOf(idOf(v)).filter(t => !t.species?.includes(rootId))
    return { species: v, traits: entries(added, 'variants'), group: group(v, 'variants') }
  })
  return { species, traits: own, group: subspecies, variants, tabs }
}
