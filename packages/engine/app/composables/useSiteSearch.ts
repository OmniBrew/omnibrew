import MiniSearch, { type SearchResult } from 'minisearch'
import type { SearchDoc } from '../types/site'

/**
 * Site search over the prerendered `/search-index.json`, loaded on first use
 * and searched in the browser with MiniSearch (prefix and fuzzy matching, like
 * the old lunr search). Shared by the header palette and the /search page.
 */
export interface SearchHit {
  doc: SearchDoc
  score: number
  /** Matched terms, for highlighting. */
  terms: string[]
}

let index: MiniSearch<SearchDoc> | undefined
let docs = new Map<string, SearchDoc>()
let loading: Promise<void> | undefined

export function createSearchIndex(list: SearchDoc[]) {
  const mini = new MiniSearch<SearchDoc>({
    fields: ['title', 'parent', 'text'],
    searchOptions: { boost: { title: 4, parent: 1.5 }, prefix: true, fuzzy: 0.15, combineWith: 'AND' },
  })
  mini.addAll(list)
  return mini
}

/** Results for `query`, best first, optionally only from some groups. */
export function searchIndex(mini: MiniSearch<SearchDoc>, byId: Map<string, SearchDoc>, query: string, groups: string[] = []): SearchHit[] {
  if (!query.trim()) return []
  return mini.search(query)
    .map((r: SearchResult) => ({ doc: byId.get(String(r.id))!, score: r.score, terms: r.terms }))
    .filter(h => h.doc && (!groups.length || groups.includes(h.doc.group)))
}

export function useSiteSearch() {
  const open = useState('search:open', () => false)
  const ready = useState('search:ready', () => false)

  async function load() {
    loading ??= $fetch<SearchDoc[]>('/search-index.json').then((list) => {
      docs = new Map(list.map(d => [d.id, d]))
      index = createSearchIndex(list)
      ready.value = true
    })
    return loading
  }

  const search = (query: string, groups: string[] = []) => (index ? searchIndex(index, docs, query, groups) : [])

  return { open, ready, load, search }
}

/** Up to `length` characters of `text` around the first matched term. */
export function snippet(text: string, terms: string[], length = 180): string {
  const lower = text.toLowerCase()
  const at = Math.min(...terms.map(t => lower.indexOf(t.toLowerCase())).filter(i => i >= 0), Infinity)
  if (!Number.isFinite(at) || at < length / 3) return text.length > length ? `${text.slice(0, length)}…` : text
  const start = Math.max(0, at - Math.floor(length / 3))
  const end = Math.min(text.length, start + length)
  return `…${text.slice(start, end)}${end < text.length ? '…' : ''}`
}
