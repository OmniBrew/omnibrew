import type { Character } from '@omnibrew/engine/character'
import type { GamePlay, Rec, Sheet, VitalPool } from '@omnibrew/engine/rules'
import { actions } from '@omnibrew/engine/rules'
import { barrier, capacities, shields } from './rules'

/**
 * ME's parts of playing a sheet (engine rules/actions.ts): barrier, tech armor and
 * shields before temp HP, indoctrination beside exhaustion, what rests restore, and
 * the equip rules behind the live sheet's preferences (weapon slots, omni-tool
 * programs, shoulder mounts).
 */
type MeState = { shieldsLost: number, indoctrination: number, barrier: { used: number, ticksUsed: number }, shoulderMounts: string[], techArmorMax: number }
const game = (c: Character) => c.state.game as MeState
const { edit } = actions

/** Omni-tool programs installed at once, when the option is on (the live "3"). */
export const PROGRAM_SLOTS = 3
export const TECH_ARMOR = 'tech-armor-hp'

function pools(sheet: Sheet): VitalPool[] {
  const out: VitalPool[] = []
  const b = barrier(sheet)
  if (b.ticks.max > 0 || b.uses.max > 0) {
    out.push({
      id: 'barrier',
      label: 'sheet.vitals.barrier',
      color: 'text-violet-600 dark:text-violet-400',
      ticks: true,
      ...(b.dieCount && b.dieType ? { roll: `${b.dieCount}d${b.dieType}` } : {}),
      absorbs: false,
      current: b.ticks.max - b.ticks.used,
      max: b.ticks.max,
      set: (c, current) => edit(c, (n) => {
        game(n).barrier.ticksUsed = b.ticks.max - current
      }),
    })
  }
  const techArmor = sheet.character.state.resources[TECH_ARMOR] ?? 0
  if (techArmor > 0 || sheet.ofType('me:tech-armor').length) {
    out.push({
      id: 'tech-armor',
      label: 'sheet.vitals.tech_armor',
      color: 'text-orange-800 dark:text-orange-400',
      absorbs: true,
      gainable: true,
      current: techArmor,
      max: Math.max(game(sheet.character).techArmorMax ?? 0, techArmor),
      // As live: the max follows the highest value, and resets once the armor is gone.
      set: (c, current) => edit(c, (n) => {
        n.state.resources[TECH_ARMOR] = current
        game(n).techArmorMax = current === 0 ? 0 : Math.max(game(n).techArmorMax ?? 0, current)
      }),
    })
  }
  const s = shields(sheet)
  if (s.max > 0) {
    out.push({
      id: 'shields',
      label: 'sheet.vitals.shields',
      color: 'text-alliance-600 dark:text-alliance-400',
      absorbs: true,
      bypassable: true,
      doublable: true,
      regen: s.regen,
      current: s.current,
      max: s.max,
      set: (c, current) => edit(c, (n) => {
        game(n).shieldsLost = Math.min(s.max, Math.max(0, s.max - current))
      }),
    })
  }
  return out
}

/** Weapon slots a weapon takes (record `slots`; heavy weapons take 2). */
const weaponSlots = (w: Rec) => Number(w.slots) || 0

/** Slots taken by equipped weapons outside the shoulder mounts. */
export function usedWeaponSlots(sheet: Sheet) {
  const mounted = game(sheet.character).shoulderMounts ?? []
  return sheet.equipment.equippedWeapons.filter(w => !mounted.includes(w.entry.uuid)).reduce((a, w) => a + weaponSlots(w.data), 0)
}

/** The shoulder-mount feature (max weapons, max slots, proficient weapons only), if the character has one. */
export function shoulderMounts(sheet: Sheet) {
  const m = sheet.ofType('me:shoulder-mounts')[0]
  if (!m) return null
  const mounted = game(sheet.character).shoulderMounts ?? []
  const weapons = sheet.equipment.weapons.filter(w => w.data.weaponType !== 'melee' && (!m.proficient || sheet.profs.weapon.includes(w.data.weaponType)))
  const slotsUsed = (except?: string) => weapons.filter(w => mounted.includes(w.entry.uuid) && w.entry.uuid !== except).reduce((a, w) => a + weaponSlots(w.data), 0)
  return {
    max: Number(m.max) || 0,
    slots: Number(m.slots) || 0,
    mounted,
    weapons: weapons.map(w => ({
      weapon: w,
      mounted: mounted.includes(w.entry.uuid),
      mountable: mounted.includes(w.entry.uuid) || (mounted.length + 1 <= (Number(m.max) || 0) && slotsUsed(w.entry.uuid) + weaponSlots(w.data) <= (Number(m.slots) || 0)),
    })),
  }
}

