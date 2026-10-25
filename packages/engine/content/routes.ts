import type { GameDefinition } from '../schemas/game'
import { recordPath } from '../shared/utils/records'
import { groupRecords, loadContent } from '../validator/load'
import { deriveRecords } from './derive'

/**
 * Every record page a content repo gives the site, from the game's record
 * routes (see `recordPath`): for prerendering, so pages no other page links to
 * are generated too. Routes that are an anchor on another page (`#{id}`) and
 * collections without pages are left out.
 */
export function recordPageRoutes(root: string, def: GameDefinition, routes: Record<string, string | false>): string[] {
  const { records } = loadContent(root, def)
  const byCollection = groupRecords(records)
  for (const [collection, derived] of Object.entries(deriveRecords(root, def))) {
    for (const r of derived) byCollection.get(collection)?.set(r.id, r)
  }
  const out = new Set<string>()
  for (const [collection, recs] of byCollection) {
    const template = routes[collection] ?? `/${collection}/{id}`
    if (template === false || template.includes('#')) continue
    for (const [id, record] of recs) {
      const path = recordPath(routes, collection, { ...record, id })
      if (path) out.add(path)
    }
  }
  return [...out].sort()
}
