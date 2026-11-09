import type { Character } from '@omnibrew/engine/character'
import type { Rules, Sheet } from '@omnibrew/engine/rules'

export type LoadState = 'idle' | 'loading' | 'ready' | 'missing' | 'error'

/** What a change does: a new character, from the current sheet. */
export type CharacterChange = (sheet: Sheet) => Character

const CHANNEL = 'omnibrew:characters'

/**
 * The character open on the sheet or in the builder (plan/24 §1.6): the character, its
 * computed sheet (rebuilt on every change: ~1 ms), and saving. Every change goes
 * through `apply`; the store saves 1.5 s after the last one, at once when the page is
 * hidden or left, and asks before the tab closes with a change unsaved. A save that
 * lost to another tab or device is a conflict the page resolves. Tabs of this browser
 * tell each other about saves, so an idle tab reloads instead of conflicting.
 */
export const useCharacterStore = defineStore('character', () => {
  const source = useCharacterSource()
  const id = ref<string | null>(null)
  const record = shallowRef<CharacterRecord | null>(null)
  const character = shallowRef<Character | null>(null)
  const loaded = shallowRef<LoadedRules | null>(null)
  const state = ref<LoadState>('idle')
  const error = ref<unknown>(null)
  const saveState = ref<SaveState>('saved')
  const saveError = ref<unknown>(null)

  const editable = computed(() => Boolean(record.value?.mine))

  // Homebrew (plan/26 §1.4): the character's copies, then the player's collection (newer for
  // its owner), join the content the rules read. Rules are rebuilt only when that set changes.
  const library = useHomebrewLibrary()
  const session = useSession()
  let homebrewRules: { key: string, rules: Rules } | null = null
  const rules = computed<Rules | null>(() => {
    const l = loaded.value
    const c = character.value
    if (!l) return null
    const extra = [...(c ? copiesOf(c) : []), ...library.collection]
    if (!extra.length) return l.rules
    const key = extra.map(h => `${h.id}@${h.updatedAt ?? ''}`).join('|')
    if (homebrewRules?.key !== key) {
      const itemKinds = Object.fromEntries(Object.entries(l.game.def.sources).map(([name, src]) => [name, src.itemKind]))
      homebrewRules = { key, rules: l.withRecords(mergeHomebrew(l.records, extra, itemKinds)) }
    }
    return homebrewRules.rules
  })
  const sheet = computed<Sheet | null>(() => (character.value && rules.value ? rules.value.sheet(character.value) : null))

  /** Copied homebrew whose record is gone (deleted by its author, or made private): the copy keeps working. */
  const goneHomebrew = ref<string[]>([])
  async function checkGone(c: Character) {
    const ids = Object.keys(c.homebrew ?? {}).filter(hid => !available.value.has(hid) && !library.mine.some(h => h.id === hid))
    if (!ids.length) return
    const data = await useUserData()
    const found = await Promise.all(ids.map(hid => data?.homebrew.getPublic(hid).catch(() => undefined)))
    goneHomebrew.value = ids.filter((_, i) => found[i] === null)
  }

  /** The homebrew the owner can see, by id: their collection. */
  const available = computed(() => new Map(library.collection.map(h => [h.id, h])))
  /** Brings the character's homebrew copies up to date (owner only); returns the ids refreshed. */
  function withCopies(next: Character): { character: Character, refreshed: string[] } {
    if (!editable.value || library.status !== 'ready') return { character: next, refreshed: [] }
    const synced = syncCopies(next, available.value)
    return { character: synced.character, refreshed: synced.refreshed }
  }

  const saver = createSaver<Character>({
    save: async (value) => {
      const current = record.value
      if (!current) return
      const saved = await source.update(current, value)
      // Keep the newest local edits; take the stored revision.
      record.value = { ...saved, character: character.value ?? saved.character }
      announce()
    },
    isConflict: e => (e as Error)?.name === 'ConflictError',
    onState: (s, e) => {
      saveState.value = s
      saveError.value = e ?? null
    },
  })

  let channel: BroadcastChannel | null = null
  function announce() {
    channel?.postMessage({ id: id.value, revision: record.value?.revision ?? null })
  }

  function listen() {
    if (channel || typeof BroadcastChannel === 'undefined') return
    channel = new BroadcastChannel(CHANNEL)
    channel.onmessage = (event: MessageEvent<{ id: string, revision: number | null }>) => {
      // Another tab saved this character: reload unless this tab has a change waiting.
      if (event.data.id === id.value && !saver.dirty) void reload()
    }
  }

  // The pages showing the open character. Moving between the builder and the sheet
  // mounts the new page before the old one unmounts, so the old page's leaving must
  // not close the character the new page just opened.
  const holders = new Set<symbol>()

  /** Opens a character for a page (`holder`, released with `release` when the page goes). */
  async function open(characterId: string, holder?: symbol) {
    if (holder) holders.add(holder)
    if (id.value === characterId && (state.value === 'ready' || state.value === 'loading')) return
    await close()
    id.value = characterId
    state.value = 'loading'
    error.value = null
    try {
      const [rules, found] = await Promise.all([useRules(), source.get(characterId)])
      if (id.value !== characterId) return
      loaded.value = rules
      if (!found) {
        state.value = 'missing'
        return
      }
      record.value = found
      character.value = found.character
      state.value = 'ready'
      listen()
      // The owner's collection joins the catalogs; newer versions of copied homebrew replace the copies.
      if (found.mine && session.signedIn) {
        goneHomebrew.value = []
        void library.load().then(() => {
          if (id.value !== characterId || !character.value) return
          void checkGone(character.value)
          const { character: next, refreshed } = withCopies(character.value)
          if (next === character.value) return
          character.value = next
          saver.change(next)
          if (refreshed.length) useToast().add({ title: useNuxtApp().$i18n.t('homebrew.copies_refreshed', { n: refreshed.length }), icon: 'i-lucide-refresh-cw' })
        })
      }
    }
    catch (e) {
      error.value = e
      state.value = 'error'
    }
  }

  async function reload() {
    if (!id.value) return
    const found = await source.get(id.value)
    if (!found) return
    record.value = found
    character.value = found.character
  }

  /** Applies a change (an action from rules/actions.ts) and schedules the save. View-only sheets don't change. */
  function apply(change: CharacterChange) {
    if (!sheet.value || !editable.value) return
    const changed = change(sheet.value)
    if (changed === character.value) return
    const next = withCopies(changed).character
    character.value = next
    saver.change(next)
  }

  /** Replaces the whole character (the builder, import). */
  function replace(next: Character) {
    if (!editable.value) return
    character.value = withCopies(next).character
    saver.change(character.value)
  }

  const flush = () => saver.flush()

  /** After a conflict: load the newer version (dropping this tab's change), or save this one over it. */
  async function resolveConflict(choice: 'theirs' | 'mine') {
    if (choice === 'theirs') {
      await saver.resolve('theirs')
      await reload()
      return
    }
    const mine = character.value
    const latest = id.value ? await source.get(id.value) : null
    if (latest && record.value) record.value = { ...record.value, revision: latest.revision }
    await saver.resolve('mine', mine ?? undefined)
  }

  /** A page is done with the character: closes it once no page holds it. */
  async function release(holder: symbol) {
    holders.delete(holder)
    if (!holders.size) await close()
  }

  async function close() {
    if (saver.dirty) await saver.flush().catch(() => {})
    saver.reset()
    channel?.close()
    channel = null
    id.value = null
    record.value = null
    character.value = null
    state.value = 'idle'
  }

  return {
    id, record, character, sheet, rules: loaded, goneHomebrew, state, error, saveState, saveError, editable,
    open, release, reload, apply, replace, flush, resolveConflict, close,
    get dirty() {
      return saver.dirty
    },
  }
})

/**
 * Saves the open character when the page is hidden or left, and asks before the tab
 * closes with a change unsaved. For the sheet and builder pages.
 */
export function useCharacterAutosave() {
  const store = useCharacterStore()
  const onHide = () => {
    if (document.visibilityState === 'hidden') void store.flush()
  }
  const onUnload = (event: BeforeUnloadEvent) => {
    if (!store.dirty) return
    void store.flush()
    event.preventDefault()
  }
  onMounted(() => {
    document.addEventListener('visibilitychange', onHide)
    window.addEventListener('beforeunload', onUnload)
  })
  onBeforeUnmount(() => {
    document.removeEventListener('visibilitychange', onHide)
    window.removeEventListener('beforeunload', onUnload)
  })
  onBeforeRouteLeave(async () => {
    await store.flush().catch(() => {})
  })
}
