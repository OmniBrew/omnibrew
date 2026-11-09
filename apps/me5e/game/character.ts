import type { CharacterExtension } from '@omnibrew/engine/character'
import { z } from 'zod'

/**
 * ME5e's parts of the character model (`state.game`, `options.game`, `overrides.game`).
 * Kept apart from the game definition (index.ts reads files with node:fs), so the site
 * can load it in the browser to validate characters before saving them.
 */
export const meCharacter: CharacterExtension = {
  state: () => ({
    paragon: z.number(),
    renegade: z.number(),
    indoctrination: z.number(),
    shieldsLost: z.number(),
    barrier: z.strictObject({ used: z.number(), ticksUsed: z.number() }),
    /** Weapons (equipment uuids) in shoulder mounts. */
    shoulderMounts: z.array(z.string()),
    techArmorMax: z.number(),
  }),
  options: () => ({
    weaponSlots: z.boolean(),
    grenadeSlots: z.boolean(),
    medigelSlots: z.boolean(),
    thermalClipSlots: z.boolean(),
    /** Thermal clip capacity is enforced (the live option behind the clips tracker). */
    thermalClips: z.boolean(),
    programInstall: z.boolean(),
    consumeThermalClips: z.boolean(),
  }),
  overrides: () => ({
    shields: z.number().int().nullable(),
    regen: z.number().int().nullable(),
    /** Equipment uuid, class id or `armor`: which shield source counts. */
    shieldSource: z.string().optional(),
  }),
  // Companions keep the live shields fields (`baseCompanion`): shields absorb damage before hit points.
  companion: {
    fields: () => ({
      shields: z.preprocess(v => (typeof v === 'string' && v.trim() !== '' ? Number(v) : v), z.number().finite()).catch(0),
      currentShields: z.preprocess(v => (typeof v === 'string' && v.trim() !== '' ? Number(v) : v), z.number().finite()).catch(0),
      regen: z.preprocess(v => (typeof v === 'string' && v.trim() !== '' ? Number(v) : v), z.number().finite()).catch(0),
    }),
    defaults: () => ({ shields: 0, currentShields: 0, regen: 0 }),
    pools: [{ id: 'shields', label: 'sheet.vitals.shields', color: 'text-alliance-600 dark:text-alliance-400', current: 'currentShields', max: 'shields', regen: 'regen' }],
  },
  // The live `characterTemplate`; every slot rule on, as live.
  defaults: () => ({
    state: { paragon: 0, renegade: 0, indoctrination: 0, shieldsLost: 0, barrier: { used: 0, ticksUsed: 0 }, shoulderMounts: [], techArmorMax: 0 },
    options: { weaponSlots: true, grenadeSlots: true, medigelSlots: true, thermalClipSlots: true, thermalClips: true, programInstall: true, consumeThermalClips: true },
    overrides: { shields: null, regen: null },
  }),
}