/** Mounts a weapon (equipping it) or takes it off its mount (as live: unequipping an equipped one). */
export function toggleShoulderMount(sheet: Sheet, uuid: string): Character {
  const mounted = game(sheet.character).shoulderMounts ?? []
  const equipped = sheet.character.equipment.find(e => e.uuid === uuid)?.equipped
  if (mounted.includes(uuid)) {
    return edit(sheet.character, (c) => {
      game(c).shoulderMounts = mounted.filter(x => x !== uuid)
      const e = c.equipment.find(x => x.uuid === uuid)
      if (e) e.equipped = false
    })
  }
  return edit(sheet.character, (c) => {
    game(c).shoulderMounts = [...mounted, uuid]
    const e = c.equipment.find(x => x.uuid === uuid)
    if (e && !equipped) e.equipped = true
  })
}

export const mePlay: GamePlay = {
  pools,

  gradients: (sheet) => {
    const extra = sheet.ofType('me:gradient-condition-increase').filter(m => m.condition === 'exhaustion').reduce((a, m) => a + (Number(m.value) || 0), 0)
    return [
      {
        id: 'exhaustion',
        value: sheet.character.state.exhaustion,
        max: actions.EXHAUSTION_LEVELS + extra,
        set: (c, value) => edit(c, (n) => {
          n.state.exhaustion = value
        }),
      },
      {
        id: 'indoctrinated',
        value: game(sheet.character).indoctrination ?? 0,
        max: 6,
        set: (c, value) => edit(c, (n) => {
          game(n).indoctrination = value
        }),
      },
    ]
  },

  restOptions: [{ id: 'reduceIndoctrination', rest: 'long', label: 'sheet.rest.reduce_indoctrination' }],

  // Both rests: barrier uses back and shields full (the live rest menu). Long: indoctrination, if asked.
  rest: (_sheet, character, type, options) => edit(character, (c) => {
    game(c).barrier.used = 0
    game(c).shieldsLost = 0
    if (type === 'long' && options.reduceIndoctrination) game(c).indoctrination = Math.max(0, (game(c).indoctrination ?? 0) - 1)
  }),

  canEquip: (sheet, uuid) => {
    const entry = sheet.character.equipment.find(e => e.uuid === uuid)
    if (!entry || entry.equipped) return null
    const options = sheet.character.options.game as Record<string, boolean | undefined>
    const weapon = sheet.equipment.weapons.find(w => w.entry.uuid === uuid)
    if (weapon) {
      const max = capacities(sheet).weaponSlots
      if (usedWeaponSlots(sheet) + weaponSlots(weapon.data) > max) return { key: 'sheet.equip.weapon_slots', params: { max } }
    }
    const gear = sheet.equipment.gear.find(g => g.entry.uuid === uuid)
    if (gear?.data.type === 'omni_tool_program' && options.programInstall) {
      const installed = sheet.equipment.equippedGear.filter(g => g.data.type === 'omni_tool_program').length
      if (installed >= PROGRAM_SLOTS) return { key: 'sheet.equip.programs', params: { max: PROGRAM_SLOTS } }
    }
    return null
  },

  // An unequipped weapon leaves its shoulder mount (the live REMOVE_FROM_SHOULDER_MOUNTS).
  onEquip: (_sheet, character, uuid, equipped) => {
    if (equipped || !game(character).shoulderMounts?.includes(uuid)) return character
    return edit(character, (c) => {
      game(c).shoulderMounts = game(c).shoulderMounts.filter(x => x !== uuid)
    })
  },

  advancements: sheet => !sheet.ofType('me:prevent-advancements').length,
}
