import { mapBookmarks, type LegacyBookmark, type MappedBookmark } from './bookmarks'

/**
 * The live site's browser storage (plan/28 §2): vuex-persistedstate under `v140`
 * (`user.{bookmarks,darkMode,imperial}`, `characters.{localCharacters,localLogs}`), or an
 * older `v131`/`v130` key the live site never migrated (`user.bookmarks` keyed by type,
 * `cb.characters` keyed by id). Browser-safe; read once, never changed.
 */
type Rec = Record<string, unknown>

/** The keys, newest first: the first one present is read. */
export const LEGACY_LOCAL_KEYS = ['v140', 'v131', 'v130'] as const

/** A roll log entry in the new site's shape (engine `RollEntry`, kept structural here). */
export interface LegacyRoll {
  id: string
  at: string
  label: string
  kind: string
  notation: string
  total: number
  dice: Array<{ sides: number, value: number, dropped?: boolean }>
}

export interface LegacyLocal {
  key: string
  /** Characters kept in the browser (never uploaded), as the importer reads them. */
  characters: Array<{ id: string, raw: Rec }>
  /** Signed-out bookmarks; ones the account already has (with an `id`) are left out. */
  bookmarks: MappedBookmark[]
  /** Roll logs by the old character id. */
  logs: Record<string, LegacyRoll[]>
  preferences: { units?: 'metric' | 'imperial', colorMode?: 'dark' | 'light' }
}

const isRec = (v: unknown): v is Rec => !!v && typeof v === 'object' && !Array.isArray(v)

const KINDS: Record<string, string> = { attack: 'attack', hit: 'attack', damage: 'damage', save: 'save', savingThrow: 'save', check: 'check', skill: 'check', ability: 'check', initiative: 'initiative' }

/** A live roll log entry (`store/character/roller.js`) in the new shape; null if it isn't one. */
export function convertRoll(entry: unknown, i: number): LegacyRoll | null {
  if (!isRec(entry) || !isRec(entry.data)) return null
  const d = entry.data
  const total = Number(d.total)
  if (!Number.isFinite(total)) return null
  const label = [d.detail, d.subDetail].filter(s => typeof s === 'string' && s).join(' — ') || (typeof d.text === 'string' ? d.text : '') || String(d.notation ?? '')
  const at = typeof entry.timestamp === 'string' && !Number.isNaN(Date.parse(entry.timestamp)) ? new Date(entry.timestamp).toISOString() : new Date(0).toISOString()
  return { id: `legacy-${i}-${at}`, at, label, kind: KINDS[String(d.type)] ?? 'custom', notation: String(d.notation ?? ''), total, dice: [] }
}

function parse(raw: string | null): Rec | null {
  if (!raw) return null
  try {
    const v = JSON.parse(raw) as unknown
    return isRec(v) ? v : null
  }
  catch {
    return null
  }
}

export function readLegacyLocal(storage: Pick<Storage, 'getItem'>): LegacyLocal | null {
  for (const key of LEGACY_LOCAL_KEYS) {
    let state: Rec | null
    try {
      state = parse(storage.getItem(key))
    }
    catch {
      return null
    }
    if (!state) continue
    const user = isRec(state.user) ? state.user : {}
    const out: LegacyLocal = { key, characters: [], bookmarks: [], logs: {}, preferences: {} }

    if (typeof user.imperial === 'boolean') out.preferences.units = user.imperial ? 'imperial' : 'metric'
    if (typeof user.darkMode === 'boolean') out.preferences.colorMode = user.darkMode ? 'dark' : 'light'

    if (key === 'v140') {
      const list = Array.isArray(user.bookmarks) ? user.bookmarks as Array<LegacyBookmark & { id?: string }> : []
      out.bookmarks = mapBookmarks(list.filter(b => !b?.id)).bookmarks
      const chars = isRec(state.characters) ? state.characters : {}
      const local = Array.isArray(chars.localCharacters) ? chars.localCharacters : []
      // The live debug page's `kitchenSink` character isn't a player's.
      out.characters = local.filter(isRec).filter(c => c.id !== 'kitchenSink').map(c => ({ id: String(c.id ?? ''), raw: c }))
      const logs = isRec(chars.localLogs) ? chars.localLogs : {}
      for (const [id, entries] of Object.entries(logs)) {
        if (!Array.isArray(entries)) continue
        const rolls = entries.map(convertRoll).filter((r): r is LegacyRoll => !!r)
        if (rolls.length) out.logs[id] = rolls
      }
    }
    else {
      // v131/v130: bookmarks keyed by type with whole items; characters keyed by id (pre-1.0.1).
      const byType = isRec(user.bookmarks) ? user.bookmarks : {}
      const list: LegacyBookmark[] = []
      for (const [type, items] of Object.entries(byType)) {
        for (const item of Array.isArray(items) ? items : []) {
          if (!isRec(item) || typeof item.id !== 'string') continue
          list.push(type === 'bestiary' && item.id.startsWith('generated') ? { model: 'genpc', modelId: item.id, data: item } : { model: type, modelId: item.id })
        }
      }
      out.bookmarks = mapBookmarks(list).bookmarks
      const cb = isRec(state.cb) ? state.cb : {}
      const chars = isRec(cb.characters) ? cb.characters : {}
      out.characters = Object.entries(chars).filter(([, c]) => isRec(c)).map(([id, c]) => ({ id, raw: c as Rec }))
    }
    return out
  }
  return null
}
