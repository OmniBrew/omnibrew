import type { Character } from '@omnibrew/engine/character'
import type { Sheet } from '@omnibrew/engine/rules'

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

  const sheet = computed<Sheet | null>(() => (character.value && loaded.value ? loaded.value.rules.sheet(character.value) : null))
  const editable = computed(() => Boolean(record.value?.mine))

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

  async function open(characterId: string) {
    if (id.value === characterId && state.value === 'ready') return
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
    const next = change(sheet.value)
    if (next === character.value) return
    character.value = next
    saver.change(next)
  }

  /** Replaces the whole character (the builder, import). */
  function replace(next: Character) {
    if (!editable.value) return
    character.value = next
    saver.change(next)
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
    id, record, character, sheet, rules: loaded, state, error, saveState, saveError, editable,
    open, reload, apply, replace, flush, resolveConflict, close,
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
