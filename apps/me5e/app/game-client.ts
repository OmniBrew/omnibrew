/**
 * ME5e's parts for the character pages (the engine's `#game-client`, plan/24): the game
 * definition the rules engine runs, the old-character migrator for imports, and ME's
 * sheet panels and resource displays. Only the character pages import this module.
 */
import type { ImportReport, LegacyImporter, SheetParts } from '@omnibrew/engine/app/game-client'
import Consumables from './components/me/sheet/Consumables.vue'
import Reputation from './components/me/sheet/Reputation.vue'
import ResourceBarrier from './components/me/sheet/ResourceBarrier.vue'
import ResourceBarrierTicks from './components/me/sheet/ResourceBarrierTicks.vue'
import ResourceConsumable from './components/me/sheet/ResourceConsumable.vue'
import ResourceHeat from './components/me/sheet/ResourceHeat.vue'
import ResourceOmniGel from './components/me/sheet/ResourceOmniGel.vue'
import Shields from './components/me/sheet/Shields.vue'

export { me5eDefinition as definition } from '../game/definition'

export const importLegacy = (): Promise<LegacyImporter> => import('../migrate/character').then(m => (raw, opts) => {
  const { character, report } = m.migrateCharacter(raw, opts)
  return { character, report: report as unknown as ImportReport }
})

export const sheet: SheetParts = {
  slots: {
    side: [Reputation],
    gear: [Consumables],
    settings: [Shields],
  },
  resources: {
    'heat': ResourceHeat,
    'gear-consumable': ResourceConsumable,
    'omni-gel': ResourceOmniGel,
    'barrier': ResourceBarrier,
    'barrier-ticks': ResourceBarrierTicks,
  },
}
