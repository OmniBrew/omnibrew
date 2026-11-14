/**
 * The old site's units and color mode, read once from its browser storage on the same
 * domain (plan/28 §2), before this site's own saved choices are restored. Only when the
 * reader has no choice saved here yet. Which key and which fields: `game.legacyPreferences`.
 */
export interface LegacyPreferencesConfig {
  /** The old site's localStorage key (a JSON object). */
  key: string
  /** Dot path to a boolean: true means imperial units. */
  imperial?: string
  /** Dot path to a boolean: true means dark mode. */
  darkMode?: string
}

type Storage = Pick<globalThis.Storage, 'getItem' | 'setItem'>

const at = (obj: unknown, path: string) => path.split('.').reduce<unknown>((cur, k) => (cur && typeof cur === 'object' ? (cur as Record<string, unknown>)[k] : undefined), obj)

/** Writes the old choices where this site keeps its own; returns what it set. */
export function importLegacyPreferences(config: LegacyPreferencesConfig | null | undefined, storage: Storage, keys: { preferences: string, colorMode: string, flag: string }) {
  const set: { units?: 'imperial' | 'metric', colorMode?: 'dark' | 'light' } = {}
  if (!config?.key) return set
  try {
    if (storage.getItem(keys.flag)) return set
    storage.setItem(keys.flag, '1')
    const raw = storage.getItem(config.key)
    if (!raw) return set
    const old = JSON.parse(raw) as unknown
    const imperial = config.imperial ? at(old, config.imperial) : undefined
    const dark = config.darkMode ? at(old, config.darkMode) : undefined
    if (typeof imperial === 'boolean' && !storage.getItem(keys.preferences)) {
      set.units = imperial ? 'imperial' : 'metric'
      storage.setItem(keys.preferences, JSON.stringify({ units: set.units }))
    }
    if (typeof dark === 'boolean' && !storage.getItem(keys.colorMode)) {
      set.colorMode = dark ? 'dark' : 'light'
      storage.setItem(keys.colorMode, set.colorMode)
    }
  }
  catch {
    // Storage blocked or the old value unreadable: nothing to bring over.
  }
  return set
}
