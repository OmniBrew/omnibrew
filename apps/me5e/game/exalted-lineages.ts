import type { DerivedRecord } from '@omnibrew/engine/schemas'

/**
 * Exalted Lineages: one `exalted-lineages` edge per species, generated from the
 * species and their traits, as build-data.js did (plan/04 Q8). The kett's
 * Exalted Lineage trait offers them as a choice: an exalted kett takes the other
 * species' ability score increases, resistances, immunities, senses and
 * non-walking speeds. A subspecies lineage also takes its parent's traits (a geth
 * platform is still a Synthetic Construct). Ids are `EXL_<species>`; saved
 * characters use them.
 * `EXL_kett` ("None", the kett's own option) is a content file.
 */
type Rec = Record<string, unknown>
interface Mechanic { type: string, [key: string]: unknown }

/** Species that are no lineage: the kett themselves and their behemoth variant. */
const SKIPPED = new Set(['kett', 'behemoth'])
/** Traits that are equipment, not biology. */
const EXCLUDED_TRAITS = new Set(['hermetic-suit', 'pressurized-suit', 'contra-gravitic-levitation'])
/** A variant whose lineages are its subspecies (the ardat-yakshi dispositions), not itself. */
const SUBSPECIES_ONLY = new Set(['ardat-yakshi'])
const GERUND: Record<string, string> = { fly: 'flying', swim: 'swimming', climb: 'climbing', burrow: 'burrowing' }

const mechanicsOf = (r: Rec | undefined) => (Array.isArray(r?.mechanics) ? r.mechanics as Mechanic[] : [])

/**
 * What an exalted kett inherits: "any immunities" includes condition immunities
 * (build-data.js dropped them with a typo; plan/04 Q11). Falling-damage
 * resistance was a `resistance` when build-data.js ran (plan/08 R2).
 */
export const inherited = (m: Mechanic) =>
  ['resistance', 'sense', 'immunity', 'condition-immunity'].includes(m.type)
  || (m.type === 'fall-damage' && m.resistance === true)
  || (m.type === 'speed' && m.speed !== 'walk')
  || m.type.startsWith('asi')

/** The prose shown for a lineage: one bold heading per kind of benefit. */
export function lineageBody(mechanics: Mechanic[]): string {
  const sections: Array<[string, string[]]> = [
    ['Ability Score Increase', mechanics.filter(m => m.type === 'asi').map(m => `+${m.amount} ${String(m.ability).toUpperCase()}`)],
    ['Resistances', mechanics.filter(m => m.type === 'resistance' || m.type === 'fall-damage')
      .map(m => `${m.type === 'fall-damage' ? 'falling damage' : m.value ?? ''}${m.note ? ` (${m.note})` : ''}`)],
    ['Damage Immunities', mechanics.filter(m => m.type === 'immunity').map(m => `${m.value ?? ''}${m.note ? ` (${m.note})` : ''}`)],
    ['Condition Immunities', mechanics.filter(m => m.type === 'condition-immunity').map(m => `:condition{id=${m.value}}${m.note ? ` (${m.note})` : ''}`)],
    ['Speeds', mechanics.filter(m => m.type === 'speed').map(m => `${GERUND[String(m.speed)] ?? m.speed} :distance{length=${m.distance}}${m.note ? ` (${m.note})` : ''}`)],
    ['Senses', mechanics.filter(m => m.type === 'sense').map(m => `${[m.sense].flat().join(', ').replaceAll('-', ' ')}${m.distance ? ` :distance{length=${m.distance}}` : ''}`)],
  ]
  return sections
    .filter(([, items]) => items.length)
    .map(([title, items]) => `**${title}**\n\n${items.join(', ')}`)
    .join('\n\n')
}

export function generateExaltedLineages(species: Map<string, Rec>, traits: Map<string, Rec>): DerivedRecord[] {
  const out: DerivedRecord[] = []
  for (const [id, sp] of species) {
    if (SKIPPED.has(id)) continue
    let name = String(sp.name)
    let mechanics: Mechanic[]
    if ((sp.type === 'variant' || sp.type === 'subspecies') && !SUBSPECIES_ONLY.has(id)) {
      const parent = species.get(String(sp.species))
      name = `${parent?.name} (${name})`
      mechanics = sp.type === 'variant'
        ? [...(sp.mechanics ? mechanicsOf(sp) : mechanicsOf(parent))]
        : [...mechanicsOf(sp), ...mechanicsOf(parent)]
    }
    else if (sp.subspecies) {
      // The lineage is one of its subspecies.
      continue
    }
    else {
      mechanics = [...mechanicsOf(sp)]
    }
    const owners = sp.type === 'subspecies' ? [id, String(sp.species)] : [id]
    for (const [traitId, trait] of traits) {
      if (owners.some(o => (trait.species as string[] | undefined)?.includes(o)) && !EXCLUDED_TRAITS.has(traitId)) mechanics.push(...mechanicsOf(trait))
    }
    mechanics = mechanics.filter(inherited)
    const body = lineageBody(mechanics)
    out.push({ id: `EXL_${id}`, name, type: 'exalted-lineages', mechanics, ...(body ? { body } : {}) })
  }
  return out.sort((a, b) => (String(a.name) < String(b.name) ? -1 : 1))
}
