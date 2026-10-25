import { describe, expect, it } from 'vitest'
import {
  dimensionBase, dimensionMod, dimensionRollBreakdown, formatBodyLength, formatBodyWeight, formatRolledDimension,
  rollDimensionMod, rollDimensions, type RandomDimensions,
} from '../app/utils/dimensions'
import type { Translate } from '../app/utils/powers'

// A stand-in for vue-i18n's `t` over the ME5e measurement messages (3-form plurals get {n}).
const messages: Record<string, string> = {
  'dice': '{dieCount}d{dieType}',
  'measurements.cm.abbr': 'cm',
  'measurements.lb.abbr': 'lbs | lb | {n} lbs',
  'measurements.kg.abbr': 'kgs | kg | {n} kgs',
}
const t = ((key: string, a?: unknown) => {
  let text = messages[key] ?? key
  const n = typeof a === 'number' ? a : undefined
  if (text.includes(' | ')) text = text.split(' | ')[n === 0 ? 0 : n === 1 ? 1 : 2]!
  const named = typeof a === 'object' ? a as Record<string, unknown> : { n }
  return text.replace(/\{(\w+)\}/g, (_, k: string) => String(named[k]))
}) as Translate

/** A `random` that returns the given faces in turn (for dice of the given sides). */
const faces = (sides: number[], values: number[]) => {
  let i = 0
  return () => {
    const s = sides[i % sides.length]!
    return (values[i++]! - 1) / s
  }
}

const human: RandomDimensions = {
  height: { base: { imperial: 56, metric: 142 }, mod: { imperial: { dieCount: 2, dieType: 10 }, metric: { dieCount: 5, dieType: 10 } } },
  weight: { base: { imperial: 110, metric: 50 }, mod: { imperial: { dieCount: 2, dieType: 4 }, metric: { dieCount: 1, dieType: 4, divisor: 2 } } },
}
const hanar: RandomDimensions = {
  ...human,
  length: { base: { imperial: 48, metric: 122 }, mod: { imperial: { dieCount: 2, dieType: 6 }, metric: { dieCount: 5, dieType: 6 } } },
}

describe('random height and weight table', () => {
  it('shows heights in feet and inches or centimeters, weights in lbs or kgs', () => {
    expect(formatBodyLength(t, 56, 'imperial')).toBe('4\'8"')
    expect(formatBodyLength(t, 72, 'imperial')).toBe('6\'0"')
    expect(formatBodyLength(t, 142, 'metric')).toBe('142 cm')
    expect(formatBodyWeight(t, 110, 'imperial')).toBe('110 lbs')
    expect(formatBodyWeight(t, 50, 'metric')).toBe('50 kgs')
    expect(dimensionBase(t, human.height!, 'height', 'imperial')).toBe('4\'8"')
    expect(dimensionBase(t, human.weight!, 'weight', 'metric')).toBe('50 kgs')
  })

  it('shows modifiers as dice, with the metric divisor, a flat value, or none', () => {
    expect(dimensionMod(t, human.height!, 'imperial')).toBe('2d10')
    expect(dimensionMod(t, human.weight!, 'metric')).toBe('1d4 / 2')
    expect(dimensionMod(t, { base: { imperial: 1, metric: 1 }, mod: { imperial: { dieCount: 3 }, metric: { dieCount: 0, dieType: 4 } } }, 'imperial')).toBe('3')
    expect(dimensionMod(t, { base: { imperial: 1, metric: 1 }, mod: { imperial: { dieCount: 3 }, metric: { dieCount: 0, dieType: 4 } } }, 'metric')).toBe('-')
  })
})

describe('random height and weight rolls', () => {
  it('rolls each die from 1 to its sides', () => {
    expect(rollDimensionMod({ dieCount: 3, dieType: 6 }, () => 0)).toEqual([1, 1, 1])
    expect(rollDimensionMod({ dieCount: 2, dieType: 6 }, () => 0.9999)).toEqual([6, 6])
    expect(rollDimensionMod({ dieCount: 0, dieType: 6 })).toEqual([])
    expect(rollDimensionMod({ dieCount: 4 })).toEqual([4])
  })

  it('adds the height roll, and the height roll times the weight roll', () => {
    // 2d10 = 3 + 4, then 2d4 = 2 + 3: 4'8" + 7 = 5'3", 110 + 7 × 5 = 145 lbs.
    const r = rollDimensions(human, 'imperial', faces([10, 10, 4, 4], [3, 4, 2, 3]))
    expect(r.height).toEqual({ base: 56, rolls: [3, 4], total: 63 })
    expect(r.weight).toEqual({ base: 110, rolls: [2, 3], heightRoll: 7, total: 145 })
    expect(formatRolledDimension(t, 'height', r.height!, 'imperial')).toBe('5\'3"')
    expect(dimensionRollBreakdown(t, 'height', r.height!, 'imperial')).toBe('4\'8" + 7')
    expect(dimensionRollBreakdown(t, 'weight', r.weight!, 'imperial')).toBe('110 lbs + 7 × 5')
    expect(r.length).toBeUndefined()
  })

  it('divides the metric weight product and rounds the total', () => {
    // 5d10 = 27, 1d4 = 3: 142 + 27 = 169 cm, 50 + 27 × 3 / 2 = 90.5 → 91 kgs.
    const r = rollDimensions(human, 'metric', faces([10, 10, 10, 10, 10, 4], [5, 5, 5, 6, 6, 3]))
    expect(r.height?.total).toBe(169)
    expect(r.weight).toEqual({ base: 50, rolls: [3], heightRoll: 27, divisor: 2, total: 91 })
    expect(formatRolledDimension(t, 'weight', r.weight!, 'metric')).toBe('91 kgs')
    expect(dimensionRollBreakdown(t, 'weight', r.weight!, 'metric')).toBe('50 kgs + 27 × 3 / 2')
  })

  it('rolls a length for long species, and stays within the dice\'s range', () => {
    const r = rollDimensions(hanar, 'imperial', () => 0)
    expect(r.length).toEqual({ base: 48, rolls: [1, 1], total: 50 })
    for (let i = 0; i < 200; i++) {
      const { height, weight } = rollDimensions(human, 'imperial')
      expect(height!.total).toBeGreaterThanOrEqual(58)
      expect(height!.total).toBeLessThanOrEqual(76)
      expect(weight!.total).toBeGreaterThanOrEqual(110 + 2 * 2)
      expect(weight!.total).toBeLessThanOrEqual(110 + 20 * 8)
    }
  })

  it('keeps the base weight when there are no weight dice', () => {
    const r = rollDimensions({ ...human, weight: { base: { imperial: 90, metric: 40 }, mod: { imperial: { dieCount: 0, dieType: 4 }, metric: { dieCount: 0, dieType: 4 } } } }, 'imperial', () => 0)
    expect(r.weight?.total).toBe(90)
    expect(dimensionRollBreakdown(t, 'weight', r.weight!, 'imperial')).toBe('90 lbs')
  })
})
