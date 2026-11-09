/**
 * Bookmarks (plan/26 §1.1, decision 6): a reader bookmarks records signed out, and they
 * live in this browser (one localStorage entry per game) until sign-in uploads them, as
 * the live site did. A bookmark is a record's collection (`type`) and id; `data` keeps a
 * record that has no content file (3d's generated NPCs).
 */
export interface BookmarkRef {
  /** The stored row's id, once the bookmark is on the account. */
  id?: string
  type: string
  recordId: string
  data?: unknown
}

export const bookmarkKey = (b: Pick<BookmarkRef, 'type' | 'recordId'>) => `${b.type}/${b.recordId}`

type Storage = Pick<globalThis.Storage, 'getItem' | 'setItem' | 'removeItem'>

export function createLocalBookmarks(storage: Storage | null, game: string) {
  const key = `omnibrew:${game}:bookmarks`
  return {
    list(): BookmarkRef[] {
      try {
        const raw = storage?.getItem(key)
        const list = raw ? JSON.parse(raw) as unknown : []
        return Array.isArray(list) ? list.filter((b): b is BookmarkRef => typeof b?.type === 'string' && typeof b?.recordId === 'string') : []
      }
      catch {
        return []
      }
    },
    save(list: BookmarkRef[]) {
      storage?.setItem(key, JSON.stringify(list.map(({ type, recordId, data }) => (data === undefined ? { type, recordId } : { type, recordId, data }))))
    },
    clear() {
      storage?.removeItem(key)
    },
  }
}

/**
 * What signing in does with this browser's bookmarks: the ones the account lacks are
 * uploaded; duplicates (on the account twice, or in both places) collapse to one.
 */
export function mergeBookmarks(local: BookmarkRef[], remote: BookmarkRef[]) {
  const seen = new Set<string>()
  const keep: BookmarkRef[] = []
  const duplicates: BookmarkRef[] = []
  for (const b of remote) {
    if (seen.has(bookmarkKey(b))) duplicates.push(b)
    else {
      seen.add(bookmarkKey(b))
      keep.push(b)
    }
  }
  const upload: BookmarkRef[] = []
  for (const b of local) {
    if (seen.has(bookmarkKey(b))) continue
    seen.add(bookmarkKey(b))
    upload.push(b)
  }
  return { keep, upload, duplicates }
}

/** Bookmarks grouped by type, in the order `types` gives (unknown types last, by name). */
export function groupBookmarks<T extends Pick<BookmarkRef, 'type'>>(list: T[], types: string[]): Array<{ type: string, items: T[] }> {
  const groups = new Map<string, T[]>()
  for (const b of list) groups.set(b.type, [...groups.get(b.type) ?? [], b])
  const rank = (t: string) => (types.includes(t) ? types.indexOf(t) : types.length)
  return [...groups.entries()]
    .sort(([a], [b]) => rank(a) - rank(b) || a.localeCompare(b))
    .map(([type, items]) => ({ type, items }))
}
