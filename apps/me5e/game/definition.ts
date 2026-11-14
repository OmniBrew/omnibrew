import { defineGame, Id, orOff, type CollectionSource } from '@omnibrew/engine/schemas'
import { z } from 'zod'
import { meCharacter } from './character'
import { generateExaltedLineages } from './exalted-lineages'
import { meMechanics } from './mechanics'
import { mePlay } from './play'
import { meRules } from './rules'
import { meHomebrew } from './homebrew'
import { lootRewardShape, lootTableShape } from '../generators/loot-schema'

/**
 * Mass Effect 5e on the 5e-2014 ruleset.
 *
 * `sources` describes OmniBrew/masseffect-5e-data: one folder per collection
 * under `content/`, one `<id>.md` file per record. The repo's README documents it.
 *
 * Browser-safe (the character pages run the rules engine with it); the content
 * checks, which read files, are added in index.ts.
 */
const content = (dir: string, itemKind?: string): CollectionSource => ({ dir: `content/${dir}`, ...(itemKind ? { itemKind } : {}) })

export const me5eDefinition = defineGame({
  id: 'me5e',
  name: 'Mass Effect 5e',
  namespace: 'me',
  ruleset: '5e-2014',

  enums: {
    replace: {
      rarities: ['common', 'uncommon', 'rare', 'very_rare', 'spectre', 'varies'],
      weaponTypes: ['assault_rifle', 'heavy_pistol', 'melee', 'shotgun', 'smg', 'sniper_rifle'],
      creatureTypes: ['organic', 'synthetic', 'synorg', 'organic_or_synthetic'],
    },
    extend: {
      powerTags: ['buff', 'control', 'damage', 'debuff', 'heal', 'movement', 'protection', 'summon'],
      healingTypes: ['shields'],
      senses: ['infrared-vision'],
      timeUnits: ['attack'],
      resets: ['cast', 'manual', 'off'],
      resourceDisplays: ['gear-consumable', 'omni-gel', 'barrier-ticks'],
      edgeTypes: [
        'apex-augments', 'armiger-fuel', 'augment-boosts', 'bastion-tactics', 'benefits', 'commands', 'exalted-lineages',
        'fighting-styles', 'integrated-weaponry-damage', 'main-augments', 'maneuvers', 'metabiotics', 'premium-genetics',
        'primal-augments', 'primers', 'sneak-toxin', 'subgrounds', 'supercharged-augments', 'tracker-affinity',
        'tracker-affinity-advancement', 'training-regimens', 'weapon-of-choice',
      ],
      armorSlots: ['head', 'chest', 'arms', 'legs'],
      gearTypes: ['ammo', 'device', 'grenade', 'heavy_weapon', 'medi_gel', 'omni_gel', 'omni_tool_program', 'shield', 'tool'],
      itemTags: [
        'ability_skill_bonus', 'ac', 'additional_heat', 'attack_bonus', 'augmentation', 'damage_augment', 'damage_reroll',
        'detonates', 'extra_damage', 'heal', 'ignore_resistance', 'increased_range', 'item_capacity', 'melee_attacks',
        'movement', 'null_critical', 'power_regen', 'primes', 'reduced_weight', 'resistance', 'set_bonus',
        'shield_jumpstart', 'shield_regen', 'shields', 'special', 'vision',
      ],
      toolTypes: ['artisan', 'starship'],
      vehicleSizes: ['frigate', 'cruiser', 'carrier', 'dreadnought'],
      modPlacements: ['ammo', 'arms', 'barrel', 'body', 'chest', 'grip', 'head', 'legs', 'magazine', 'strike'],
      bestiaryUnits: ['alien', 'archetype', 'blood_pack', 'blue_suns', 'cerberus', 'collector', 'eclipse', 'geth', 'kett', 'mech', 'n_7', 'rachni', 'reaper', 'thorian', 'tracker'],
      galaxies: ['milky_way', 'andromeda'],
      speciesGroups: ['primary', 'expanded', 'lesser_known', 'villainous', 'andromeda'],
      formulaKinds: ['me:barrier-ticks', 'me:barrier-die-count', 'me:barrier-die-type'],
    },
    aliases: {
      formulaKinds: { barrierTicks: 'me:barrier-ticks', barrierDieCount: 'me:barrier-die-count', barrierDieType: 'me:barrier-die-type' },
      senses: { infrared_vision: 'infrared-vision' },
    },
  },

  mechanics: meMechanics,

  powerSystem: {
    // Powers are learned up to 5th level, but tech points (1 per level, limit 6 at engineer 19) cast up to 6th.
    maxLevel: 6,
    pools: [
      { id: 'slots', kind: 'slots', powerTypes: ['biotic', 'combat'] },
      { id: 'points:tech', kind: 'points', powerTypes: ['tech'] },
    ],
    powerFields: () => ({
      advancements: z.array(z.strictObject({
        id: Id,
        name: z.string(),
        text: z.string(),
        casting: z.array(z.looseObject({})).optional(),
      })).optional(),
    }),
    castingFields: k => ({
      primes: orOff(k.e('damageTypes')).optional(),
      detonates: z.boolean().optional(),
    }),
  },

  fields: {
    species: k => ({
      galaxy: k.e('galaxies').optional(),
      group: k.e('speciesGroups').optional(),
      bodyImg: z.string().optional(),
      bioticPotential: z.string().optional(),
      eyeColor: z.string().optional(),
      skinColor: z.string().optional(),
    }),
    edges: () => {
      const rep = z.strictObject({ min: z.number().optional(), within: z.number().optional(), greaterThan: z.enum(['paragon', 'renegade']).optional() })
      return {
        prereq: z.strictObject({ paragon: rep.optional(), renegade: rep.optional() }).optional(),
        threshold: z.number().int().optional(),
      }
    },
    weapons: () => ({ andromeda: z.boolean().optional(), slots: z.number().int().nonnegative().optional() }),
    armor: () => ({ andromeda: z.boolean().optional() }),
    vehicles: () => ({ sp: z.number().int().nonnegative().optional() }),
    bestiary: k => ({
      shields: z.strictObject({ capacity: z.number(), regen: z.number().optional() }).optional(),
      unit: k.e('bestiaryUnits'),
    }),
  },

  itemKinds: {
    mod: k => ({
      kind: z.literal('mod'),
      modType: z.enum(['armor', 'weapon']),
      placement: k.e('modPlacements'),
      availability: z.array(z.union([k.e('weaponTypes'), k.e('armorTypes')])).min(1),
    }),
  },

  collections: {
    'ship-upgrades': () => ({
      id: Id,
      body: z.string().optional(),
      name: z.string(),
      cost: z.union([z.number(), z.string()]),
      prerequisite: z.string(),
      system: z.string(),
    }),
    // The loot generator's tables (generators/loot-schema.ts).
    'loot-tables': lootTableShape,
    'loot-rewards': lootRewardShape,
  },

  sources: {
    'actions': content('actions'),
    'armor': content('armor', 'armor'),
    'attributions': content('attributions'),
    'backgrounds': content('backgrounds'),
    'bestiary': content('bestiary'),
    'changelog': content('changelog'),
    'character-progression': content('character-progression'),
    'class-features': content('class-features'),
    'classes': content('classes'),
    'edges': content('edges'),
    'feats': content('feats'),
    'gear': content('gear', 'gear'),
    'mods': content('mods', 'mod'),
    'npc-stats': content('npc-stats'),
    'powers': content('powers'),
    'set-bonuses': content('set-bonuses'),
    'skills': content('skills'),
    'species': content('species'),
    'subclasses': content('subclasses'),
    'subspecies': content('subspecies'),
    'tool-profs': content('tool-profs'),
    'traits': content('traits'),
    'vehicles': content('vehicles'),
    'weapon-properties': content('weapon-properties'),
    'weapons': content('weapons', 'weapon'),
    'conditions': content('conditions'),
    'guide': content('guide'),
    'manual': content('manual'),
    'ship-upgrades': content('ship-upgrades'),
    'loot-tables': content('loot-tables'),
    'loot-rewards': content('loot-rewards'),
  },

  derive: {
    from: ['species', 'traits'],
    records: input => ({ edges: generateExaltedLineages(input.get('species') ?? new Map(), input.get('traits') ?? new Map()) }),
  },

  rules: { ...meRules, play: mePlay },

  character: meCharacter,
  // Species cards: the square thumbnail (B105), else the body picture, which fills the square for every species but the volus.
  cardImage: { species: ['thumbnail', 'bodyImg', 'img'] },
  homebrew: meHomebrew,
})
