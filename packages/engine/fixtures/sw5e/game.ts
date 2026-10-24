import { z } from 'zod'
import { defineGame } from '../../schemas/game'

/**
 * Star Wars 5e, as a test fixture: enough of a game definition to prove that
 * SW-shaped content fits the engine's extension points. The real SW5e app comes
 * after the ME5e cutover (plan/06).
 *
 * Sources are normalized (one file per record, no data/text split), which is
 * the layout ME5e content is expected to move to.
 */
const flat = (dir: string) => ({ data: dir })

export const sw5eFixture = defineGame({
  id: 'sw5e-fixture',
  name: 'Star Wars 5e (fixture)',
  namespace: 'sw',
  ruleset: '5e-2014',
  enums: {
    replace: {
      damageTypes: ['acid', 'cold', 'energy', 'fire', 'force', 'ion', 'kinetic', 'lightning', 'necrotic', 'poison', 'psychic', 'sonic', 'true'],
      rarities: ['standard', 'premium', 'prototype', 'advanced', 'legendary', 'artifact'],
      weaponTypes: ['simple_blaster', 'martial_blaster', 'simple_lightweapon', 'martial_lightweapon', 'simple_vibroweapon', 'martial_vibroweapon'],
    },
    extend: {
      powerTags: ['damage', 'control', 'buff', 'debuff', 'heal', 'movement', 'utility'],
      powerAlignments: ['light', 'dark', 'universal'],
    },
  },
  mechanics: [
    { type: 'sw:force-points-bonus', description: 'Extra force points (feats, species)', fields: k => ({ bonus: k.Formula }) },
  ],
  powerSystem: {
    maxLevel: 9,
    pools: [
      { id: 'points:force', kind: 'points', powerTypes: ['force'] },
      { id: 'points:tech', kind: 'points', powerTypes: ['tech'] },
    ],
    powerFields: k => ({ alignment: k.e('powerAlignments').optional() }),
  },
  fields: {
    armor: () => ({ stealthDisadvantage: z.boolean().optional() }),
  },
  sources: {
    'powers': flat('powers'),
    'classes': flat('classes'),
    'class-features': flat('class-features'),
    'weapons': { ...flat('weapons'), itemKind: 'weapon' },
    'armor': { ...flat('armor'), itemKind: 'armor' },
    'weapon-properties': flat('weapon-properties'),
    'armor-properties': flat('armor-properties'),
  },
  checks: ({ records, report }) => {
    // Force powers draw their casting ability from their alignment, so it is required.
    for (const [id, p] of records.get('powers') ?? []) {
      if (p.powerType === 'force' && !p.alignment) {
        report({ severity: 'error', category: 'schema', collection: 'powers', id, rule: 'force-power-alignment', message: 'force powers need an `alignment` (light, dark or universal)' })
      }
    }
  },
})

export default sw5eFixture
