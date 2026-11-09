import type { Homebrew, HomebrewInput } from '@omnibrew/engine/data'
import type { HomebrewRecord } from '../utils/homebrew'

/**
 * The signed-in player's homebrew (plan/26 §1.3–1.4): what they wrote (`mine`), what they
 * use (their collection, which joins the builder's and sheet's catalogs), what they voted
 * for, and authors' display names. Loaded once per session on the homebrew and character
 * pages; reference pages never touch it.
 */
export const useHomebrewLibrary = defineStore('homebrew', () => {
  const session = useSession()
  const mine = ref<Homebrew[]>([])
  /** Others' homebrew in the collection, by id (own homebrew is in `mine`). */
  const others = ref<Map<string, Homebrew>>(new Map())
  const used = ref<Set<string>>(new Set())
  const voted = ref<Set<string>>(new Set())
  const authors = ref<Map<string, string | null>>(new Map())
  const status = ref<'idle' | 'loading' | 'ready' | 'error'>('idle')
  const myName = ref<string | null>(null)
  let loadedFor: string | null = null
  let loading: Promise<void> | null = null

  async function data() {
    const d = await useUserData()
    if (!d) throw new Error('no backend')
    return d
  }

  /** Loads the library for the signed-in user (once; `force` reloads). */
  function load(force = false): Promise<void> {
    const owner = session.user?.sub ?? null
    if (!owner) {
      mine.value = []
      others.value = new Map()
      used.value = new Set()
      voted.value = new Set()
      status.value = 'idle'
      loadedFor = null
      return Promise.resolve()
    }
    if (!force && loadedFor === owner && (status.value === 'ready' || loading)) return loading ?? Promise.resolve()
    loadedFor = owner
    status.value = 'loading'
    loading = (async () => {
      try {
        const d = await data()
        const [own, usedIds, votedIds, profile] = await Promise.all([d.homebrew.mine(), d.homebrew.used(), d.homebrew.voted(), d.profile.mine().catch(() => null)])
        myName.value = profile?.username ?? null
        const ownIds = new Set(own.map(h => h.id))
        const fetched = await Promise.all(usedIds.filter(id => !ownIds.has(id)).map(id => d.homebrew.getPublic(id).catch(() => null)))
        mine.value = own
        others.value = new Map(fetched.filter((h): h is Homebrew => Boolean(h)).map(h => [h.id, h]))
        used.value = new Set(usedIds)
        voted.value = new Set(votedIds)
        status.value = 'ready'
      }
      catch {
        status.value = 'error'
      }
      finally {
        loading = null
      }
    })()
    return loading
  }

  const byId = (id: string) => mine.value.find(h => h.id === id) ?? others.value.get(id) ?? null

  /** Display names of authors (profile ids), fetched once each. */
  async function authorNames(ids: Array<string | null | undefined>) {
    const missing = [...new Set(ids.filter((id): id is string => Boolean(id) && !authors.value.has(id!)))]
    if (!missing.length) return
    const d = await data()
    const found = await Promise.all(missing.map(id => d.profile.get(id).catch(() => null)))
    const next = new Map(authors.value)
    missing.forEach((id, i) => next.set(id, found[i]?.username ?? null))
    authors.value = next
  }
  /** The author's display name: from their profile, or the player's own for their homebrew. */
  const authorOf = (h: Pick<Homebrew, 'id' | 'authorId'>) => (h.authorId ? authors.value.get(h.authorId) ?? null : mine.value.some(m => m.id === h.id) ? myName.value : null)

  /** The collection as rules records: used homebrew, own drafts included. */
  const collection = computed<HomebrewRecord[]>(() => [...used.value].map(byId).filter((h): h is Homebrew => Boolean(h)).map(h => ({
    id: h.id,
    kind: h.kind,
    data: h.data,
    author: authorOf(h),
    updatedAt: h.updatedAt ?? null,
  })))

  async function setUse(h: Homebrew, active: boolean) {
    const d = await data()
    const tally = await d.homebrew.setUse(h.id, active)
    const next = new Set(used.value)
    if (active) next.add(h.id)
    else next.delete(h.id)
    used.value = next
    if (active && !mine.value.some(m => m.id === h.id)) others.value = new Map(others.value).set(h.id, h)
    return tally
  }

  async function setVote(id: string, active: boolean) {
    const d = await data()
    const tally = await d.homebrew.setVote(id, active)
    const next = new Set(voted.value)
    if (active) next.add(id)
    else next.delete(id)
    voted.value = next
    return tally
  }

  async function save(input: HomebrewInput, validate?: Parameters<Awaited<ReturnType<typeof data>>['homebrew']['save']>[1]) {
    const d = await data()
    const saved = await d.homebrew.save(input, validate)
    mine.value = [saved, ...mine.value.filter(h => h.id !== saved.id)]
    return saved
  }

  async function remove(id: string) {
    const d = await data()
    if (used.value.has(id)) await d.homebrew.setUse(id, false).catch(() => null)
    await d.homebrew.remove(id)
    mine.value = mine.value.filter(h => h.id !== id)
    const next = new Set(used.value)
    next.delete(id)
    used.value = next
  }

  watch(() => session.user?.sub, () => {
    if (status.value !== 'idle') void load()
  })

  return { mine, others, used, voted, authors, myName, status, load, byId, authorNames, authorOf, collection, setUse, setVote, save, remove }
})
