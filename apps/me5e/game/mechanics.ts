import { defineMechanic, type MechanicDefinition } from '@omnibrew/engine/schemas'
import { z } from 'zod'

/**
 * Mass Effect mechanics. Canonical names are namespaced `me:`; the bare names
 * in `legacy` are what today's content uses, and still validate.
 */
const perLevel = z.array(z.number().int().nonnegative()).length(20)
const capacity = (type: string, legacy: string, description: string) => defineMechanic({
  type, legacy: [legacy], description, fields: () => ({ value: z.number().int().nonnegative() }),
})
const flagOnly = (type: string, legacy: string, description: string) => defineMechanic({ type, legacy: [legacy], description, fields: () => ({}) })
const yakshiResource = (suffix: string) => defineMechanic({
  type: `me:ardat-yakshi-${suffix}`,
  legacy: [`ardat-yakshi-${suffix}`],
  description: 'Ardat-Yakshi trait tracker',
  fields: k => ({ resource: k.Resource }),
})

export const meMechanics: MechanicDefinition[] = [
  defineMechanic({
    type: 'me:shields',
    legacy: ['shields'],
    description: 'Kinetic shield capacity and regeneration (an HP layer)',
    fields: k => ({ capacity: k.Formula.optional(), regen: k.Formula.optional(), additive: z.boolean().optional() }),
  }),
  defineMechanic({
    type: 'me:barrier',
    legacy: ['barrier'],
    description: 'Biotic barrier: uses and ticks per level',
    fields: () => ({ dieCount: z.number().int(), dieType: z.number().int(), multiclassConversion: z.number(), ticks: perLevel, uses: perLevel }),
  }),
  flagOnly('me:tech-armor', 'tech-armor', 'Tech armor HP layer'),
  capacity('me:thermal-clip-capacity', 'thermal-clip-capacity', 'Thermal clips carried'),
  capacity('me:grenade-capacity', 'grenade-capacity', 'Grenades carried'),
  capacity('me:medi-gel-capacity', 'medi-gel-capacity', 'Medi-gel carried'),
  capacity('me:weapon-slots', 'weapon-slots', 'Extra weapon slots'),
  defineMechanic({
    type: 'me:weapon-heat-increase',
    legacy: ['weapon-heat-increase'],
    fields: () => ({ multiplier: z.number().optional(), value: z.number().optional() }),
  }),
  defineMechanic({
    type: 'me:weapon-augment',
    legacy: ['weapon-augment'],
    description: 'Ammo and weapon mods that change attacks',
    fields: k => ({
      name: z.string().optional(),
      toggle: z.boolean().optional(),
      addAoe: k.Aoe.optional(),
      addDamage: z.array(k.Damage).optional(),
      damageMultiplier: z.number().optional(),
      damageType: k.e('damageTypes').optional(),
      dc: k.Dc.optional(),
      detonates: z.boolean().optional(),
      primes: k.e('damageTypes').optional(),
      primeLength: z.string().optional(),
      primesLength: z.string().optional(),
      heatConsumption: z.number().optional(),
      hitBonus: z.number().optional(),
      longRangeMax: z.number().optional(),
      longRangeMultiplier: z.number().optional(),
      shortRangeMax: z.number().optional(),
      shortRangeMultiplier: z.number().optional(),
      onlyShortRange: z.boolean().optional(),
      notes: z.array(k.Note).optional(),
    }),
  }),
  defineMechanic({
    type: 'me:shoulder-mounts',
    legacy: ['shoulder-mounts'],
    fields: () => ({ max: z.number().int(), slots: z.number().int(), proficient: z.boolean().optional() }),
  }),
  defineMechanic({
    type: 'me:gradient-condition-increase',
    legacy: ['gradient-condition-increase'],
    fields: () => ({ condition: z.string(), value: z.number().int() }),
  }),
  defineMechanic({
    type: 'me:advancements-choice',
    legacy: ['advancements-choice'],
    description: 'Pick a power advancement',
    fields: k => ({
      options: z.literal(true).optional(),
      limit: z.strictObject({
        value: z.string().optional(),
        valueLookup: z.strictObject({ model: z.string(), id: z.string() }).optional(),
      }),
      label: k.choice.label,
    }),
  }),
  flagOnly('me:prevent-advancements', 'prevent-advancements', 'Powers from this source cannot take advancements'),
  flagOnly('me:cantrip-boost', 'cantrip-boost', 'Asari initiate armor cantrip boost'),
  flagOnly('me:featherlight', 'featherlight', 'Featherlight feat'),
  flagOnly('me:melee-gunner', 'melee-gunner', 'Melee Gunner feat'),
  defineMechanic({
    type: 'me:gun-strike-augment',
    legacy: ['gun-strike-augment'],
    fields: k => ({ value: z.strictObject({ damage: k.Damage }) }),
  }),
  defineMechanic({ type: 'me:avatars-inspiration', legacy: ['avatars-inspiration'], fields: () => ({ die: z.string().regex(/^d\d+$/) }) }),
  flagOnly('me:improved-avatars-inspiration', 'improved-avatars-inspiration', 'Improved Avatar inspiration'),
  flagOnly('me:advanced-medigel-application', 'advanced-medigel-application', 'Advanced medi-gel application'),
  flagOnly('me:emitter-hp', 'emitter-hp', 'Hologram emitter HP'),
  yakshiResource('addiction-dc'),
  yakshiResource('addiction-level'),
  yakshiResource('mating'),
  yakshiResource('stave-off'),
]
