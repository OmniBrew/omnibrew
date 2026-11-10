import type { EffectTemplate, FieldDef, HomebrewKindDef } from '@omnibrew/engine/schemas'

/**
 * Homebrew in the browser (plan/26 §1.3–1.4), pure functions:
 * - the editor's field paths (`casting.0.range.short`), read and written with empty
 *   values dropped (content never holds empty strings or lists);
 * - homebrew records joining the rules' records (ids are Homebrew row UUIDs, which
 *   content ids can't be), marked `homebrew` with their author;
 * - copies on a character (`character.homebrew`), so a shared sheet computes for guests
 *   and a deleted record keeps working;
 * - the preview's "What changes" list.
 */
type Rec = Record<string, unknown>
type Records = Map<string, Map<string, Rec>>

/** A UUID: homebrew ids look like this, content ids never do (the validator checks). */
export const HOMEBREW_ID = /^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i
export const isHomebrewId = (id: unknown): id is string => typeof id === 'string' && HOMEBREW_ID.test(id)

const keys = (path: string) => path.split('.').map(k => (/^\d+$/.test(k) ? Number(k) : k))

export function getPath(obj: unknown, path: string): unknown {
  let cur: unknown = obj
  for (const k of keys(path)) {
    if (cur === null || typeof cur !== 'object') return undefined
    cur = (cur as Record<string | number, unknown>)[k]
  }
  return cur
}

/**
 * A deep copy of JSON data. Not `structuredClone`: the editor's records live in Vue state,
 * and `structuredClone` throws on a reactive proxy (`DataCloneError`).
 */
export function cloneData<T>(value: T): T {
  return value === undefined ? value : JSON.parse(JSON.stringify(value)) as T
}

const isEmpty = (v: unknown) => v === undefined || v === null || v === '' || (Array.isArray(v) && v.length === 0)
  || (typeof v === 'object' && v !== null && !Array.isArray(v) && Object.keys(v).length === 0)

/**
 * A copy of `obj` with `value` at `path`. An empty value removes the key, and objects
 * left empty go too (an AoE with no size and no shape), except array entries, which keep
 * their place (`casting.0`).
 */
export function setPath<T>(obj: T, path: string, value: unknown): T {
  const root = cloneData(obj ?? {}) as Rec
  const ks = keys(path)
  const chain: Array<Record<string | number, unknown>> = [root]
  let cur: Record<string | number, unknown> = root
  for (const [i, k] of ks.slice(0, -1).entries()) {
    const next = cur[k]
    if (next === null || typeof next !== 'object') cur[k] = typeof ks[i + 1] === 'number' ? [] : {}
    cur = cur[k] as Record<string | number, unknown>
    chain.push(cur)
  }
  const last = ks[ks.length - 1]!
  if (isEmpty(value)) {
    if (Array.isArray(cur) && typeof last === 'number') cur.splice(last, 1)
    else Reflect.deleteProperty(cur, last)
    // Prune emptied objects upward (never the root, never array slots).
    for (let i = chain.length - 1; i > 0; i--) {
      const parent = chain[i - 1]!
      const k = ks[i - 1]!
      if (isEmpty(chain[i]) && !Array.isArray(parent)) Reflect.deleteProperty(parent, k)
      else break
    }
  }
  else cur[last] = value
  return root as T
}

/** Whether a field shows, given its `when`. */
export const fieldShown = (field: FieldDef, record: unknown) => !field.when || field.when.is.includes(getPath(record, field.when.path))

/** Required fields left empty (shown ones only), as their paths. */
export function missingFields(fields: FieldDef[], record: unknown): string[] {
  return fields.filter(fl => fl.required && fieldShown(fl, record) && isEmpty(getPath(record, fl.path))).map(fl => fl.path)
}

/** A new homebrew record of a kind, optionally based on an official record (its fields and prose, a new id). */
export function newHomebrewRecord(kind: HomebrewKindDef, name: string, basedOn?: Rec | null): Rec {
  if (basedOn) {
    const { id: _id, author: _author, homebrew: _hb, kind: _kind, ...rest } = cloneData(basedOn)
    return { ...rest, name }
  }
  return { ...kind.defaults(), name }
}

/** A new effect from its template. */
export const newEffect = (t: EffectTemplate): Rec => ({ type: t.type, ...t.defaults?.() })

// --- homebrew in the rules -----------------------------------------------------------

/** A homebrew record as the rules see it: in its kind's collection, with its row id. */
export interface HomebrewRecord {
  id: string
  /** The collection (`weapons`). */
  kind: string
  data: Rec
  /** Shown on cards ("Homebrew by …"). */
  author?: string | null
  updatedAt?: string | null
}

/**
 * Homebrew text made safe to render with `<MDC>`: every `<` escaped, so no raw HTML (a
 * script, an event handler) reaches the page, whatever was stored through the API. MDC's
 * own components (`:distance{length=30}`) don't use `<` and still render.
 */
export function escapeTags<T>(value: T): T {
  if (typeof value === 'string') return value.replaceAll('<', '&lt;') as T
  if (Array.isArray(value)) return value.map(escapeTags) as T
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, escapeTags(v)])) as T
  return value
}

