import type { Schema } from '@omnibrew/backend'
import type { Client } from 'aws-amplify/data'
import { type Character, type CharacterExtension, characterSchema, upgradeCharacter } from '../character'

/**
 * The user-data layer (plan/20): characters, profile, bookmarks and homebrew. The only
 * engine code that talks to the API; pages and stores go through it. Game-neutral: the
 * game passes its id and character extension.
 *
 * Every call reports failures by throwing `DataError` (the Amplify client returns
 * `errors` instead). JSON fields are sent as strings and read back from either form.
 */

export type DataClient = Client<Schema>

/** The signed-in user, from the session store. */
export interface DataSession {
  /** Cognito `sub`. */
  sub: string
  /** Cognito username (`google_…` for Google sign-ins, the sub for email accounts). */
  username: string
}

export interface UserDataOptions {
  client: DataClient
  game: { id: string, character?: CharacterExtension }
  /** The current session, or null when signed out. */
  session: () => DataSession | null
}

export class DataError extends Error {
  constructor(message: string, readonly details: unknown[] = []) {
    super(message)
    this.name = 'DataError'
  }
}

/** A character that doesn't match the game's character model. */
export class CharacterValidationError extends DataError {
  constructor(readonly issues: { path: PropertyKey[], message: string }[]) {
    super(`character is invalid: ${issues.map(i => `${i.path.join('.') || '(root)'} ${i.message}`).join('; ')}`, issues)
    this.name = 'CharacterValidationError'
  }
}

export interface StoredCharacter {
  id: string
  /** Whether the signed-in user owns it (shared links show others' characters). */
  mine: boolean
  /** Upgraded to the current model version. */
  character: Character
  createdAt?: string
  updatedAt?: string
}

export interface Profile {
  id: string
  username: string | null
  profileImg: string | null
  preferences: Record<string, unknown>
  contactMethod: string | null
  contactValue: string | null
  webhooks: unknown[]
  maxCharacters: number | null
  migratedAt: string | null
}

export type ProfilePatch = Partial<Pick<Profile, 'username' | 'profileImg' | 'preferences' | 'contactMethod' | 'contactValue' | 'webhooks'>>

export interface Bookmark {
  id: string
  type: string
  recordId: string
  data: unknown
}

export type HomebrewStatus = 'private' | 'development' | 'published'

export interface Homebrew {
  id: string
  kind: string
  title: string
  slug: string
  data: Record<string, unknown>
  status: HomebrewStatus
  official: boolean
  usageCount: number
  voteCount: number
  /** The author's profile id; set on others' homebrew. */
  authorId?: string | null
  createdAt?: string
  updatedAt?: string
}

export interface HomebrewInput {
  id?: string
  kind: string
  title: string
  data: Record<string, unknown>
  status: HomebrewStatus
}

export interface HomebrewTally {
  homebrewId: string
  usageCount: number
  voteCount: number
  active: boolean
}

interface Result<T> {
  data: T
  errors?: { message: string }[]
  nextToken?: string | null
}

function unwrap<T>(result: Result<T>, what: string): T {
  if (result.errors?.length) throw new DataError(`${what}: ${result.errors.map(e => e.message).join('; ')}`, result.errors)
  return result.data
}

/** Reads every page of a list query. */
async function all<T>(page: (nextToken: string | null) => Promise<Result<T[]>>, what: string): Promise<T[]> {
  const out: T[] = []
  let nextToken: string | null = null
  do {
    const result: Result<T[]> = await page(nextToken)
    out.push(...unwrap(result, what))
    nextToken = result.nextToken ?? null
  } while (nextToken)
  return out
}

/** AWSJSON comes back as a string. */
export function readJson<T>(value: unknown, fallback: T): T {
  if (value === null || value === undefined) return fallback
  if (typeof value !== 'string') return value as T
  try {
    return JSON.parse(value) as T
  }
  catch {
    return fallback
  }
}

/** The owner value Amplify writes for the signed-in user (`<sub>::<username>`). */
export function ownerKey(session: DataSession) {
  return `${session.sub}::${session.username}`
}

