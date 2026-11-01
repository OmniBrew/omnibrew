import { describe, expect, it } from 'vitest'
import { critNotation, damageNotation, isNotation, parseNotation, roll, signed, withAdvantage } from '../app/utils/dice'

/** A die that rolls the given values in turn. */
const seq = (...values: number[]) => {
  let i = 0
  return () => values[i++ % values.length]!
}

describe('dice', () => {
  it('parses notation', () => {
    expect(parseNotation('2d6+1d4-1')).toEqual([{ sign: 1, count: 2, sides: 6 }, { sign: 1, count: 1, sides: 4 }, { sign: -1, value: 1 }])
    expect(parseNotation('2d20kh1+3')[0]).toEqual({ sign: 1, count: 2, sides: 20, keep: { highest: true, n: 1 } })
    expect(parseNotation('d8min2')[0]).toEqual({ sign: 1, count: 1, sides: 8, min: 2 })
    expect(parseNotation('2d6ro<3')[0]).toEqual({ sign: 1, count: 2, sides: 6, reroll: 3 })
    expect(isNotation('2d6+')).toBe(false)
    expect(isNotation('hello')).toBe(false)
    expect(isNotation('500d6')).toBe(false)
  })

  it('rolls, keeps, raises and rerolls', () => {
    expect(roll('2d6+3', seq(4, 5)).total).toBe(12)
    const adv = roll('2d20kh1+1', seq(3, 17))
    expect(adv.total).toBe(18)
    expect(adv.natural).toBe(17)
    expect(adv.terms[0]!.dice[0]!.dropped).toBe(true)
    expect(roll('2d20kl1', seq(3, 17)).total).toBe(3)
    expect(roll('3d8min3', seq(1, 2, 8)).total).toBe(14)
    const rr = roll('1d6ro<3', seq(1, 5))
    expect(rr.total).toBe(5)
    expect(rr.terms[0]!.dice[0]!.rerolledFrom).toBe(1)
    expect(roll('1d6-2', seq(1)).total).toBe(-1)
    expect(roll('2d6', seq(6)).natural).toBeUndefined()
  })

  it('uses a uniform crypto die by default', () => {
    for (let i = 0; i < 200; i++) {
      const r = roll('1d20').total
      expect(r).toBeGreaterThanOrEqual(1)
      expect(r).toBeLessThanOrEqual(20)
    }
  })

  it('rolls with advantage, crits and damage dice', () => {
    expect(withAdvantage('1d20+5', 'advantage')).toBe('2d20kh1+5')
    expect(withAdvantage('d20-1', 'disadvantage')).toBe('2d20kl1-1')
    expect(withAdvantage('1d20+5', null)).toBe('1d20+5')
    expect(critNotation('2d6+3')).toBe('4d6+3')
    expect(critNotation('1d8+1d6-1', 1)).toBe('3d8+2d6-1')
    expect(damageNotation({ 6: 2, none: 0, bonus: 3 })).toBe('2d6+3')
    expect(damageNotation({ none: 1, bonus: 0 })).toBe('1')
    expect(damageNotation({ none: 1, bonus: -1 })).toBe('1-1')
    expect(damageNotation({ none: 0, bonus: 0 })).toBe('0')
    expect(damageNotation({ 8: 1, bonus: -1 })).toBe('1d8-1')
    expect(damageNotation({ 10: 2, bonus: 0 }, 3)).toBe('2d10ro<3')
    expect(signed(0)).toBe('+0')
    expect(signed(-2)).toBe('-2')
  })
})
