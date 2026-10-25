import { describe, expect, it } from 'vitest'
import { npcPowerSlots, npcShieldsText, npcWeaponRules } from '../app/utils/bestiary'

const t = (key: string, named: Record<string, unknown>) => `${key}:${JSON.stringify(named)}`

describe('ME5e bestiary', () => {
  it('writes shields with their regeneration', () => {
    expect(npcShieldsText(t, { capacity: 10 })).toBe('10')
    expect(npcShieldsText(t, { capacity: 10, regen: 0 })).toBe('10')
    expect(npcShieldsText(t, { capacity: 10, regen: 5 })).toBe('npc.shields_w_regen:{"capacity":10,"n":5}')
  })

  it('reads power slots from a class progression', () => {
    const progression = { columns: [
      { label: 'prof_bonus', values: [2, 2, 2] },
      { label: 'power_slots_by_power_level', values: [[2, 3, 4], [0, 0, 2]] },
    ] }
    expect(npcPowerSlots(progression)).toEqual([[2, 3, 4], [0, 0, 2]])
    expect(npcPowerSlots(undefined)).toEqual([])
  })

  it('makes every weapon but melee ones ranged, and recoil weapons finesse', () => {
    expect(npcWeaponRules.rangedWeapon({ weaponType: 'shotgun' })).toBe(true)
    expect(npcWeaponRules.rangedWeapon({ weaponType: 'melee' })).toBe(false)
    expect(npcWeaponRules.finesseProperties).toContain('recoil')
  })
})
