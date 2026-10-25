/**
 * Random height and weight (a species' `randomDimensions`): the table's text
 * and the roll, in either unit system. Content gives both systems' numbers:
 * heights in inches or centimeters, weights in pounds or kilograms, and a
 * weight modifier that a metric `divisor` scales down.
 *
 *   height = base height + height roll
 *   weight = base weight + height roll × weight roll (÷ divisor)
 */
import type { Translate } from './powers'

export type UnitSystemName = 'imperial' | 'metric'
export type DimensionKind = 'height' | 'weight' | 'length'

export interface DimensionDice {
  dieCount: number
  /** No die type: the modifier is `dieCount` itself. */
  dieType?: number | false
  divisor?: number
}

export interface DimensionRange {
  base: Record<UnitSystemName, number>
  mod: Record<UnitSystemName, DimensionDice>
}

export type RandomDimensions = Partial<Record<DimensionKind, DimensionRange>>

/** Heights and lengths: 4'8" (inches) or 142 cm. */
export function formatBodyLength(t: Translate, value: number, system: UnitSystemName): string {
  if (system === 'metric') return `${value} ${t('measurements.cm.abbr')}`
  return `${Math.floor(value / 12)}'${value % 12}"`
}

/** Weights: "110 lbs" or "50 kgs", from the `measurements.*.abbr` plurals. */
export const formatBodyWeight = (t: Translate, value: number, system: UnitSystemName) =>
  t(`measurements.${system === 'metric' ? 'kg' : 'lb'}.abbr`, value)

/** A base value as the table shows it. */
export function dimensionBase(t: Translate, range: DimensionRange, kind: DimensionKind, system: UnitSystemName): string {
  const base = range.base[system]
  return kind === 'weight' ? formatBodyWeight(t, base, system) : formatBodyLength(t, base, system)
}

/** A modifier as the table shows it: "2d10", "1d4 / 2", a flat number, or "-" for none. */
export function dimensionMod(t: Translate, range: DimensionRange, system: UnitSystemName): string {
  const { dieCount, dieType, divisor } = range.mod[system]
  if (dieCount === 0) return '-'
  if (!dieType) return String(dieCount)
  const dice = t('dice', { dieCount, dieType })
  return divisor ? `${dice} / ${divisor}` : dice
}

/** Rolls a modifier: one value per die, or the flat value alone. `random` returns [0, 1) like Math.random. */
export function rollDimensionMod(dice: DimensionDice, random: () => number = Math.random): number[] {
  if (dice.dieCount === 0) return []
  if (!dice.dieType) return [dice.dieCount]
  const sides = dice.dieType
  return Array.from({ length: dice.dieCount }, () => Math.floor(random() * sides) + 1)
}

export interface RolledDimension {
  base: number
  /** The modifier dice rolled for this dimension. */
  rolls: number[]
  /** Weight only: the height roll it is multiplied by, and the metric divisor. */
  heightRoll?: number
  divisor?: number
  total: number
}

export type RolledDimensions = Partial<Record<DimensionKind, RolledDimension>>

const sum = (values: number[]) => values.reduce((a, b) => a + b, 0)

/**
 * Rolls a random height, weight (and length, for long species) in one unit
 * system. The weight multiplies the height roll by the weight roll; a metric
 * divisor divides that product, and the total rounds to a whole number.
 */
export function rollDimensions(dimensions: RandomDimensions, system: UnitSystemName, random: () => number = Math.random): RolledDimensions {
  const out: RolledDimensions = {}
  const { height, weight, length } = dimensions
  let heightRoll = 0
  if (height) {
    const rolls = rollDimensionMod(height.mod[system], random)
    heightRoll = sum(rolls)
    out.height = { base: height.base[system], rolls, total: height.base[system] + heightRoll }
  }
  if (weight) {
    const mod = weight.mod[system]
    const rolls = rollDimensionMod(mod, random)
    const divisor = mod.divisor && mod.divisor > 0 ? mod.divisor : undefined
    // No weight dice: the weight is the base alone.
    const extra = rolls.length ? (heightRoll || 1) * sum(rolls) / (divisor ?? 1) : 0
    out.weight = { base: weight.base[system], rolls, heightRoll, ...(divisor ? { divisor } : {}), total: Math.round(weight.base[system] + extra) }
  }
  if (length) {
    const rolls = rollDimensionMod(length.mod[system], random)
    out.length = { base: length.base[system], rolls, total: length.base[system] + sum(rolls) }
  }
  return out
}

/** How a rolled dimension was reached: "4'8\" + 7" or "110 lbs + 7 × 5" ("… × 3 / 2" metric). */
export function dimensionRollBreakdown(t: Translate, kind: DimensionKind, rolled: RolledDimension, system: UnitSystemName): string {
  const base = kind === 'weight' ? formatBodyWeight(t, rolled.base, system) : formatBodyLength(t, rolled.base, system)
  if (!rolled.rolls.length) return base
  const roll = sum(rolled.rolls)
  if (kind !== 'weight') return `${base} + ${roll}`
  return `${base} + ${rolled.heightRoll || 1} × ${roll}${rolled.divisor ? ` / ${rolled.divisor}` : ''}`
}

/** A rolled total as text. */
export const formatRolledDimension = (t: Translate, kind: DimensionKind, rolled: RolledDimension, system: UnitSystemName) =>
  kind === 'weight' ? formatBodyWeight(t, rolled.total, system) : formatBodyLength(t, rolled.total, system)
