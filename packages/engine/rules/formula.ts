import type { Sheet } from './sheet'
import type { Formula, FormulaKind } from './types'

/**
 * Evaluates a value expression, as the live site's `mcBonus`: kinds below,
 * then `multiplier`, then rounding down (up with `ceil`), then `min`.
 * Unknown kinds count 0. A game adds kinds with `GameRules.formulas`.
 */
export const CORE_FORMULAS: Record<string, FormulaKind> = {
  flat: f => Number(f.value) || 0,
  mod: (f, s) => s.abilities[f.value as string]?.mod ?? 0,
  modComparison: (f, s) => Math.max(...(f.value as string[]).map(a => s.abilities[a]?.mod ?? 0)),
  hp: (f, s) => (f.value === 'current' ? s.hp.current : s.hp.max),
  proficiency: (_, s) => s.profBonus,
  level: (f, s) => (f.value ? s.classLevels(f.value as string) : s.level),
  progressive: (f, s) => {
    if (!f.value) return 0
    const level = f.limit ? s.classLevels(f.limit) : s.level
    const table = f.value as Record<string, number>
    // Highest key not above the level; keys compare as the live site did (string vs number).
    const key = Object.keys(table).sort((a, b) => Number(b) - Number(a)).find(k => Number(k) <= level)
    return key === undefined ? 0 : table[key] ?? 0
  },
  multi: (f, s) => (Array.isArray(f.value) ? f.value.reduce((a: number, sub) => a + s.formula(sub as Formula), 0) : 0),
  powercastingMod: (f, s) => {
    if (!f.value) return 0
    const ability = s.powercastingAbilities[f.value as string]
    return ability ? s.abilities[ability]?.mod ?? 0 : 0
  },
  resource: (f, s) => {
    if (f.useMax) {
      const m = s.mechanics.find(i => i.resource && i.resource.id === f.value)
      return s.formula(m?.resource?.max) || 0
    }
    return Number(s.character.state.resources[f.value as string]) || 0
  },
}

export function evaluateFormula(formula: Formula | undefined | null, sheet: Sheet, kinds: Record<string, FormulaKind>): number {
  if (!formula) return 0
  const kind = kinds[formula.type]
  let b = kind ? kind(formula, sheet) : 0
  if (formula.multiplier) b *= formula.multiplier
  b = formula.ceil ? Math.ceil(b) : Math.floor(b)
  if (formula.min || formula.min === 0) b = Math.max(formula.min, b)
  return b
}
