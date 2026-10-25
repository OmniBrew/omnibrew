import type { GameRules, Rec } from './types'

/** Mechanic types that are sheet cards: build-data.js gave them their record's name and a link to it. */
export const CARD_TYPES = ['action', 'reaction', 'other', 'bonus-action', 'attack']

/**
 * The content a character is computed against: collection → id → record, plus
 * the game's built-in records. Records get the defaults the old build
 * (`build-data.js` `appendResourceIds`) wrote into the live JSON:
 * - a mechanic's `resource` without an `id` takes the record's id (power
 *   casting entries too: the old build saw them as the power's mechanics);
 * - a card mechanic (action, attack...) takes the record's `name` and a
 *   `moreInfo` link to the record, unless it sets its own.
 */
export class RulesContent {
  private readonly collections = new Map<string, Map<string, Rec>>()

  constructor(records: Map<string, Map<string, Rec>>, private readonly rules: Pick<GameRules, 'builtins' | 'families'>) {
    for (const [collection, recs] of records) {
      const out = new Map<string, Rec>()
      for (const [id, rec] of recs) out.set(id, withDefaults(collection, { ...rec, id }))
      this.collections.set(collection, out)
    }
  }

  /** Records of a collection, built-ins last (as the live store listed its custom entries). An edge family name lists that family. */
  list(collection: string): Rec[] {
    const own = this.collections.get(collection)
    const builtins = this.rules.builtins?.[collection] ?? []
    if (own) return [...own.values(), ...builtins]
    const fam = this.rules.families
    if (fam) return [...(this.collections.get(fam.collection)?.values() ?? [])].filter(r => r[fam.field] === collection)
    return builtins
  }

  get(collection: string, id: string | null | undefined): Rec | undefined {
    if (!id) return undefined
    return this.collections.get(collection)?.get(id) ?? this.list(collection).find(r => r.id === id)
  }

  has(collection: string) {
    return this.collections.has(collection)
  }
}

export function withDefaults(collection: string, rec: Rec): Rec {
  const withId = (m: Rec) => (m.resource && typeof m.resource === 'object' && !m.resource.id ? { ...m, resource: { ...m.resource, id: rec.id } } : m)
  let out = rec
  if (Array.isArray(rec.mechanics) && rec.mechanics.length) {
    out = { ...out, mechanics: rec.mechanics.map((m: Rec) => (CARD_TYPES.includes(m.type) ? { name: rec.name, moreInfo: { model: collection, id: rec.id }, ...withId(m) } : withId(m))) }
  }
  if (Array.isArray(rec.casting) && rec.casting.length) out = { ...out, casting: rec.casting.map(withId) }
  return out
}
