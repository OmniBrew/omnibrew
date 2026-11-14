import { bookmarkKey, createLocalBookmarks, mergeBookmarks, type BookmarkRef } from '../utils/bookmarks'

/**
 * The reader's bookmarks (plan/26 §1.1). Signed out they live in this browser and nothing
 * loads; signed in (Amplify is loaded already, B73) the account's list is read once per
 * session through the data layer, and this browser's bookmarks are uploaded and cleared.
 * Reference pages use only this store, so a signed-out reader never loads Amplify.
 */
export const useBookmarks = defineStore('bookmarks', () => {
  const session = useSession()
  const items = ref<BookmarkRef[]>([])
  const status = ref<'idle' | 'loading' | 'ready' | 'error'>('idle')
  /** Bookmarks being added or removed, by key. */
  const pending = ref(new Set<string>())
  let loadedFor: string | null | undefined
  let local: ReturnType<typeof createLocalBookmarks> | null = null

  function localStore() {
    if (!import.meta.client) return null
    let storage: Storage | null = null
    try {
      storage = window.localStorage
    }
    catch {
      // Blocked storage: bookmarks last for this page only.
    }
    local ??= createLocalBookmarks(storage, useNuxtApp().$characterGame.id)
    return local
  }

  /** Loads the list for the current session (once per signed-in user, or this browser's). */
  async function load() {
    if (!import.meta.client || session.status === 'loading') return
    const owner = session.user?.sub ?? null
    if (loadedFor === owner && status.value !== 'error') return
    loadedFor = owner
    const store = localStore()
    if (!owner) {
      items.value = store?.list() ?? []
      status.value = 'ready'
      return
    }
    status.value = 'loading'
    try {
      const data = await useUserData()
      if (!data) throw new Error('no backend')
      const remote = await data.bookmarks.list()
      const { keep, upload, duplicates } = mergeBookmarks(store?.list() ?? [], remote)
      const added = await Promise.all(upload.map(b => data.bookmarks.add(b.type, b.recordId, b.data)))
      await Promise.all(duplicates.map(b => (b.id ? data.bookmarks.remove(b.id) : null)))
      store?.clear()
      if (session.user?.sub === owner) {
        items.value = [...keep, ...added]
        status.value = 'ready'
      }
    }
    catch {
      status.value = 'error'
    }
  }

  const keys = computed(() => new Set(items.value.map(bookmarkKey)))
  const has = (type: string, recordId: string) => keys.value.has(bookmarkKey({ type, recordId }))

  /** Adds or removes a bookmark; throws when the account couldn't be updated. */
  async function toggle(type: string, recordId: string, data?: unknown) {
    const key = bookmarkKey({ type, recordId })
    if (pending.value.has(key)) return
    await load()
    pending.value.add(key)
    try {
      const existing = items.value.filter(b => bookmarkKey(b) === key)
      if (!session.signedIn) {
        items.value = existing.length ? items.value.filter(b => bookmarkKey(b) !== key) : [...items.value, { type, recordId, ...(data === undefined ? {} : { data }) }]
        localStore()?.save(items.value)
        return
      }
      const userData = await useUserData()
      if (!userData) throw new Error('no backend')
      if (existing.length) {
        await Promise.all(existing.map(b => (b.id ? userData.bookmarks.remove(b.id) : null)))
        items.value = items.value.filter(b => bookmarkKey(b) !== key)
      }
      else {
        items.value = [...items.value, await userData.bookmarks.add(type, recordId, data)]
      }
    }
    finally {
      pending.value.delete(key)
    }
  }

  // Load when the session settles, and again when the user changes.
  watch(() => [session.status, session.user?.sub], () => load())

  /** Reads the list again (after this browser's list changed outside the store, plan/28 §2). */
  function reload() {
    loadedFor = undefined
    return load()
  }

  return { items, status, pending, load, reload, has, toggle }
})
