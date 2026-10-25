import { ABILITY_KEYS } from '../../character/schema'
import type { Sheet } from '../sheet'

export interface AbilityScore {
  total: number | null
  mod: number | null
  base: number | null
  species: number
  klass: number
  misc: number
  bonus: number | null
  override: number | null
}

/**
 * Ability scores (the live store's `abilityBreakdown`): an override wins, then
 * a minimum (`asi-minimum`), then base + every `asi` + the typed bonus. With
 * Tasha's option, increases from an Exalted Lineage-style species pick
 * (`exalted-lineages` in the source path) don't count.
 */
export function computeAbilities(sheet: Sheet): Record<string, AbilityScore> {
  const tashas = sheet.character.options.tashas
  const counts = (m: { source?: string }) => !(tashas && m.source?.includes('exalted-lineages'))
  const sum = (list: Array<{ ability: string, amount: number }>) => {
    const out: Record<string, number> = {}
    for (const v of list) out[v.ability] = (out[v.ability] ?? 0) + v.amount
    return out
  }
  const asis = sheet.ofType('asi').filter(counts) as unknown as Array<{ ability: string, amount: number, source?: string }>
  const species = sum(asis.filter(m => m.source?.startsWith('species')))
  const all = sum(asis)
  const klass = sum(sheet.character.choices.filter(c => /class\/\w+\/\d\d?\/asi/.test(c.path))
    .flatMap(c => c.values.filter((v): v is { ability: string, amount: number } => typeof v === 'object' && 'ability' in v)))
  const minimums: Record<string, number> = {}
  for (const m of sheet.ofType('asi-minimum')) minimums[m.ability] = Math.max(minimums[m.ability] ?? 0, m.minimum)

  const scores = sheet.character.abilityScores
  const out: Record<string, AbilityScore> = {}
  for (const key of ABILITY_KEYS) {
    const base = scores.base[key]
    const bonus = scores.bonus[key]
    const override = scores.override[key]
    const total = override || minimums[key] || (base ? base + (all[key] ?? 0) + (bonus || 0) : base)
    out[key] = {
      total,
      mod: total ? Math.floor((total - 10) / 2) : null,
      base,
      species: species[key] ?? 0,
      klass: klass[key] ?? 0,
      misc: (all[key] ?? 0) - ((klass[key] ?? 0) + (species[key] ?? 0)),
      bonus,
      override,
    }
  }
  return out
}
