import type { Character } from '@omnibrew/engine/character'
import type { RulesContent } from '@omnibrew/engine/rules'
import type { Game } from '@omnibrew/engine/schemas'
import { MAX_WEBHOOKS, normalizeWebhooks, type DiscordWebhook } from '@omnibrew/engine/app/utils/discord'
import { mapBookmarks } from './bookmarks'
import { migrateCharacter } from './character'
import type { Gen1User } from './gen1'
import { convertHomebrew, type NewHomebrewRow } from './homebrew'

/**
 * One user's Gen 1 data → their rows on the new backend (plan/28 §1). Pure: the
 * `migrate-user` Lambda reads the tables, calls this, and writes what it returns with
 * conditional puts; the dry run calls it over a copy of every user.
 *
 * Re-runnable (decision 3: migrate once; a re-run only fills in what is missing): rows
 * that already exist are skipped, so nothing written on the new site is overwritten.
 */
type Rec = Record<string, unknown>
type Records = Map<string, Map<string, Rec>>

export interface Caller {
  /** Cognito sub: the new Profile id. */
  sub: string
  /** Cognito username: the Gen 1 `owner` and Profile id. */
  username: string
}

/** A row of the new Homebrew table, as far as the migration reads it. */
export interface ExistingHomebrew {
  id: string
  owner: string
  kind: string
  title?: string
  data: Rec
  updatedAt?: string | null
  /** Set on rows the conversion made private (plan/28 §1.3). */
  migration?: { status?: string } | null
}

/** The new profile as `ensureProfile` made it (or as the user left it on the beta). */
export interface ExistingProfile {
  username?: string | null
  profileImg?: string | null
  preferences?: Rec | null
  contactMethod?: string | null
  contactValue?: string | null
  webhooks?: unknown
  maxCharacters?: number | null
  migratedAt?: string | null
}

export interface MigrateUserInput {
  game: Game
  /** The rules content (`createRules(game, records).content`), for the character migrator. */
  content: RulesContent
  /** Content records, for `validateRecord` on the user's own homebrew. */
  records: Records
  caller: Caller
  gen1: Gen1User
  existing: {
    profile: ExistingProfile | null
    /** Ids of the user's Gen 1 characters already in the new table. */
    characterIds: Set<string>
    /** How many characters the user has on the new site now. */
    characterCount: number
    /** `type/recordId` of the user's new bookmarks. */
    bookmarkKeys: Set<string>
    /** Homebrew ids the user already uses / voted for on the new site. */
    useIds: Set<string>
    voteIds: Set<string>
  }
  /** New Homebrew rows by id: the user's own and every one their characters, uses and votes name. */
  homebrew: Map<string, ExistingHomebrew>
  /** Display name of a homebrew author, by the row's `owner` (copies show it). */
  authorName: (owner: string) => string | null
  now: string
  newId: () => string
  /** Checked before each character; when true the rest wait for the next call (AppSync's 30 s limit). */
  shouldStop?: () => boolean
}

export interface NewCharacterRow {
  id: string
  owner: string
  game: string
  version: number
  name: string
  data: Character
  migration: Rec
  createdAt: string
  updatedAt: string
}

export interface NewBookmarkRow { id: string, owner: string, type: string, recordId: string, data?: Rec, createdAt: string, updatedAt: string }
export interface NewTallyRow { id: string, owner: string, homebrewId: string, createdAt: string, updatedAt: string }

export interface ProfilePatch {
  username?: string
  preferences?: Rec
  contactMethod?: string
  contactValue?: string
  webhooks?: DiscordWebhook[]
  maxCharacters?: number
  legacyId: string
}

/** What the user is told, and what `Profile.migration` keeps. No character data. */
export interface UserMigrationReport {
  characters: { migrated: number, existing: number, failed: Array<{ id: string, name: string | null, message: string }>, pending: number }
  bookmarks: { migrated: number, existing: number, dropped: number }
  homebrew: { claimed: number, converted: number, private: Array<{ id: string, title: string }> }
  uses: number
  votes: number
  profile: { name: boolean, preferences: boolean, webhooks: number, picture: boolean }
  /** The character limit, when it was raised to fit (decision 2). */
  maxCharacters?: number
  /** Homebrew a character uses that the new table doesn't have (deleted on the old site). */
  missingHomebrew: string[]
}

