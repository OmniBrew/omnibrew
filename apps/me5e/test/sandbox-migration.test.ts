import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { DeleteObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3'
import { DeleteCommand, DynamoDBDocumentClient, GetCommand, PutCommand } from '@aws-sdk/lib-dynamodb'
import type { Schema } from '@omnibrew/backend'
import { createUserData, type DataSession, type UserData } from '@omnibrew/engine/data'
import { bundleRecords, splitBundle } from '@omnibrew/engine/rules'
import { loadRecords } from '@omnibrew/engine/rules/load'
import { createGame } from '@omnibrew/engine/schemas'
import { Amplify } from 'aws-amplify'
import { fetchAuthSession, getCurrentUser, signIn, signOut } from 'aws-amplify/auth'
import { generateClient } from 'aws-amplify/data'
import jsonpack from 'jsonpack/main'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { me5e } from '../game'
import { meCharacter } from '../game/character'
import { me5eDefinition } from '../game/definition'
import { bulkConvertHomebrew } from '../migrate/homebrew-bulk'
import { rulesBundleOptions } from '../rules-bundle'

/**
 * The Gen 1 migration (plan/28 §1) against a deployed sandbox: generated Gen 1 rows in the
 * sandbox's stand-in tables (never real data), the dev pool's two test accounts, the real
 * Lambda. Local only and opt-in, like `sandbox.test.ts`:
 *
 *   SANDBOX_TEST=1 corepack pnpm vitest run apps/me5e/test/sandbox-migration.test.ts
 *
 * Needs AWS credentials (`--profile default`, through AWS_PROFILE) to fill and empty the
 * stand-in tables, and the content repo next to this checkout. Everything is deleted after.
 */
const outputsFile = fileURLToPath(new URL('../amplify_outputs.json', import.meta.url))
const envFile = fileURLToPath(new URL('../.env', import.meta.url))
const contentDir = fileURLToPath(new URL('../../../../omnibrew-me5e-data', import.meta.url))
const fixturesDir = fileURLToPath(new URL('./fixtures/characters', import.meta.url))
if (process.env.SANDBOX_TEST && existsSync(envFile)) process.loadEnvFile(envFile)
const outputs = existsSync(outputsFile) ? JSON.parse(readFileSync(outputsFile, 'utf8')) as { custom?: { gen1?: { gen1Tables: Record<string, string>, gen1Bucket: string, tables: Record<string, string> } } } : {}
const names = outputs.custom?.gen1
const enabled = Boolean(process.env.SANDBOX_TEST && names && process.env.SANDBOX_TEST_EMAIL && process.env.SANDBOX_TEST_EMAIL_2 && existsSync(contentDir))

process.env.AWS_PROFILE ??= 'default'
const db = DynamoDBDocumentClient.from(new DynamoDBClient({ region: 'us-east-1' }), { marshallOptions: { removeUndefinedValues: true } })
const s3 = new S3Client({ region: 'us-east-1' })

let session: DataSession | null = null
let data: UserData

async function as(user: 1 | 2 | null) {
  await signOut()
  session = null
  if (!user) return
  const suffix = user === 1 ? '' : '_2'
  const { nextStep } = await signIn({ username: process.env[`SANDBOX_TEST_EMAIL${suffix}`]!, password: process.env[`SANDBOX_TEST_PASSWORD${suffix}`]! })
  expect(nextStep.signInStep).toBe('DONE')
  const current = await getCurrentUser()
  await fetchAuthSession()
  session = { sub: current.userId, username: current.username }
}

// Generated ids, recognizable in the tables.
const id = (n: number) => `5a4db0c5-0000-4000-8000-${String(n).padStart(12, '0')}`
const OTHER = 'gen1-test-other-author'
const BREW_MINE = id(1)
const BREW_BROKEN = id(2)
const BREW_OTHER = id(3)
const CHAR_PLAIN = id(10)
const CHAR_BREW = id(11)
const CHAR_BAD = id(12)
const CHAR_USER2 = id(13)
const PNG = Buffer.from('89504e470d0a1a0a0000000d4948445200000001000000010806000000', 'hex')

const livePower = (name: string) => ({
  name, version: 1, level: 1, type: 'biotic', tags: [], classes: ['vanguard'],
  mechanics: [{ castingTime: { unit: 'action' }, range: { short: 30 }, duration: { length: 1, unit: 'minute' }, concentration: false, damage: false, primes: false, detonates: false }],
  advancements: [],
  html: '<p>Generated for the sandbox test. Reach <me-distance length="20" />.</p>',
})
const liveWeapon = (name: string) => ({ name, rarity: 'common', type: 'heavy_pistol', cost: 100, weight: 2, heat: 2, damage: { dieCount: 1, dieType: 8, type: 'piercing' }, range: { short: 30, long: 90 }, properties: ['light'], slots: 1, andromeda: false, image: false, html: '<p>A generated pistol.</p>' })

describe.skipIf(!enabled)('Gen 1 migration in the sandbox', () => {
  let usernameA = ''
  let usernameB = ''
  const gen1Rows: Array<[string, string]> = []
  const newRows: Array<[string, string]> = []
  const fixture = (file: string) => JSON.parse(readFileSync(`${fixturesDir}/${file}`, 'utf8')) as Record<string, unknown>

  async function putGen1(model: string, item: Record<string, unknown>) {
    await db.send(new PutCommand({ TableName: names!.gen1Tables[model], Item: item }))
    gen1Rows.push([model, item.id as string])
  }

  beforeAll(async () => {
    Amplify.configure(JSON.parse(readFileSync(outputsFile, 'utf8')))
    data = createUserData({ client: generateClient<Schema>(), game: { id: 'me5e', character: meCharacter }, session: () => session })
    await as(2)
    usernameB = session!.username
    await as(1)
    usernameA = session!.username
    // Leftovers of an earlier run of this test.
    await generateClient<Schema>().models.Profile.delete({ id: session!.sub }).catch(() => {})

    const files = readdirSync(fixturesDir).filter(f => f.endsWith('.json')).sort()
    const t = '2023-05-01T00:00:00.000Z'
    await putGen1('Profile', { id: usernameA, owner: usernameA, username: 'Gen1 Tester', imperial: true, darkMode: false, maxCharacters: 2, webhooks: JSON.stringify([{ id: 'w1', name: 'Table', link: 'https://discord.com/api/webhooks/100000000000000002/sandbox-test-token-not-real-1111', characters: [{ name: 'A', id: CHAR_PLAIN }] }]), profileImg: `${usernameA}-profile.png`, createdOn: t, updatedOn: t })
    await putGen1('Character', { id: CHAR_PLAIN, owner: usernameA, data: jsonpack.pack(fixture(files[0]!)), createdOn: t, updatedOn: t })
    await putGen1('Character', { id: CHAR_BREW, owner: usernameA, data: jsonpack.pack({ ...fixture(files[1]!), powers: [{ id: BREW_MINE, klass: 'vanguard', advancement: null }], equipment: [{ type: 'weapon', id: BREW_OTHER, uuid: 'gen1-w', equipped: true, mods: {} }] }), createdOn: t, updatedOn: t })
    await putGen1('Character', { id: CHAR_BAD, owner: usernameA, data: 'not jsonpack {', createdOn: t, updatedOn: t })
    await putGen1('Character', { id: CHAR_USER2, owner: usernameB, data: jsonpack.pack(fixture(files[2]!)), createdOn: t, updatedOn: t })
    await putGen1('Bookmark', { id: id(20), owner: usernameA, model: 'powers', modelId: 'throw', createdOn: t, updatedOn: t })
    await putGen1('Bookmark', { id: id(21), owner: usernameA, model: 'genpc', modelId: 'generated-test-1', data: jsonpack.pack({ id: 'generated-test-1', name: 'Generated NPC' }), createdOn: t, updatedOn: t })
    const brew = (bid: string, owner: string, model: string, d: Record<string, unknown>, published: number) => ({ id: bid, owner, title: d.name, titleId: 'x', model, data: JSON.stringify(d), usageCount: 4, voteCount: 2, private: published ? 0 : 1, development: 0, published, official: 0, createdAt: t, updatedAt: t })
    await putGen1('Homebrew', brew(BREW_MINE, usernameA, 'powers', livePower('Sandbox Push'), 1))
    await putGen1('Homebrew', brew(BREW_BROKEN, usernameA, 'weapons', { name: 'Sandbox Broken', type: 'no_such_type' }, 1))
    await putGen1('Homebrew', brew(BREW_OTHER, OTHER, 'weapons', liveWeapon('Sandbox Other Gun'), 1))
    await putGen1('HomebrewUse', { id: id(30), owner: usernameA, homebrewId: BREW_OTHER, createdAt: t, updatedAt: t })
    await putGen1('HomebrewVote', { id: id(31), owner: usernameA, homebrewId: BREW_OTHER, createdAt: t, updatedAt: t })
    await s3.send(new PutObjectCommand({ Bucket: names!.gen1Bucket, Key: `public/${usernameA}-profile.png`, Body: PNG, ContentType: 'image/png' }))

    // Decision 1: every homebrew converted first.
    const { records } = loadRecords(contentDir, me5e)
    const summary = await bulkConvertHomebrew({ db, gen1Table: names!.gen1Tables.Homebrew!, newTable: names!.tables.Homebrew!, game: createGame(me5eDefinition), records: bundleRecords(splitBundle(records, { ...rulesBundleOptions, keepBody: [] })), write: true })
    expect(summary).toMatchObject({ rows: 3, written: 3, lowered: 1 })
    for (const h of [BREW_MINE, BREW_BROKEN, BREW_OTHER]) newRows.push(['Homebrew', h])
  }, 120_000)

  afterAll(async () => {
    if (!enabled) return
    await as(1)
    const mine = await data.characters.list().catch(() => [])
    for (const c of mine) await data.characters.remove(c.id).catch(() => {})
    for (const b of await data.bookmarks.list().catch(() => [])) await data.bookmarks.remove(b.id).catch(() => {})
    await data.homebrew.setUse(BREW_OTHER, false).catch(() => {})
    await data.homebrew.setVote(BREW_OTHER, false).catch(() => {})
    await generateClient<Schema>().models.Profile.delete({ id: session!.sub }).catch(() => {})
    const sub = session!.sub
    await as(null)
    for (const [model, rowId] of newRows) await db.send(new DeleteCommand({ TableName: names!.tables[model], Key: { id: rowId } })).catch(() => {})
    for (const t of ['HomebrewUse', 'HomebrewVote']) await db.send(new DeleteCommand({ TableName: names!.tables[t], Key: { id: `${sub}#${BREW_OTHER}` } })).catch(() => {})
    for (const [model, rowId] of gen1Rows) await db.send(new DeleteCommand({ TableName: names!.gen1Tables[model], Key: { id: rowId } })).catch(() => {})
    await s3.send(new DeleteObjectCommand({ Bucket: names!.gen1Bucket, Key: `public/${usernameA}-profile.png` })).catch(() => {})
  }, 120_000)

  it('brings everything over on the first call(s)', async () => {
    await as(1)
    let step = await data.legacy.migrate()
    for (let i = 0; i < 10 && !step.done; i++) step = await data.legacy.migrate()
    expect(step.done).toBe(true)
    expect(step.report).toMatchObject({
      characters: { migrated: 2, failed: [{ id: CHAR_BAD }] },
      bookmarks: { migrated: 2 },
      homebrew: { claimed: 2, converted: 0, private: [{ id: BREW_BROKEN }] },
      uses: 1,
      votes: 1,
      profile: { name: true, preferences: true, webhooks: 1, picture: true },
    })
    // The picture: a short-lived URL to the Gen 1 file, for the browser to copy.
    expect(step.pictureUrl).toBeTruthy()
    expect(Buffer.from(await (await fetch(step.pictureUrl!)).arrayBuffer())).toEqual(PNG)

    const characters = await data.characters.list()
    expect(characters.map(c => c.id).sort()).toEqual([CHAR_PLAIN, CHAR_BREW])
    const withBrew = characters.find(c => c.id === CHAR_BREW)!.character
    expect(Object.keys(withBrew.homebrew ?? {}).sort()).toEqual([BREW_MINE, BREW_OTHER])
    expect(withBrew.homebrew![BREW_MINE]).toMatchObject({ kind: 'powers', author: 'Gen1 Tester', data: { name: 'Sandbox Push', powerType: 'biotic' } })

    const profile = await data.profile.mine()
    expect(profile).toMatchObject({ username: 'Gen1 Tester', preferences: { units: 'imperial', colorMode: 'light' }, maxCharacters: 50 })
    expect(profile.migratedAt).toBeTruthy()
    expect(profile.migration).toMatchObject({ characters: { migrated: 2 } })

    const bookmarks = await data.bookmarks.list()
    expect(bookmarks.map(b => `${b.type}/${b.recordId}`).sort()).toEqual(['genpc/generated-test-1', 'powers/throw'])

    // Only this test's rows (the account may hold others from other sandbox tests).
    const mine = (await data.homebrew.mine()).filter(h => [BREW_MINE, BREW_BROKEN].includes(h.id))
    expect(mine.map(h => [h.id, h.status, h.usageCount, h.voteCount]).sort()).toEqual([[BREW_MINE, 'published', 4, 2], [BREW_BROKEN, 'private', 4, 2]].sort())
    expect(mine.find(h => h.id === BREW_BROKEN)!.migration).toMatchObject({ status: 'published' })
    expect(await data.homebrew.used()).toEqual([BREW_OTHER])
    expect(await data.homebrew.voted()).toEqual([BREW_OTHER])
    // Counts were copied, not counted again.
    expect((await data.homebrew.getPublic(BREW_OTHER))!.usageCount).toBe(4)
  }, 120_000)

  it('changes nothing when called again', async () => {
    await as(1)
    const before = (await data.characters.list()).map(c => c.updatedAt)
    const step = await data.legacy.migrate()
    expect(step).toMatchObject({ done: true, report: { characters: { migrated: 0, existing: 2 }, bookmarks: { migrated: 0 }, uses: 0, votes: 0 } })
    expect((await data.characters.list()).map(c => c.updatedAt)).toEqual(before)
    expect((await data.bookmarks.list())).toHaveLength(2)
  }, 60_000)

  it('gives the owner the original of a character that failed, and nobody else', async () => {
    await as(1)
    const own = await data.legacy.character(CHAR_BAD, true)
    expect(own).toMatchObject({ mine: true, character: null, original: { unreadable: 'not jsonpack {' } })
    await as(2)
    expect(await data.legacy.character(CHAR_BAD, true)).toBeNull()
  }, 60_000)

  it('shows a shared character whose owner has not signed in yet, to a guest too', async () => {
    await as(null)
    const shared = await data.legacy.character(CHAR_USER2, true)
    expect(shared).toMatchObject({ id: CHAR_USER2, mine: false })
    expect(shared!.character?.version).toBe(1)
    expect(shared!.original).toBeUndefined()
    // Never written: the new table doesn't have it.
    expect((await db.send(new GetCommand({ TableName: names!.tables.Character, Key: { id: CHAR_USER2 } }))).Item).toBeUndefined()
  }, 60_000)
})
