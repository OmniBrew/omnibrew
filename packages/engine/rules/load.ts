import { createGame, type Game, type GameDefinition } from '../schemas/game'
import { groupRecords, loadContent } from '../validator/load'
import { createRules, type Rules } from './index'
import type { Rec } from './types'

/**
 * Rules for a content repo checkout (Node only: reads files). Loads every
 * collection, adds the game's derived records (ME Exalted Lineages), and
 * builds the rules engine. The validator keeps the content valid, so load
 * issues are returned, not thrown.
 */
export function loadRules(root: string, def: GameDefinition, game: Game = createGame(def)): Rules & { issues: ReturnType<typeof loadContent>['issues'] } {
  const { records, issues } = loadContent(root, def)
  const grouped = groupRecords(records) as Map<string, Map<string, Rec>>
  if (def.derive) {
    const input = groupRecords(records.filter(r => def.derive!.from.includes(r.collection)))
    for (const [collection, derived] of Object.entries(def.derive.records(input))) {
      if (!grouped.has(collection)) grouped.set(collection, new Map())
      for (const record of derived) grouped.get(collection)!.set(record.id, record)
    }
  }
  return { ...createRules(game, grouped), issues }
}
