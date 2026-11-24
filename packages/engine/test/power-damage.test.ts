import { describe, expect, it } from 'vitest'
import { damageBySlot, rollText } from '../app/utils/powers'

describe('damageBySlot', () => {
  it('tabulates a leveled power\'s damage at each listed slot level', () => {
    const warp = { level: 2, casting: [{ damage: [{ dieCount: 3, dieType: 10, type: 'necrotic' }] }, { damage: [{ dieCount: 5 }] }, { damage: [{ dieCount: 7 }] }, { damage: [{ dieCount: 9 }] }] }
    expect(damageBySlot(warp)).toEqual({ levels: [2, 3, 4, 5], rows: [{ type: 'necrotic', rolls: ['3d10', '5d10', '7d10', '9d10'] }] })
  })

  it('keeps flat bonuses, drops rows that never change, and stops at the highest level', () => {
    const field = { level: 1, casting: [
      { damage: [{ type: 'temp', bonus: { type: 'flat', value: 5 } }, { type: 'cold', bonus: { type: 'flat', value: 5 } }, { dieCount: 1, dieType: 4, type: 'fire' }] },
      { damage: [{ bonus: { value: 10 } }, { bonus: { value: 10 } }] },
      { damage: [{ bonus: { value: 15 } }, { bonus: { value: 15 } }] },
    ] }
    expect(damageBySlot(field, 2)).toEqual({ levels: [1, 2], rows: [{ type: 'temp', rolls: ['5', '10'] }, { type: 'cold', rolls: ['5', '10'] }] })
  })

  it('has nothing for cantrips, powers without damage or without upcasts', () => {
    expect(damageBySlot({ level: 0, casting: [{ damage: [{ dieCount: 1, dieType: 8 }] }, { damage: [{ dieCount: 2 }] }] })).toBeNull()
    expect(damageBySlot({ level: 1, casting: [{}, {}] })).toBeNull()
    expect(damageBySlot({ level: 1, casting: [{ damage: [{ dieCount: 1, dieType: 8 }] }] })).toBeNull()
  })

  it('prints rolls', () => {
    expect(rollText({ dieCount: 2, dieType: 6, bonus: { type: 'flat', value: 3 } })).toBe('2d6 + 3')
    expect(rollText({ dieCount: { type: 'level' }, dieType: 6 })).toBe('—')
    expect(rollText({})).toBe('—')
  })
})