/** Whether an owner value (`<sub>::<username>`, or a Gen 1 bare sub or username) is the session's. */
export function isOwner(owner: string | null | undefined, session: DataSession | null) {
  if (!owner || !session) return false
  return owner.split('::').some(part => part === session.sub || part === session.username)
}

/** URL-safe id from a title (the live site's `titleId`). */
export function slugify(title: string) {
  return title.normalize('NFKD').replace(/\p{M}/gu, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
}

export function createUserData({ client, game, session }: UserDataOptions) {
  const schema = characterSchema(game.character)
  const authMode = () => (session() ? 'userPool' : 'identityPool') as 'userPool' | 'identityPool'

  function requireSession(what: string) {
    const current = session()
    if (!current) throw new DataError(`${what}: not signed in`)
    return current
  }

  /** Validates a character for this game; throws `CharacterValidationError`. */
  function validateCharacter(character: unknown): Character {
    const parsed = schema.safeParse(character)
    if (!parsed.success) throw new CharacterValidationError(parsed.error.issues.map(i => ({ path: i.path, message: i.message })))
    if (parsed.data.game !== game.id) throw new CharacterValidationError([{ path: ['game'], message: `is ${parsed.data.game}, expected ${game.id}` }])
    return parsed.data
  }

  type CharacterRow = { id: string, owner?: string | null, data: unknown, createdAt?: string, updatedAt?: string }

  function toStored(row: CharacterRow): StoredCharacter {
    const raw = readJson<Record<string, unknown>>(row.data, {})
    // Read with the current model; a stored character that no longer validates is a bug
    // to see, not to hide, so it throws like a bad write would.
    const character = validateCharacter(upgradeCharacter(raw))
    return { id: row.id, mine: isOwner(row.owner, session()), character, createdAt: row.createdAt, updatedAt: row.updatedAt }
  }

  function characterFields(character: Character) {
    return { game: character.game, version: character.version, name: character.name, data: JSON.stringify(character) }
  }

  const characters = {
    validate: validateCharacter,

    /** The signed-in user's characters. */
    async list(): Promise<StoredCharacter[]> {
      const owner = ownerKey(requireSession('list characters'))
      const rows = await all(nextToken => client.models.Character.listCharacterByOwner({ owner }, { limit: 100, nextToken }) as Promise<Result<CharacterRow[]>>, 'list characters')
      return rows.map(toStored)
    },

    /** Any character by id (shared links work signed out); null if there is none. */
    async get(id: string): Promise<StoredCharacter | null> {
      const row = unwrap(await client.models.Character.get({ id }, { authMode: authMode() }) as Result<CharacterRow | null>, 'get character')
      return row ? toStored(row) : null
    },

    /** Validates and creates a character; `id` keeps a known id (the Gen 1 one, in 3d). Returns it. */
    async create(character: Character, id?: string): Promise<StoredCharacter> {
      requireSession('create character')
      const valid = validateCharacter(character)
      const row = unwrap(await client.models.Character.create({ ...(id ? { id } : {}), ...characterFields(valid) }) as Result<CharacterRow | null>, 'create character')
      if (!row) throw new DataError('create character: no result')
      return toStored(row)
    },

    /** Validates and saves a character the user owns. */
    async update(id: string, character: Character): Promise<StoredCharacter> {
      requireSession('update character')
      const valid = validateCharacter(character)
      const row = unwrap(await client.models.Character.update({ id, ...characterFields(valid) }) as Result<CharacterRow | null>, 'update character')
      if (!row) throw new DataError(`update character: ${id} not found`)
      return toStored(row)
    },

    async remove(id: string): Promise<void> {
      requireSession('delete character')
      unwrap(await client.models.Character.delete({ id }) as Result<unknown>, 'delete character')
    },
  }

  type ProfileRow = {
    id: string
    username?: string | null
    profileImg?: string | null
    preferences?: unknown
    contactMethod?: string | null
    contactValue?: string | null
    webhooks?: unknown
    maxCharacters?: number | null
    migratedAt?: string | null
  }

  function toProfile(row: ProfileRow): Profile {
    return {
      id: row.id,
      username: row.username ?? null,
      profileImg: row.profileImg ?? null,
      preferences: readJson(row.preferences, {}),
      contactMethod: row.contactMethod ?? null,
      contactValue: row.contactValue ?? null,
      webhooks: readJson(row.webhooks, []),
      maxCharacters: row.maxCharacters ?? null,
      migratedAt: row.migratedAt ?? null,
    }
  }

  const profile = {
    /** The signed-in user's profile, created on first use. */
    async mine(): Promise<Profile> {
      requireSession('load profile')
      const row = unwrap(await client.mutations.ensureProfile() as Result<ProfileRow | null>, 'load profile')
      if (!row) throw new DataError('load profile: no result')
      return toProfile(row)
    },

    /** Another user's profile (homebrew authors); signed in only. */
    async get(id: string): Promise<Profile | null> {
      requireSession('get profile')
      const row = unwrap(await client.models.Profile.get({ id }, {
        // Others can't read the owner-only fields (webhooks, maxCharacters).
        selectionSet: ['id', 'username', 'profileImg', 'preferences', 'contactMethod', 'contactValue'],
      }) as Result<ProfileRow | null>, 'get profile')
      return row ? toProfile(row) : null
    },

    async update(patch: ProfilePatch): Promise<Profile> {
      const current = requireSession('update profile')
      const input: Record<string, unknown> = { id: current.sub, ...patch }
      if (patch.preferences) input.preferences = JSON.stringify(patch.preferences)
      if (patch.webhooks) input.webhooks = JSON.stringify(patch.webhooks)
      const row = unwrap(await client.models.Profile.update(input as Parameters<DataClient['models']['Profile']['update']>[0]) as Result<ProfileRow | null>, 'update profile')
      if (!row) throw new DataError('update profile: no profile')
      return toProfile(row)
    },
  }

  type BookmarkRow = { id: string, type: string, recordId: string, data?: unknown }
  const toBookmark = (row: BookmarkRow): Bookmark => ({ id: row.id, type: row.type, recordId: row.recordId, data: readJson(row.data, null) })

  const bookmarks = {
    async list(): Promise<Bookmark[]> {
      const owner = ownerKey(requireSession('list bookmarks'))
      const rows = await all(nextToken => client.models.Bookmark.listBookmarkByOwner({ owner }, { limit: 100, nextToken }) as Promise<Result<BookmarkRow[]>>, 'list bookmarks')
      return rows.map(toBookmark)
    },

    async add(type: string, recordId: string, data?: unknown): Promise<Bookmark> {
      requireSession('add bookmark')
      const row = unwrap(await client.models.Bookmark.create({ type, recordId, ...(data === undefined ? {} : { data: JSON.stringify(data) }) }) as Result<BookmarkRow | null>, 'add bookmark')
      if (!row) throw new DataError('add bookmark: no result')
      return toBookmark(row)
    },

    async remove(id: string): Promise<void> {
      requireSession('remove bookmark')
      unwrap(await client.models.Bookmark.delete({ id }) as Result<unknown>, 'remove bookmark')
    },
  }

  type HomebrewRow = {
    id: string
    kind: string
    title: string
    slug: string
    data: unknown
    status: HomebrewStatus | null
    official?: boolean | null
    usageCount?: number | null
    voteCount?: number | null
    authorId?: string | null
    createdAt?: string | null
    updatedAt?: string | null
  }

  function toHomebrew(row: HomebrewRow): Homebrew {
    return {
      id: row.id,
      kind: row.kind,
      title: row.title,
      slug: row.slug,
      data: readJson(row.data, {}),
      status: row.status ?? 'private',
      official: row.official ?? false,
      usageCount: row.usageCount ?? 0,
      voteCount: row.voteCount ?? 0,
      ...(row.authorId !== undefined ? { authorId: row.authorId } : {}),
      ...(row.createdAt ? { createdAt: row.createdAt } : {}),
      ...(row.updatedAt ? { updatedAt: row.updatedAt } : {}),
    }
  }

  const homebrew = {
    /** The signed-in user's homebrew. */
    async mine(): Promise<Homebrew[]> {
      const owner = ownerKey(requireSession('list homebrew'))
      const rows = await all(nextToken => client.models.Homebrew.listHomebrewByOwner({ owner }, { limit: 100, nextToken }) as Promise<Result<HomebrewRow[]>>, 'list homebrew')
      return rows.map(toHomebrew)
    },

    /** Someone else's published or in-development homebrew (null if private or missing). */
    async getPublic(id: string): Promise<Homebrew | null> {
      requireSession('get homebrew')
      const row = unwrap(await client.queries.getPublicHomebrew({ id }) as Result<HomebrewRow | null>, 'get homebrew')
      return row ? toHomebrew(row) : null
    },

    /** One page of published (default) or in-development homebrew of a kind. */
    async listPublic(kind: string, options: { status?: 'published' | 'development', limit?: number, nextToken?: string | null } = {}) {
      requireSession('list homebrew')
      const page = unwrap(await client.queries.listPublicHomebrew({ kind, status: options.status ?? 'published', limit: options.limit ?? 100, nextToken: options.nextToken ?? null }) as Result<{ items: (HomebrewRow | null)[], nextToken?: string | null } | null>, 'list homebrew')
      return { items: (page?.items ?? []).filter(i => i !== null).map(toHomebrew), nextToken: page?.nextToken ?? null }
    },

    /**
     * Creates or updates the user's homebrew. Published homebrew stays published (others
     * use it; the live site's rule). Validating `data` against its kind's record schema is 3c.
     */
    async save(input: HomebrewInput): Promise<Homebrew> {
      requireSession('save homebrew')
      const fields = { kind: input.kind, title: input.title, slug: slugify(input.title), data: JSON.stringify(input.data), status: input.status }
      if (!input.id) {
        const row = unwrap(await client.models.Homebrew.create(fields) as Result<HomebrewRow | null>, 'create homebrew')
        if (!row) throw new DataError('create homebrew: no result')
        return toHomebrew(row)
      }
      const current = unwrap(await client.models.Homebrew.get({ id: input.id }) as Result<HomebrewRow | null>, 'save homebrew')
      if (!current) throw new DataError(`save homebrew: ${input.id} not found`)
      if (current.status === 'published' && input.status !== 'published') throw new DataError('save homebrew: published homebrew stays published')
      const row = unwrap(await client.models.Homebrew.update({ id: input.id, ...fields }) as Result<HomebrewRow | null>, 'update homebrew')
      if (!row) throw new DataError(`update homebrew: ${input.id} not found`)
      return toHomebrew(row)
    },

    async remove(id: string): Promise<void> {
      requireSession('delete homebrew')
      unwrap(await client.models.Homebrew.delete({ id }) as Result<unknown>, 'delete homebrew')
    },

    /** Adds (or removes) a homebrew to the user's game; the usage count follows. */
    async setUse(homebrewId: string, active: boolean): Promise<HomebrewTally> {
      requireSession('use homebrew')
      const tally = unwrap(await client.mutations.setHomebrewUse({ homebrewId, active }) as Result<HomebrewTally | null>, 'use homebrew')
      if (!tally) throw new DataError('use homebrew: no result')
      return tally
    },

    /** Votes (or unvotes) for someone else's published homebrew. */
    async setVote(homebrewId: string, active: boolean): Promise<HomebrewTally> {
      requireSession('vote homebrew')
      const tally = unwrap(await client.mutations.setHomebrewVote({ homebrewId, active }) as Result<HomebrewTally | null>, 'vote homebrew')
      if (!tally) throw new DataError('vote homebrew: no result')
      return tally
    },

    /** Ids of the homebrew the user uses. */
    async used(): Promise<string[]> {
      const owner = ownerKey(requireSession('list used homebrew'))
      const rows = await all(nextToken => client.models.HomebrewUse.listHomebrewUseByOwner({ owner }, { limit: 100, nextToken }) as Promise<Result<{ homebrewId: string }[]>>, 'list used homebrew')
      return rows.map(r => r.homebrewId)
    },

    /** Ids of the homebrew the user voted for. */
    async voted(): Promise<string[]> {
      const owner = ownerKey(requireSession('list voted homebrew'))
      const rows = await all(nextToken => client.models.HomebrewVote.listHomebrewVoteByOwner({ owner }, { limit: 100, nextToken }) as Promise<Result<{ homebrewId: string }[]>>, 'list voted homebrew')
      return rows.map(r => r.homebrewId)
    },
  }

  return { characters, profile, bookmarks, homebrew }
}

export type UserData = ReturnType<typeof createUserData>
