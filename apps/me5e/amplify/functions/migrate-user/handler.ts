import { ConditionalCheckFailedException, DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { GetObjectCommand, HeadObjectCommand, S3Client } from '@aws-sdk/client-s3'
import { BatchGetCommand, DynamoDBDocumentClient, GetCommand, PutCommand, QueryCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import type { AppSyncIdentityCognito, AppSyncIdentityIAM, AppSyncResolverEvent } from 'aws-lambda'
import { createRules, bundleRecords, type Rec } from '@omnibrew/engine/rules'
import { createGame } from '@omnibrew/engine/schemas'
import { me5eDefinition } from '../../../game/definition'
import { migrateCharacter, unpackCharacter } from '../../../migrate/character'
import { plainRow, type Gen1Bookmark, type Gen1Character, type Gen1Homebrew, type Gen1Profile, type Gen1Tally, type Gen1User } from '../../../migrate/gen1'
import { homebrewIdsIn, migrateUser, type ExistingHomebrew, type ExistingProfile, type UserMigration } from '../../../migrate/user'
// Written by resource.ts at deploy from the content repo (git-ignored).
import content from './content.json'

/**
 * `migrateMyData` and `getLegacyCharacter` (plan/28 §1). Reads the caller's Gen 1 rows by
 * their Cognito username (from the token, never an argument), converts them with
 * `migrateUser`, and writes the new rows with conditions, so a re-run or a second tab
 * never overwrites anything. Gen 1 is read only: its IAM grants `GetItem`, `Query` and
 * `BatchGetItem` and the picture bucket's `GetObject`, nothing else.
 */
const env = (name: string) => {
  const v = process.env[name]
  if (!v) throw new Error(`${name} is not set`)
  return v
}
const GEN1 = JSON.parse(env('GEN1_TABLES')) as Record<'Profile' | 'Character' | 'Bookmark' | 'Homebrew' | 'HomebrewUse' | 'HomebrewVote', string>
const TABLES = JSON.parse(env('TABLES')) as Record<'Profile' | 'Character' | 'Bookmark' | 'Homebrew' | 'HomebrewUse' | 'HomebrewVote', string>
const GEN1_BUCKET = env('GEN1_BUCKET')
/**
 * Who may migrate yet (plan/28): `*` everyone, else Cognito subs or usernames separated by
 * commas. Until cutover the beta lets only testers move their data, so nobody's copy is
 * weeks older than what they keep changing on the live site (migration happens once).
 */
const ALLOW = (process.env.MIGRATION_ALLOW ?? '*').split(',').map(s => s.trim()).filter(Boolean)
const allowed = (c: { sub: string, username: string }) => ALLOW.includes('*') || ALLOW.includes(c.sub) || ALLOW.includes(c.username)

const db = DynamoDBDocumentClient.from(new DynamoDBClient({}), { marshallOptions: { removeUndefinedValues: true, convertClassInstanceToMap: false } })
const s3 = new S3Client({})

const game = createGame(me5eDefinition)
const records = bundleRecords(content as { collections: Record<string, Rec[]> })
const rules = createRules(game, records)

/** Time this call may spend on characters before handing the rest to the next call. */
const BUDGET_MS = 18_000

type Args = { id?: string, original?: boolean | null }
type Identity = AppSyncIdentityCognito | AppSyncIdentityIAM | null | undefined

/** Amplify Gen 2's function payload names the field at the top (`a.handler.function`); plain AppSync under `info`. */
type Event = AppSyncResolverEvent<Args> & { fieldName?: string }

export const handler = async (event: Event) => {
  const started = Date.now()
  if ((event.fieldName ?? event.info?.fieldName) === 'getLegacyCharacter') return legacyCharacter(event.arguments, event.identity as Identity)
  const identity = event.identity as AppSyncIdentityCognito | null
  if (!identity?.sub || !identity.username) throw new Error('Unauthorized: sign in first')
  return migrateMyData({ sub: identity.sub, username: identity.username }, () => Date.now() - started > BUDGET_MS)
}

// --- reading ---------------------------------------------------------------------------

async function queryAll<T>(table: string, index: string, key: string, value: string): Promise<T[]> {
  const out: T[] = []
  let start: Record<string, unknown> | undefined
  do {
    const page = await db.send(new QueryCommand({ TableName: table, IndexName: index, KeyConditionExpression: '#k = :v', ExpressionAttributeNames: { '#k': key }, ExpressionAttributeValues: { ':v': value }, ExclusiveStartKey: start }))
    out.push(...(page.Items ?? []).map(plainRow) as T[])
    start = page.LastEvaluatedKey
  } while (start)
  return out
}

async function batchGet<T>(table: string, ids: string[]): Promise<T[]> {
  const out: T[] = []
  const unique = [...new Set(ids)].filter(Boolean)
  for (let i = 0; i < unique.length; i += 100) {
    let keys: Record<string, unknown>[] | undefined = unique.slice(i, i + 100).map(id => ({ id }))
    for (let tries = 0; keys?.length && tries < 5; tries++) {
      const res = await db.send(new BatchGetCommand({ RequestItems: { [table]: { Keys: keys } } }))
      out.push(...(res.Responses?.[table] ?? []).map(plainRow) as T[])
      keys = res.UnprocessedKeys?.[table]?.Keys as Record<string, unknown>[] | undefined
    }
  }
  return out
}

async function readGen1(username: string): Promise<Gen1User> {
  const [profile, characters, bookmarks, homebrew, uses, votes] = await Promise.all([
    db.send(new GetCommand({ TableName: GEN1.Profile, Key: { id: username } })).then(r => (r.Item ? plainRow(r.Item) : null) as Gen1Profile | null),
    queryAll<Gen1Character>(GEN1.Character, 'byUser', 'owner', username),
    queryAll<Gen1Bookmark>(GEN1.Bookmark, 'byUser', 'owner', username),
    queryAll<Gen1Homebrew>(GEN1.Homebrew, 'byUser', 'owner', username),
    queryAll<Gen1Tally>(GEN1.HomebrewUse, 'byUser', 'owner', username),
    queryAll<Gen1Tally>(GEN1.HomebrewVote, 'byUser', 'owner', username),
  ])
  return { profile, characters, bookmarks, homebrew, uses, votes }
}

/** Display names of homebrew authors: the new profile (by sub), else the Gen 1 one (by username). */
async function authorNames(owners: string[]): Promise<Map<string, string | null>> {
  const parts = owners.map(o => ({ owner: o, sub: o.includes('::') ? o.split('::')[0]! : null, username: o.includes('::') ? o.split('::')[1]! : o }))
  const [fresh, old] = await Promise.all([
    batchGet<{ id: string, username?: string }>(TABLES.Profile, parts.flatMap(p => (p.sub ? [p.sub] : []))),
    batchGet<{ id: string, username?: string }>(GEN1.Profile, parts.map(p => p.username)),
  ])
  const bySub = new Map(fresh.map(p => [p.id, p.username ?? null]))
  const byName = new Map(old.map(p => [p.id, p.username ?? null]))
  return new Map(parts.map(p => [p.owner, (p.sub ? bySub.get(p.sub) : null) || byName.get(p.username) || null]))
}

// --- migrateMyData -----------------------------------------------------------------------

async function migrateMyData(caller: { sub: string, username: string }, shouldStop: () => boolean) {
  // Not yet: nothing read or written, and the client asks again next time.
  if (!allowed(caller)) return { done: true, report: null, pictureUrl: null }
  const owner = `${caller.sub}::${caller.username}`
  const now = new Date().toISOString()
  await ensureProfile(caller, now)
  const [gen1, profile, mineCharacters, mineBookmarks, mineUses, mineVotes] = await Promise.all([
    readGen1(caller.username),
    db.send(new GetCommand({ TableName: TABLES.Profile, Key: { id: caller.sub } })).then(r => (r.Item ?? null) as (ExistingProfile & { migration?: unknown }) | null),
    queryAll<{ id: string }>(TABLES.Character, 'byOwner', 'owner', owner),
    queryAll<{ type: string, recordId: string }>(TABLES.Bookmark, 'byOwner', 'owner', owner),
    queryAll<{ homebrewId: string }>(TABLES.HomebrewUse, 'byOwner', 'owner', owner),
    queryAll<{ homebrewId: string }>(TABLES.HomebrewVote, 'byOwner', 'owner', owner),
  ])
  const characterIds = new Set(mineCharacters.map(c => c.id))
  // A Gen 1 id already in the new table under another owner would be a collision: never touch it.
  const others = await batchGet<{ id: string, owner?: string }>(TABLES.Character, gen1.characters.filter(c => !characterIds.has(c.id)).map(c => c.id))
  for (const c of others) characterIds.add(c.id)

  // Every homebrew the user's rows name: their own, their uses and votes, and their characters' picks.
  const wanted = new Set<string>([...gen1.homebrew.map(h => h.id), ...gen1.uses.map(u => u.homebrewId), ...gen1.votes.map(v => v.homebrewId)])
  for (const c of gen1.characters) {
    if (characterIds.has(c.id) || !c.data) continue
    try {
      for (const id of homebrewIdsIn(unpackCharacter(c.data))) wanted.add(id)
    }
    catch { /* migrateUser reports it */ }
  }
  const rows = await batchGet<ExistingHomebrew>(TABLES.Homebrew, [...wanted])
  const homebrew = new Map(rows.map(h => [h.id, h]))
  const names = await authorNames([...new Set([...rows.map(h => h.owner), owner])])

  const result = migrateUser({
    game,
    content: rules.content,
    records,
    caller,
    gen1,
    existing: {
      profile,
      characterIds,
      characterCount: mineCharacters.length,
      bookmarkKeys: new Set(mineBookmarks.map(b => `${b.type}/${b.recordId}`)),
      useIds: new Set(mineUses.map(u => u.homebrewId)),
      voteIds: new Set(mineVotes.map(v => v.homebrewId)),
    },
    homebrew,
    authorName: o => names.get(o) ?? (o === owner ? (profile?.username ?? gen1.profile?.username ?? null) : null),
    now,
    newId: () => globalThis.crypto.randomUUID(),
    shouldStop,
  })

  await write(result, caller, owner, now)
  // AWSJSON fields are returned as values; AppSync serializes them.
  return { done: result.done, report: result.report, pictureUrl: result.picture ? await signedPicture(result.picture) : null }
}

async function ensureProfile(caller: { sub: string, username: string }, now: string) {
  try {
    await db.send(new PutCommand({
      TableName: TABLES.Profile,
      Item: { id: caller.sub, __typename: 'Profile', owner: `${caller.sub}::${caller.username}`, maxCharacters: 50, createdAt: now, updatedAt: now },
      ConditionExpression: 'attribute_not_exists(id)',
    }))
  }
  catch (e) {
    if (!(e instanceof ConditionalCheckFailedException)) throw e
  }
}

/** A put that never replaces a row; false when the row was already there. */
async function putNew(table: string, item: Record<string, unknown>): Promise<boolean> {
  try {
    await db.send(new PutCommand({ TableName: table, Item: item, ConditionExpression: 'attribute_not_exists(id)' }))
    return true
  }
  catch (e) {
    if (e instanceof ConditionalCheckFailedException) return false
    throw e
  }
}

async function write(m: UserMigration, caller: { sub: string, username: string }, owner: string, now: string) {
  for (const h of m.homebrew) await putNew(TABLES.Homebrew, { __typename: 'Homebrew', ...h })
  for (const id of m.claims) {
    // Only rows still under the Gen 1 username: never someone else's.
    try {
      await db.send(new UpdateCommand({ TableName: TABLES.Homebrew, Key: { id }, UpdateExpression: 'SET #o = :owner', ConditionExpression: '#o = :old', ExpressionAttributeNames: { '#o': 'owner' }, ExpressionAttributeValues: { ':owner': owner, ':old': caller.username } }))
    }
    catch (e) {
      if (!(e instanceof ConditionalCheckFailedException)) throw e
    }
  }
  for (const u of m.uses) await putNew(TABLES.HomebrewUse, { __typename: 'HomebrewUse', ...u })
  for (const v of m.votes) await putNew(TABLES.HomebrewVote, { __typename: 'HomebrewVote', ...v })
  for (const b of m.bookmarks) await putNew(TABLES.Bookmark, { __typename: 'Bookmark', ...b })
  for (const c of m.characters) {
    if (!await putNew(TABLES.Character, { __typename: 'Character', ...c })) {
      m.report.characters.migrated--
      m.report.characters.existing++
    }
  }

  const sets: string[] = ['#updatedAt = :now', '#legacyId = :legacyId']
  const names: Record<string, string> = { '#updatedAt': 'updatedAt', '#legacyId': 'legacyId' }
  const values: Record<string, unknown> = { ':now': now, ':legacyId': m.profile.legacyId }
  const set = (field: string, value: unknown) => {
    sets.push(`#${field} = :${field}`)
    names[`#${field}`] = field
    values[`:${field}`] = value
  }
  const { legacyId: _legacyId, ...patch } = m.profile
  for (const [k, v] of Object.entries(patch)) if (v !== undefined) set(k, v)
  if (m.done) {
    set('migratedAt', now)
    set('migration', m.report)
  }
  await db.send(new UpdateCommand({ TableName: TABLES.Profile, Key: { id: caller.sub }, UpdateExpression: `SET ${sets.join(', ')}`, ExpressionAttributeNames: names, ExpressionAttributeValues: values }))
}

async function signedPicture(key: string): Promise<string | null> {
  try {
    await s3.send(new HeadObjectCommand({ Bucket: GEN1_BUCKET, Key: key }))
    return await getSignedUrl(s3, new GetObjectCommand({ Bucket: GEN1_BUCKET, Key: key }), { expiresIn: 300 })
  }
  catch {
    return null
  }
}

// --- getLegacyCharacter ------------------------------------------------------------------

/**
 * One Gen 1 character, converted and not saved: for a shared link whose owner hasn't signed
 * in to the new site yet (decision 5; guests too). Its owner also gets the old data
 * (`original`), to keep a character that failed to migrate.
 */
async function legacyCharacter(args: Args, identity: Identity) {
  if (!args.id) return null
  const row = plainRow((await db.send(new GetCommand({ TableName: GEN1.Character, Key: { id: args.id } }))).Item) as Gen1Character | undefined
  if (!row?.data) return null
  const username = identity && 'username' in identity ? identity.username : null
  const mine = !!username && row.owner === username
  let character: unknown = null
  let report: unknown
  try {
    const out = migrateCharacter(row.data, { game, content: rules.content, now: row.updatedOn })
    // Homebrew it uses comes along as copies, as on a migrated character.
    const ids = out.report.homebrew.map(h => h.id!)
    const found = await batchGet<ExistingHomebrew>(TABLES.Homebrew, ids)
    const names = await authorNames([...new Set(found.map(h => h.owner))])
    const copies = Object.fromEntries(found.map(h => [h.id, { kind: h.kind, data: h.data, author: names.get(h.owner) ?? null, updatedAt: h.updatedAt ?? null }]))
    character = found.length ? { ...out.character, homebrew: { ...out.character.homebrew, ...copies } } : out.character
    report = out.report
  }
  catch (e) {
    if (!mine) return null
    report = { error: (e as Error).message.slice(0, 300) }
  }
  return { id: row.id, mine, character, report, ...(mine && args.original ? { original: original(row.data) } : {}) }
}

/** The old data as the importer reads it; data that won't even unpack comes back as it is stored. */
function original(data: string): Record<string, unknown> {
  try {
    return unpackCharacter(data)
  }
  catch {
    return { unreadable: data }
  }
}
