// eslint-disable-next-line @typescript-eslint/triple-slash-reference -- the site imports this file too (v140 import), and only tsconfig.game.json lists the declaration
/// <reference path="./jsonpack.d.ts" />
import jsonpack from 'jsonpack/main'
import { RENAMED_IDS } from './renamed'

/**
 * Live bookmarks → the new site's (plan/28 §1.2, §2). Used by the migration Lambda for
 * account bookmarks and by the site for the old site's signed-out bookmarks (`v140`).
 *
 * Live: `{ model, modelId, data }`; `data` is jsonpack of the item for generated NPCs
 * (`genpc`) and homebrew, else empty. New: `{ type, recordId, data? }`:
 * - content records keep their collection as `type` (renamed ids follow, B20);
 * - a UUID id is homebrew: `type: 'homebrew'` with its title and page (B108);
 * - a generated NPC (`genpc`, or a `bestiary` id starting `generated`, as live) keeps the NPC
 *   (`data.npc`, `format: 'live'`) with a title and its page, the NPC generator.
 */
export interface LegacyBookmark {
  model?: string | null
  modelId?: string | null
  data?: string | Record<string, unknown> | null
}

export interface MappedBookmark {
  type: string
  recordId: string
  data?: Record<string, unknown>
}

const UUID = /^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i

/** Unpacks a live bookmark's `data` (jsonpack, JSON, or already an object). */
export function unpackData(data: LegacyBookmark['data']): Record<string, unknown> | null {
  if (!data) return null
  if (typeof data === 'object') return data
  try {
    const out = jsonpack.unpack(data) as unknown
    // jsonpack of a JSON string (live packed `JSON.stringify(item)`) unpacks to that string.
    const value = typeof out === 'string' ? JSON.parse(out) as unknown : out
    return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null
  }
  catch {
    try {
      const value = JSON.parse(data) as unknown
      return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null
    }
    catch {
      return null
    }
  }
}

/** One live bookmark in the new shape, or null when it names nothing usable. */
export function mapBookmark(b: LegacyBookmark): MappedBookmark | null {
  const model = typeof b.model === 'string' ? b.model : ''
  const id = typeof b.modelId === 'string' ? b.modelId : ''
  if (!model || !id) return null
  if (model === 'genpc' || (model === 'bestiary' && id.startsWith('generated'))) {
    const npc = unpackData(b.data)
    // Title and page, as the bookmarks page reads them; the NPC in the live generator's shape.
    return npc ? { type: 'genpc', recordId: id, data: { title: typeof npc.name === 'string' ? npc.name : id, to: `/generators/npc?bookmark=${encodeURIComponent(id)}`, npc, format: 'live' } } : null
  }
  if (UUID.test(id)) {
    const item = unpackData(b.data)
    const title = typeof item?.name === 'string' ? item.name : typeof item?.title === 'string' ? item.title : id
    return { type: 'homebrew', recordId: id, data: { title, to: `/homebrew/view?id=${id}` } }
  }
  return { type: model, recordId: RENAMED_IDS[model]?.[id] ?? id }
}

/** Live bookmarks in the new shape, duplicates (same type and id) and unusable ones dropped. */
export function mapBookmarks(list: LegacyBookmark[]): { bookmarks: MappedBookmark[], dropped: number } {
  const seen = new Set<string>()
  const bookmarks: MappedBookmark[] = []
  let dropped = 0
  for (const b of list) {
    const m = mapBookmark(b)
    const key = m ? `${m.type}/${m.recordId}` : ''
    if (!m) dropped++
    else if (!seen.has(key)) {
      seen.add(key)
      bookmarks.push(m)
    }
  }
  return { bookmarks, dropped }
}
