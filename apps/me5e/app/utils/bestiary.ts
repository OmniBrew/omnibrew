/**
 * ME5e bestiary conventions: shield text, how ME weapons become stat-block
 * attacks, and the power slots NPC powercasters use (the adept's progression).
 */
type Translate = (key: string, named: Record<string, unknown>) => string

/** Weapon types that make ranged attacks; the rest (melee) attack in melee. */
const RANGED_WEAPON_TYPES = ['assault_rifle', 'heavy_pistol', 'smg', 'shotgun', 'sniper_rifle']

/** The engine's StatBlockRules for ME5e weapons. */
export const npcWeaponRules = {
  /** Shown after the weapon's name: "M-25 Hornet (double-tap, hip-fire, burst-fire)". */
  titleProperties: ['two-handed', 'double-tap', 'hip-fire', 'burst-fire'],
  /** Recoil weapons, like finesse ones, use the better of Str and Dex. */
  finesseProperties: ['finesse', 'recoil'],
  rangedWeapon: (weapon: { weaponType?: string }) => RANGED_WEAPON_TYPES.includes(weapon.weaponType ?? ''),
}

/** The class whose progression gives NPC powercasters their power slots. */
export const NPC_POWERCASTING_CLASS = 'adept'

/** Shield capacity with its regeneration: "10 (regen 5)". */
export function npcShieldsText(t: Translate, shields: { capacity: number, regen?: number }): string {
  return shields.regen && shields.regen > 0 ? t('npc.shields_w_regen', { capacity: shields.capacity, n: shields.regen }) : String(shields.capacity)
}

/** A class progression's power slots: `[powerLevel - 1][classLevel - 1]`. */
export function npcPowerSlots(progression?: { columns?: { label: string, values?: unknown[] }[] }): number[][] {
  const column = progression?.columns?.find(c => c.label === 'power_slots_by_power_level')
  return (column?.values ?? []).filter((row): row is number[] => Array.isArray(row))
}
