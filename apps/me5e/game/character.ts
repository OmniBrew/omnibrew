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
}
