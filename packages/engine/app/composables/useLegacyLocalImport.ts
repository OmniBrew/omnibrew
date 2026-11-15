import { createLocalBookmarks, mergeBookmarks } from '../utils/bookmarks'
import { ROLL_LOG_LIMIT } from '../stores/rolls'

/**
 * Brings the game's old site's browser data across, once per browser (plan/28 §2): its
 * local characters through the game's importer into this browser's characters (uploaded
 * on sign-in as usual), its signed-out bookmarks into this browser's, and the roll logs
 * of characters it moved or that keep their id on the account. The old data stays where
 * it is. The character list and the bookmarks page call it; `#game-client` loads only the
 * first time, when there may be something to read.
 */
export function useLegacyLocalImport() {
  const { $characterGame } = useNuxtApp()
  const game = $characterGame.id
  const flagKey = `omnibrew:${game}:legacy-local`

  async function run(): Promise<{ characters: number, failed: Array<{ name: string, raw: Record<string, unknown> }>, bookmarks: number } | null> {
    if (!import.meta.client) return null
    let storage: Storage
    try {
      storage = window.localStorage
      if (storage.getItem(flagKey)) return null
    }
    catch {
      return null
    }
    const { importLegacy, legacyLocal } = await import('#game-client')
    if (!legacyLocal) {
      storage.setItem(flagKey, new Date().toISOString())
      return null
    }
    const read = await legacyLocal()
    const old = read(storage)
    storage.setItem(flagKey, new Date().toISOString())
    if (!old) return null

    const failed: Array<{ name: string, raw: Record<string, unknown> }> = []
    const ids = new Map<string, string>()
    if (old.characters.length && importLegacy) {
      const [{ rules, game: g }, migrate] = await Promise.all([useRules(), importLegacy()])
      const local = useLocalCharacters()
      for (const c of old.characters) {
        try {
          const { character } = migrate(c.raw, { game: g, content: rules.content })
          ids.set(c.id, local.create(character).id)
        }
        catch {
          failed.push({ name: String(c.raw.name ?? '') || c.id, raw: c.raw })
        }
      }
    }

    // Logs follow their character: a moved one's new id, or the same id on the account.
    for (const [oldId, rolls] of Object.entries(old.logs)) {
      const key = `omnibrew:${game}:rolls:${ids.get(oldId) ?? oldId}`
      if (!storage.getItem(key)) storage.setItem(key, JSON.stringify(rolls.slice(-ROLL_LOG_LIMIT)))
    }

    let bookmarks = 0
    if (old.bookmarks.length) {
      const local = createLocalBookmarks(storage, game)
      const have = local.list()
      const { upload } = mergeBookmarks(old.bookmarks, have)
      bookmarks = upload.length
      local.save([...have, ...upload])
      // The store re-reads this browser's list (and uploads it when signed in).
      await useBookmarks().reload()
    }
    return { characters: ids.size, failed, bookmarks }
  }

  return { run }
}