/** The rules' record of a homebrew record: its data (text escaped), its id, and the homebrew mark. */
export function rulesRecord(h: HomebrewRecord, itemKind?: string): Rec {
  const { body: _body, ...data } = escapeTags(h.data)
  return { ...data, ...(itemKind ? { kind: itemKind } : {}), id: h.id, homebrew: true, ...(h.author ? { author: h.author } : {}) }
}

/**
 * Content plus homebrew: a new map where only the collections homebrew joins are copied.
 * A homebrew id never replaces a content record. `itemKinds` names the item kind of item
 * collections (`weapons` → `weapon`), as content loading does.
 */
export function mergeHomebrew(records: Records, list: HomebrewRecord[], itemKinds: Record<string, string | undefined> = {}): Records {
  if (!list.length) return records
  const out: Records = new Map(records)
  for (const h of list) {
    if (!isHomebrewId(h.id)) continue
    const current = out.get(h.kind) ?? new Map<string, Rec>()
    if (current.has(h.id) && !current.get(h.id)!.homebrew) continue
    const copy = out.get(h.kind) === records.get(h.kind) ? new Map(current) : current
    copy.set(h.id, rulesRecord(h, itemKinds[h.kind]))
    out.set(h.kind, copy)
  }
  return out
}

// --- copies on characters ------------------------------------------------------------

/** A homebrew record kept on a character (`character.homebrew[id]`). */
export interface HomebrewCopy {
  kind: string
  data: Rec
  author?: string | null
  updatedAt?: string | null
}

interface CharacterLike {
  powers?: Array<{ id: string }>
  equipment?: Array<{ id: string, mods?: Array<{ id: string }> }>
  choices?: Array<{ values: unknown[] }>
  homebrew?: Record<string, HomebrewCopy>
}

/** Every homebrew id the character uses: learned powers, equipment and its mods, choice picks. */
export function referencedHomebrew(character: CharacterLike): Set<string> {
  const ids = new Set<string>()
  for (const p of character.powers ?? []) if (isHomebrewId(p.id)) ids.add(p.id)
  for (const e of character.equipment ?? []) {
    if (isHomebrewId(e.id)) ids.add(e.id)
    for (const m of e.mods ?? []) if (isHomebrewId(m.id)) ids.add(m.id)
  }
  for (const c of character.choices ?? []) for (const v of c.values) if (isHomebrewId(v)) ids.add(v)
  return ids
}

export const copiesOf = (character: CharacterLike): HomebrewRecord[] =>
  Object.entries(character.homebrew ?? {}).map(([id, c]) => ({ id, kind: c.kind, data: c.data, author: c.author ?? null, updatedAt: c.updatedAt ?? null }))

/**
 * The character's copies brought up to date with the homebrew it can see (`available`):
 * a newly used record is copied, a newer version replaces the copy. Copies of records it
 * no longer uses stay until removed (they're listed with the stale picks). Returns the
 * same object when nothing changed, and the ids it refreshed.
 */
export function syncCopies<T extends CharacterLike>(character: T, available: Map<string, HomebrewRecord>): { character: T, added: string[], refreshed: string[] } {
  const added: string[] = []
  const refreshed: string[] = []
  const copies = { ...character.homebrew }
  for (const id of referencedHomebrew(character)) {
    const source = available.get(id)
    if (!source) continue
    const copy = copies[id]
    if (!copy) added.push(id)
    else if (source.updatedAt && (!copy.updatedAt || source.updatedAt > copy.updatedAt)) refreshed.push(id)
    else continue
    copies[id] = { kind: source.kind, data: cloneData(source.data), author: source.author ?? null, updatedAt: source.updatedAt ?? null }
  }
  if (!added.length && !refreshed.length) return { character, added, refreshed }
  return { character: { ...character, homebrew: copies }, added, refreshed }
}

/** Copies the character no longer uses. */
export function unusedCopies(character: CharacterLike): string[] {
  const used = referencedHomebrew(character)
  return Object.keys(character.homebrew ?? {}).filter(id => !used.has(id))
}

export function removeCopy<T extends CharacterLike>(character: T, id: string): T {
  const { [id]: _gone, ...rest } = character.homebrew ?? {}
  return { ...character, homebrew: rest }
}

// --- the preview's "What changes" ------------------------------------------------------

/** One line of a sheet summary (`rules/summary.ts`). */
export interface SummaryLine {
  key: string
  value: string
}

/** Lines that differ between two summaries (before → after), added or gone included. */
export function diffSummaries(before: SummaryLine[], after: SummaryLine[]): Array<{ key: string, before: string | null, after: string | null }> {
  const a = new Map(before.map(l => [l.key, l.value]))
  const b = new Map(after.map(l => [l.key, l.value]))
  const out: Array<{ key: string, before: string | null, after: string | null }> = []
  for (const [key, value] of b) if (a.get(key) !== value) out.push({ key, before: a.get(key) ?? null, after: value })
  for (const [key, value] of a) if (!b.has(key)) out.push({ key, before: value, after: null })
  return out
}
