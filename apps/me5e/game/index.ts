import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { defineGame, Id, orNone, type CollectionSource, type GameCheckContext } from '@omnibrew/engine/schemas'
import { parse } from 'yaml'
import { z } from 'zod'
import { meLegacy } from './legacy'
import { meMechanics } from './mechanics'

/**
 * Mass Effect 5e on the 5e-2014 ruleset.
 *
 * `sources` describes masseffect-5e-data as it is today (data/ + text/en/ split).
 * When the content is normalized, only `sources` and `legacy` should need to change.
 */
const dataAndText = (dir: string, text = true): CollectionSource => ({ data: `data/${dir}`, text: text ? `text/en/${dir}` : undefined })

export const me5e = defineGame({
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
      primes: orNone(k.e('damageTypes')).optional(),
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
      shields: orNone(z.strictObject({ capacity: z.number(), regen: z.number().optional() })).optional(),
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
  },

  sources: {
    'actions': dataAndText('actions', false),
    'armor': { ...dataAndText('armor', false), itemKind: 'armor' },
    'attributions': dataAndText('attributions', false),
    'backgrounds': dataAndText('backgrounds'),
    'bestiary': dataAndText('bestiary'),
    'changelog': dataAndText('changelog', false),
    'character-progression': dataAndText('character-progression', false),
    'class-features': dataAndText('class-features', false),
    'classes': dataAndText('classes'),
    'edges': dataAndText('edges', false),
    'feats': dataAndText('feats'),
    'gear': { ...dataAndText('gear', false), itemKind: 'gear' },
    'mods': { ...dataAndText('mods', false), itemKind: 'mod' },
    'npc-stats': dataAndText('npc-stats', false),
    'powers': dataAndText('powers', false),
    'set-bonuses': dataAndText('set-bonuses', false),
    'skills': dataAndText('skills'),
    'species': dataAndText('species'),
    'subclasses': dataAndText('subclasses'),
    'subspecies': dataAndText('subspecies', false),
    'tool-profs': dataAndText('tool-profs'),
    'traits': dataAndText('traits'),
    'vehicles': dataAndText('vehicles'),
    'weapon-properties': dataAndText('weapon-properties'),
    'weapons': { ...dataAndText('weapons', false), itemKind: 'weapon' },
    'conditions': { text: 'text/en/conditions' },
    'guide': { text: 'text/en/guide' },
    'manual': { text: 'text/en/manual' },
    'ship-upgrades': { text: 'text/en/ship-upgrades' },
  },

  legacy: meLegacy,
  checks: meChecks,
})

/** Checks that only make sense for today's ME content and its build script. */
function meChecks({ root, records, report }: GameCheckContext) {
  // build-data.js silently drops powers without `version` or `tags`.
  for (const [id, p] of records.get('powers') ?? []) {
    for (const key of ['version', 'tags'] as const) {
      if (p[key] === undefined) {
        report({ severity: 'error', category: 'schema', collection: 'powers', id, rule: 'power-dropped-by-build', message: `no \`${key}\`: build-data.js skips this power, so it is missing from the site` })
      }
    }
  }

  // Manual and guide chapters are listed in index files; every leaf needs a page and every page an entry.
  for (const [index, collection] of [['data/manual-index.md', 'manual'], ['data/guides-index.md', 'guide']] as const) {
    const raw = readFileSync(join(root, index), 'utf8')
    const tree = parse(raw.split(/^---\s*$/m)[1] ?? '') as Array<{ id: string, sections?: unknown[] }>
    const leaves: string[] = []
    const all: string[] = []
    const walk = (nodes: unknown[]) => {
      for (const n of nodes as Array<{ id: string, sections?: unknown[] }>) {
        all.push(n.id)
        if (n.sections?.length) walk(n.sections)
        else leaves.push(n.id)
      }
    }
    walk(tree)
    const pages = records.get(collection) ?? new Map()
    for (const id of leaves) {
      if (!pages.has(id)) report({ severity: 'error', category: 'reference', collection, id, file: index, rule: 'index-entry-missing-page', message: `${index} lists "${id}" but text/en/${collection}/${id}.md does not exist` })
    }
    for (const id of pages.keys()) {
      if (!all.includes(id)) report({ severity: 'warning', category: 'reference', collection, id, rule: 'page-not-in-index', message: `page is not listed in ${index}, so the site never links to it` })
    }
  }
}
