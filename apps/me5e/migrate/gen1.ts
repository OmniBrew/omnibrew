/**
 * Rows of the live site's Gen 1 backend (`masseffect-5e/amplify/backend/api/masseffect5e/schema.graphql`),
 * as DynamoDB holds them once unmarshalled (plan/28). Browser-safe: no AWS SDK here.
 *
 * - `owner` is the Cognito **username** on every model; a Profile's id is the username too
 *   (its `owner` may be `<sub>::<username>` on newer rows).
 * - Bookmark, Profile and Character stamp `createdOn`/`updatedOn`; the homebrew models
 *   `createdAt`/`updatedAt`.
 * - A Character's `data` is jsonpack; a Homebrew's `data` is AWSJSON (a JSON string or a map).
 */

export interface Gen1Profile {
  id: string
  owner?: string
  username?: string | null
  profileImg?: string | null
  imperial?: boolean | null
  darkMode?: boolean | null
  maxCharacters?: number | null
  contactMethod?: string | null
  contactValue?: string | null
  /** A JSON string: `[{ id, name, link, characters: [{ name, id }] }]`. */
  webhooks?: string | null
  createdOn?: string
  updatedOn?: string
}

export interface Gen1Character {
  id: string
  owner: string
  /** jsonpack of the live character (`meta.version` up to 1.0.2). */
  data?: string | null
  createdOn?: string
  updatedOn?: string
}

export interface Gen1Bookmark {
  id: string
  owner: string
  /** `weapons`, `armor`, `gear`, `mods`, `vehicles`, `powers`, `bestiary`, `genpc`. */
  model: string
  modelId: string
  /** jsonpack of the item, for generated NPCs and homebrew; otherwise empty. */
  data?: string | null
  createdOn?: string
  updatedOn?: string
}

export interface Gen1Homebrew {
  id: string
  owner: string
  title: string
  titleId?: string
  /** The old record shape (`html`, powers' `mechanics` as casting, `type`). */
  data: string | Record<string, unknown>
  /** `powers` or `weapons`. */
  model: string
  usageCount?: number | null
  voteCount?: number | null
  private?: number | null
  development?: number | null
  published?: number | null
  official?: number | null
  createdAt?: string
  updatedAt?: string
}

export interface Gen1Tally {
  id: string
  owner: string
  homebrewId: string
  createdAt?: string
  updatedAt?: string
}

/** Everything one user owns on Gen 1. */
export interface Gen1User {
  profile: Gen1Profile | null
  characters: Gen1Character[]
  bookmarks: Gen1Bookmark[]
  homebrew: Gen1Homebrew[]
  uses: Gen1Tally[]
  votes: Gen1Tally[]
}

/** The six Gen 1 models, in the order the Lambda reads them. */
export const GEN1_MODELS = ['Profile', 'Character', 'Bookmark', 'Homebrew', 'HomebrewUse', 'HomebrewVote'] as const
export type Gen1Model = typeof GEN1_MODELS[number]

/**
 * A Gen 1 row as plain JSON: the DynamoDB client returns integers past 2^53 as BigInt (a
 * homebrew record has one); they become ordinary (rounded) numbers, as the live site saw them.
 */
export function plainRow<T>(value: T): T {
  if (typeof value === 'bigint') return Number(value) as T
  if (Array.isArray(value)) return value.map(plainRow) as T
  if (value instanceof Set) return [...value].map(plainRow) as T
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, plainRow(v)])) as T
  return value
}
