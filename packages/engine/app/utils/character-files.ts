import type { Character } from '@omnibrew/engine/character'

/**
 * Character files (plan/24 §1.7). An export is `{ format, game, character }` (or
 * `characters` for several), the model as saved. An import takes that, or the live
 * site's exports: one old character, an array of them, or the pre-1.4 map of them,
 * which the game's migrator converts.
 */
export const EXPORT_FORMAT = 'omnibrew-character'

export type ImportItem =
  | { kind: 'current', game: string | null, character: unknown }
  | { kind: 'legacy', character: Record<string, unknown> }

type Obj = Record<string, unknown>
const isObject = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v)

/** An old n7.world character: the live model has `currentStats` and `meta.version`. */
export const isLegacyCharacter = (v: unknown): v is Obj => isObject(v) && (isObject(v.currentStats) || (isObject(v.meta) && typeof v.meta.version === 'string'))

export function exportFile(game: string, characters: Character[]) {
  return characters.length === 1 ? { format: EXPORT_FORMAT, game, character: characters[0] } : { format: EXPORT_FORMAT, game, characters }
}

/** File name for an export (`Todd.json`, `characters-2026-11-01.json`). */
export function exportName(characters: Character[], date = new Date()) {
  const name = characters.length === 1 ? characters[0]!.name.replace(/[^\p{L}\p{N} _-]+/gu, '').trim() : ''
  return `${name || `characters-${date.toISOString().slice(0, 10)}`}.json`
}

/** What a file holds; throws when it is no character file. */
export function parseImport(text: string): ImportItem[] {
  let data: unknown
  try {
    data = JSON.parse(text)
  }
  catch {
    throw new Error('not JSON')
  }
  if (isObject(data) && data.format === EXPORT_FORMAT) {
    const game = typeof data.game === 'string' ? data.game : null
    const list = Array.isArray(data.characters) ? data.characters : [data.character]
    return list.filter(isObject).map(character => ({ kind: 'current', game, character }))
  }
  const list = Array.isArray(data) ? data : isLegacyCharacter(data) ? [data] : isObject(data) ? Object.values(data) : []
  const out = list.filter(isLegacyCharacter).map((character): ImportItem => ({ kind: 'legacy', character }))
  if (!out.length) throw new Error('no characters')
  return out
}
