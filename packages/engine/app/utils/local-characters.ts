import type { Character } from '@omnibrew/engine/character'

/**
 * Characters kept in this browser (plan/24 §1.4, decision A): a signed-out player
 * builds and plays without an account, and signing in uploads them. One
 * localStorage entry per game holds them all (a character is ~5 KB). Ids start with
 * `local-`, so a sheet link says where its character lives.
 */
export interface LocalCharacter {
  id: string
  character: Character
  createdAt: string
  updatedAt: string
}

export const LOCAL_PREFIX = 'local-'
export const isLocalId = (id: string | null | undefined) => Boolean(id?.startsWith(LOCAL_PREFIX))

type Store = Record<string, LocalCharacter>

export function createLocalCharacters(storage: Pick<Storage, 'getItem' | 'setItem'> | null, game: string, now = () => new Date().toISOString()) {
  const key = `omnibrew:${game}:characters`

  function read(): Store {
    try {
      const raw = storage?.getItem(key)
      return raw ? JSON.parse(raw) as Store : {}
    }
    catch {
      return {}
    }
  }

  function write(store: Store) {
    // Quota or blocked storage: the caller shows the save as failed.
    storage?.setItem(key, JSON.stringify(store))
  }

  return {
    /** Whether this browser can keep characters. */
    available: Boolean(storage),

    list(): LocalCharacter[] {
      return Object.values(read()).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    },

    get(id: string): LocalCharacter | null {
      return read()[id] ?? null
    },

    create(character: Character): LocalCharacter {
      const store = read()
      const id = `${LOCAL_PREFIX}${globalThis.crypto.randomUUID()}`
      const at = now()
      store[id] = { id, character, createdAt: at, updatedAt: at }
      write(store)
      return store[id]
    },

    update(id: string, character: Character): LocalCharacter {
      const store = read()
      const current = store[id]
      if (!current) throw new Error(`local character ${id} not found`)
      store[id] = { ...current, character, updatedAt: now() }
      write(store)
      return store[id]
    },

    remove(id: string) {
      write(Object.fromEntries(Object.entries(read()).filter(([k]) => k !== id)))
    },
  }
}

export type LocalCharacters = ReturnType<typeof createLocalCharacters>
