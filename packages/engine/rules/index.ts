import { characterSchema, type Character } from '../character/schema'
import type { Game } from '../schemas/game'
import { RulesContent } from './content'
import { HandlerRegistry } from './handlers'
import { Sheet } from './sheet'
import type { GameRules, Rec } from './types'

/**
 * The rules engine: a character plus content in, a computed sheet out.
 * Plain TypeScript, no Nuxt: the site, the builder, the migration Lambda and
 * the tests all call it the same way.
 *
 *   const rules = createRules(createGame(me5e), records)
 *   const sheet = rules.sheet(character)
 *   sheet.ac, sheet.skills.athletics.mod, sheet.powers, sheet.weaponAttacks...
 */
export interface Rules {
  content: RulesContent
  handlers: HandlerRegistry
  /** zod schema of a character of this game. */
  characterSchema: ReturnType<typeof characterSchema>
  sheet: (character: Character) => Sheet
}

export function createRules(game: Game, records: Map<string, Map<string, Rec>>, rules: GameRules | undefined = game.def.rules): Rules {
  if (!rules) throw new Error(`game "${game.def.id}" has no rules`)
  const content = new RulesContent(records, rules)
  const handlers = new HandlerRegistry(rules.handlers)
  return {
    content,
    handlers,
    characterSchema: characterSchema(game.def.character),
    sheet: character => new Sheet(character, content, rules, game, handlers),
  }
}

export { RulesContent, withDefaults, CARD_TYPES } from './content'
export { coreHandlers, defaultChoiceKey, HandlerRegistry } from './handlers'
export { CORE_FORMULAS, evaluateFormula } from './formula'
export { applyAugments, choiceMechanics, collectMechanics } from './collect'
export { Sheet } from './sheet'
export type { ClassView } from './sheet'
export * from './types'
export { damageText, dieIncrease, emptyAugments, type ResolvedCard, type ResolvedDamage } from './sections/cards'
export { dieSteps, selectedPowers, type PowerCard, type Powercasting } from './sections/powers'
export { gearRecords, type ActiveSetBonus, type EquipmentView, type OwnedItem, type OwnedWeapon } from './sections/equipment'
export { naturalWeapons, type WeaponAttacks } from './sections/weapons'
export { speciesTraits } from './sections/species'
