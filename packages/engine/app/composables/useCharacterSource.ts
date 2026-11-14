import type { Character } from '@omnibrew/engine/character'
import type { UserData } from '@omnibrew/engine/data'

/** A character as the pages see it, wherever it is kept. */
export interface CharacterRecord {
  id: string
  character: Character
  /** Kept in this browser (not signed in, or not uploaded yet). */
  local: boolean
  /** The viewer may change it. */
  mine: boolean
  /** Save counter of a stored character (null for local ones and rows from before 3c-1). */
  revision: number | null
  updatedAt?: string
}

let localStore: LocalCharacters | null = null

/** This browser's characters for the game. */
export function useLocalCharacters(): LocalCharacters {
  if (localStore) return localStore
  let storage: Storage | null
  try {
    storage = localStorage
  }
  catch {
    // Blocked storage (some private modes): nothing is kept.
    storage = null
  }
  localStore = createLocalCharacters(storage, useNuxtApp().$characterGame.id)
  return localStore
}

/**
 * Characters wherever they live (plan/24 §1.4): the signed-in player's in the backend
 * (the data layer), anyone's in this browser under `local-` ids. Browser only.
 */
export function useCharacterSource() {
  const session = useSession()
  const local = useLocalCharacters()

  async function remote(): Promise<UserData | null> {
    if (!session.signedIn) return null
    return useUserData()
  }

  const fromLocal = (c: LocalCharacter): CharacterRecord => ({ id: c.id, character: c.character, local: true, mine: true, revision: null, updatedAt: c.updatedAt })

  return {
    local,

    /** The signed-in player's characters (newest first), then this browser's. */
    async list(): Promise<CharacterRecord[]> {
      const data = await remote()
      // A stored character that no longer validates is left out (and logged) instead of hiding the rest.
      const mine = data ? (await data.characters.list(bad => console.warn(`character ${bad.id} could not be read`, bad.error))).map((c): CharacterRecord => ({ id: c.id, character: c.character, local: false, mine: true, revision: c.revision, updatedAt: c.updatedAt })) : []
      mine.sort((a, b) => (b.updatedAt ?? '').localeCompare(a.updatedAt ?? ''))
      return [...mine, ...local.list().map(fromLocal)]
    },

    async get(id: string): Promise<CharacterRecord | null> {
      if (isLocalId(id)) {
        const c = local.get(id)
        return c ? fromLocal(c) : null
      }
      // Shared links read signed out too (the data layer's guest access); a signed-in owner
      // must be known first, or the read goes out as a guest and is refused.
      await session.settled()
      const data = await useUserData()
      if (!data) return null
      const c = await data.characters.get(id)
      if (c) return { id: c.id, character: c.character, local: false, mine: c.mine, revision: c.revision, updatedAt: c.updatedAt }
      // A shared link to a character still on the older backend (its owner hasn't signed in
      // here yet): converted for viewing, never saved (plan/28 decision 5).
      if (!useAppConfig().game.legacyMigration) return null
      const old = await data.legacy.character(id).catch(() => null)
      return old?.character ? { id: old.id, character: old.character, local: false, mine: false, revision: null } : null
    },

    /** Saves a new character: to the backend when signed in, else in this browser. */
    async create(character: Character): Promise<CharacterRecord> {
      const data = await remote()
      if (data) {
        const c = await data.characters.create(character)
        return { id: c.id, character: c.character, local: false, mine: true, revision: c.revision, updatedAt: c.updatedAt }
      }
      return fromLocal(local.create(character))
    },

    /** Saves a change; a stored character names the revision it started from (ConflictError otherwise). */
    async update(record: Pick<CharacterRecord, 'id' | 'local' | 'revision'>, character: Character): Promise<CharacterRecord> {
      if (record.local) return fromLocal(local.update(record.id, character))
      const data = await remote()
      if (!data) throw new Error('not signed in')
      const c = await data.characters.update(record.id, character, record.revision)
      return { id: c.id, character: c.character, local: false, mine: true, revision: c.revision, updatedAt: c.updatedAt }
    },

    async remove(record: Pick<CharacterRecord, 'id' | 'local'>) {
      if (record.local) return local.remove(record.id)
      const data = await remote()
      if (!data) throw new Error('not signed in')
      await data.characters.remove(record.id)
    },

    /**
     * Uploads this browser's characters to the signed-in account, as the live site did,
     * up to the account's limit; each uploaded one leaves this browser. Returns how many
     * moved and how many stayed (over the limit).
     */
    async upload(existing: number): Promise<{ uploaded: number, kept: number }> {
      const data = await remote()
      const waiting = local.list()
      if (!data || !waiting.length) return { uploaded: 0, kept: waiting.length }
      const profile = await data.profile.mine()
      let room = Math.max(0, (profile.maxCharacters ?? 50) - existing)
      let uploaded = 0
      for (const c of waiting.reverse()) {
        if (room <= 0) break
        await data.characters.create(c.character)
        local.remove(c.id)
        uploaded++
        room--
      }
      return { uploaded, kept: waiting.length - uploaded }
    },
  }
}