export interface UserMigration {
  characters: NewCharacterRow[]
  bookmarks: NewBookmarkRow[]
  /** The user's homebrew already in the new table under their Gen 1 username: `owner` becomes theirs. */
  claims: string[]
  /** The user's homebrew the bulk run didn't write (created after it): converted now. */
  homebrew: NewHomebrewRow[]
  uses: NewTallyRow[]
  votes: NewTallyRow[]
  profile: ProfilePatch
  /** The Gen 1 picture's S3 key (under `public/`), when the new profile has none. */
  picture: string | null
  /** True when every character was handled (none waits for another call). */
  done: boolean
  report: UserMigrationReport
}

const DEFAULT_MAX = 50

const UUID = /^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i

/**
 * Homebrew ids a live character may name: every UUID under an `id` key (powers, equipment,
 * mods, picks). Over-collecting is harmless (the Lambda looks them up in one batch).
 */
export function homebrewIdsIn(value: unknown, out = new Set<string>()): Set<string> {
  if (Array.isArray(value)) for (const v of value) homebrewIdsIn(v, out)
  else if (value && typeof value === 'object') {
    for (const [k, v] of Object.entries(value)) {
      if (k === 'id' && typeof v === 'string' && UUID.test(v)) out.add(v)
      else homebrewIdsIn(v, out)
    }
  }
  return out
}

/** The Gen 1 picture key: `public/<username>-profile.<ext>` (stored with or without `public/`). */
export function pictureKey(profileImg: string | null | undefined): string | null {
  if (!profileImg || /^https?:/i.test(profileImg)) return null
  return profileImg.startsWith('public/') ? profileImg : `public/${profileImg}`
}

export function migrateUser(input: MigrateUserInput): UserMigration {
  const { caller, gen1, existing, now } = input
  const owner = `${caller.sub}::${caller.username}`
  const report: UserMigrationReport = {
    characters: { migrated: 0, existing: 0, failed: [], pending: 0 },
    bookmarks: { migrated: 0, existing: 0, dropped: 0 },
    homebrew: { claimed: 0, converted: 0, private: [] },
    uses: 0,
    votes: 0,
    profile: { name: false, preferences: false, webhooks: 0, picture: false },
    missingHomebrew: [],
  }

  // Homebrew: claim what the bulk run wrote under the Gen 1 username; convert the rest.
  const claims: string[] = []
  const homebrew: NewHomebrewRow[] = []
  const available = new Map(input.homebrew)
  for (const row of gen1.homebrew) {
    const there = available.get(row.id)
    if (there) {
      if (there.owner === caller.username) {
        claims.push(row.id)
        report.homebrew.claimed++
      }
      continue
    }
    const converted = { ...convertHomebrew(input.game, input.records, row), owner }
    homebrew.push(converted)
    available.set(row.id, { id: row.id, owner, kind: converted.kind, title: converted.title, data: converted.data, updatedAt: converted.updatedAt })
    report.homebrew.converted++
    if (converted.migration.status) report.homebrew.private.push({ id: row.id, title: converted.title })
  }
  for (const id of claims) {
    const h = available.get(id)!
    if (h.migration?.status) report.homebrew.private.push({ id, title: h.title ?? String(h.data.name ?? '') })
  }

  // Uses and votes: the copied counts already include them, so only the rows are written.
  const tally = (rows: Gen1User['uses'], have: Set<string>) => {
    const out: NewTallyRow[] = []
    for (const id of new Set(rows.map(r => r.homebrewId))) {
      if (!id || have.has(id) || !available.has(id)) continue
      const from = rows.find(r => r.homebrewId === id)!
      out.push({ id: `${caller.sub}#${id}`, owner, homebrewId: id, createdAt: from.createdAt ?? now, updatedAt: now })
    }
    return out
  }
  const uses = tally(gen1.uses, existing.useIds)
  const votes = tally(gen1.votes, existing.voteIds)
  report.uses = uses.length
  report.votes = votes.length

  // Bookmarks.
  const mapped = mapBookmarks(gen1.bookmarks)
  report.bookmarks.dropped = mapped.dropped
  const bookmarks: NewBookmarkRow[] = []
  for (const b of mapped.bookmarks) {
    if (existing.bookmarkKeys.has(`${b.type}/${b.recordId}`)) {
      report.bookmarks.existing++
      continue
    }
    const from = gen1.bookmarks.find(g => g.modelId === b.recordId)
    bookmarks.push({ id: input.newId(), owner, type: b.type, recordId: b.recordId, ...(b.data ? { data: b.data } : {}), createdAt: from?.createdOn ?? now, updatedAt: now })
    report.bookmarks.migrated++
  }

  // Characters, oldest first, each with copies of the homebrew it uses.
  const characters: NewCharacterRow[] = []
  const missing = new Set<string>()
  const todo = [...gen1.characters].sort((a, b) => (a.createdOn ?? '').localeCompare(b.createdOn ?? '') || a.id.localeCompare(b.id))
  for (const row of todo) {
    if (existing.characterIds.has(row.id)) {
      report.characters.existing++
      continue
    }
    if (input.shouldStop?.()) {
      report.characters.pending++
      continue
    }
    let name: string | null = null
    try {
      if (!row.data) throw new Error('the character has no data')
      const { character, report: r } = migrateCharacter(row.data, { game: input.game, content: input.content, now: row.updatedOn ?? now })
      name = character.name || null
      const copies: NonNullable<Character['homebrew']> = { ...character.homebrew }
      for (const ref of r.homebrew) {
        const id = ref.id!
        const h = available.get(id)
        if (!h) {
          missing.add(id)
          continue
        }
        copies[id] = { kind: h.kind, data: structuredClone(h.data), author: input.authorName(h.owner), updatedAt: h.updatedAt ?? null }
      }
      const data = Object.keys(copies).length ? { ...character, homebrew: copies } : character
      characters.push({
        id: row.id,
        owner,
        game: data.game,
        version: data.version,
        name: data.name,
        data,
        migration: { ...r, migratedAt: now, gen1UpdatedOn: row.updatedOn ?? null },
        createdAt: row.createdOn ?? now,
        updatedAt: row.updatedOn ?? now,
      })
      report.characters.migrated++
    }
    catch (e) {
      report.characters.failed.push({ id: row.id, name, message: (e as Error).message.slice(0, 300) })
    }
  }
  report.missingHomebrew = [...missing]

  // Profile: Gen 1 values fill only what the new profile doesn't have yet.
  const now1 = existing.profile ?? {}
  const g = gen1.profile
  const profile: ProfilePatch = { legacyId: caller.username }
  if (g) {
    const name = g.username?.trim()
    if (name && !now1.username) {
      profile.username = name.slice(0, 32)
      report.profile.name = true
    }
    const prefs = { ...(now1.preferences ?? {}) }
    let prefsChanged = false
    if (prefs.units === undefined && typeof g.imperial === 'boolean') {
      prefs.units = g.imperial ? 'imperial' : 'metric'
      prefsChanged = true
    }
    if (prefs.colorMode === undefined && typeof g.darkMode === 'boolean') {
      prefs.colorMode = g.darkMode ? 'dark' : 'light'
      prefsChanged = true
    }
    if (prefsChanged) {
      profile.preferences = prefs
      report.profile.preferences = true
    }
    if (g.contactMethod && !now1.contactMethod) profile.contactMethod = g.contactMethod
    if (g.contactValue && !now1.contactValue) profile.contactValue = g.contactValue
    const old = normalizeWebhooks(parseJson(g.webhooks)).filter(w => w.url)
    if (old.length) {
      const have = normalizeWebhooks(Array.isArray(now1.webhooks) ? now1.webhooks : parseJson(now1.webhooks))
      const urls = new Set(have.map(w => w.url))
      const added = old.filter(w => !urls.has(w.url)).slice(0, Math.max(0, MAX_WEBHOOKS - have.length))
      if (added.length) {
        profile.webhooks = [...have, ...added]
        report.profile.webhooks = added.length
      }
    }
  }
  // Decision 2: every character comes across; the limit rises to fit them.
  const limit = Math.max(g?.maxCharacters ?? DEFAULT_MAX, now1.maxCharacters ?? DEFAULT_MAX)
  const total = existing.characterCount + characters.length + report.characters.pending
  const max = Math.max(limit, total)
  if (max !== (now1.maxCharacters ?? DEFAULT_MAX)) profile.maxCharacters = max
  if (total > limit) report.maxCharacters = max

  const picture = !now1.profileImg ? pictureKey(g?.profileImg) : null
  report.profile.picture = !!picture

  return { characters, bookmarks, claims, homebrew, uses, votes, profile, picture, done: report.characters.pending === 0, report }
}

function parseJson(value: unknown): unknown {
  if (typeof value !== 'string') return value
  try {
    return JSON.parse(value)
  }
  catch {
    return null
  }
}
