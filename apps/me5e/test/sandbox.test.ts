import { randomUUID } from 'node:crypto'
import { existsSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import type { Schema } from '@omnibrew/backend'
import type { Character } from '@omnibrew/engine/character'
import { createUserData, DataError, type DataSession, type UserData } from '@omnibrew/engine/data'
import { Amplify } from 'aws-amplify'
import { fetchAuthSession, getCurrentUser, signIn, signOut } from 'aws-amplify/auth'
import { generateClient } from 'aws-amplify/data'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { meCharacter } from '../game/character'

/**
 * The data layer against a deployed sandbox (plan/20), with two test accounts of the dev
 * user pool (never real users). Local only and opt-in:
 *
 *   corepack pnpm --filter @omnibrew/me5e sandbox     (deploys, writes amplify_outputs.json)
 *   SANDBOX_TEST=1 corepack pnpm vitest run apps/me5e/test/sandbox.test.ts
 *
 * The accounts come from apps/me5e/.env (SANDBOX_TEST_EMAIL/_PASSWORD, ..._2). Everything
 * the test creates is deleted at the end.
 */

const outputsFile = fileURLToPath(new URL('../amplify_outputs.json', import.meta.url))
const envFile = fileURLToPath(new URL('../.env', import.meta.url))
if (process.env.SANDBOX_TEST && existsSync(envFile)) process.loadEnvFile(envFile)
const enabled = Boolean(process.env.SANDBOX_TEST && existsSync(outputsFile) && process.env.SANDBOX_TEST_EMAIL && process.env.SANDBOX_TEST_EMAIL_2)

const character = (name: string): Character => ({
  version: 1,
  game: 'me5e',
  name,
  experience: { points: 0, milestone: 1, useMilestone: false },
  species: null,
  background: null,
  classes: [],
  abilityScores: {
    method: 'manual',
    base: { str: 10, dex: 12, con: 14, int: 13, wis: 10, cha: 15 },
    bonus: { str: null, dex: null, con: null, int: null, wis: null, cha: null },
    override: { str: null, dex: null, con: null, int: null, wis: null, cha: null },
  },
  choices: [],
  powers: [],
  equipment: [],
  companions: [],
  customFeatures: [],
  details: { characteristics: {}, notes: '' },
  state: {
    hitPointsLost: 0, tempHp: { max: 0, value: 0 }, hitDiceUsed: {}, deathSaves: { successes: 0, failures: 0 }, inspiration: false,
    conditions: [], exhaustion: 0, credits: 1000, pointsUsed: {}, slotsUsed: {}, resources: {}, toggles: {},
    game: { paragon: 2, renegade: 0, indoctrination: 0, shieldsLost: 0, barrier: { used: 0, ticksUsed: 0 }, shoulderMounts: [], techArmorMax: 0 },
  },
  overrides: {
    hp: null, ac: null, acBonus: 0, speeds: {}, senses: {},
    attack: { all: 0, melee: 0, ranged: 0, power: 0 }, damage: { all: 0, melee: 0, ranged: 0, power: 0 },
    defenses: { resistance: [], immunity: [], vulnerability: [], conditionImmunity: [] },
    profs: { skill: [], expertise: [], savingThrow: [], armor: [], weapon: [], tool: [] },
    powercasting: {}, game: { shields: null, regen: null },
  },
  options: {
    tashas: false, armorSpeedPenalty: true, armorProficiencyPenalty: true, abilityScoreOnTop: false,
    game: { weaponSlots: true, grenadeSlots: true, medigelSlots: true, thermalClipSlots: true, thermalClips: false, programInstall: false, consumeThermalClips: false },
  },
  meta: {},
})

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

describe.skipIf(!enabled)('sandbox backend', () => {
  const characterId = randomUUID()
  const created = { homebrew: [] as string[], bookmarks: [] as string[] }
  let userA: DataSession
  let publishedId: string
  let privateId: string

  beforeAll(() => {
    Amplify.configure(JSON.parse(readFileSync(outputsFile, 'utf8')))
    data = createUserData({ client: generateClient<Schema>(), game: { id: 'me5e', character: meCharacter }, session: () => session })
  })

  afterAll(async () => {
    if (!enabled) return
    await as(2)
    await data.homebrew.setVote(publishedId, false).catch(() => {})
    await data.profile.mine().then(() => generateClient<Schema>().models.Profile.delete({ id: session!.sub })).catch(() => {})
    await as(1)
    await data.homebrew.setUse(publishedId, false).catch(() => {})
    await data.characters.remove(characterId).catch(() => {})
    for (const id of created.bookmarks) await data.bookmarks.remove(id).catch(() => {})
    for (const id of created.homebrew) await data.homebrew.remove(id).catch(() => {})
    await generateClient<Schema>().models.Profile.delete({ id: session!.sub }).catch(() => {})
    await as(null)
  })

  it('creates the profile on first use and updates it', async () => {
    await as(1)
    userA = session!
    const profile = await data.profile.mine()
    expect(profile).toMatchObject({ id: userA.sub, maxCharacters: 50 })
    await data.profile.update({ username: 'Sandbox Shepard', preferences: { units: 'imperial' }, webhooks: [{ name: 'Table', link: 'https://example.com/hook' }] })
    expect(await data.profile.mine()).toMatchObject({ username: 'Sandbox Shepard', preferences: { units: 'imperial' }, webhooks: [{ name: 'Table' }] })
  })

  it('creates, lists, reads, updates characters with a kept id', async () => {
    const stored = await data.characters.create(character('Shepard'), characterId)
    expect(stored).toMatchObject({ id: characterId, mine: true, character: { name: 'Shepard' } })
    expect((await data.characters.list()).map(c => c.id)).toContain(characterId)
    await data.characters.update(characterId, { ...character('Commander Shepard'), state: { ...character('x').state, credits: 5 } })
    expect((await data.characters.get(characterId))?.character).toMatchObject({ name: 'Commander Shepard', state: { credits: 5 } })
  })

  it('adds, lists and removes bookmarks', async () => {
    const bookmark = await data.bookmarks.add('powers', 'warp')
    created.bookmarks.push(bookmark.id)
    expect((await data.bookmarks.list()).map(b => b.recordId)).toContain('warp')
    await data.bookmarks.remove(bookmark.id)
    expect((await data.bookmarks.list()).map(b => b.id)).not.toContain(bookmark.id)
  })

  it('saves homebrew and keeps the usage count with setHomebrewUse', async () => {
    const published = await data.homebrew.save({ kind: 'weapons', title: 'Sandbox Rifle', data: { damage: '2d8' }, status: 'private' })
    const secret = await data.homebrew.save({ kind: 'weapons', title: 'Secret Rifle', data: {}, status: 'private' })
    publishedId = published.id
    privateId = secret.id
    created.homebrew.push(publishedId, privateId)
    await data.homebrew.save({ id: publishedId, kind: 'weapons', title: 'Sandbox Rifle', data: { damage: '2d8' }, status: 'published' })
    await expect(data.homebrew.save({ id: publishedId, kind: 'weapons', title: 'Sandbox Rifle', data: {}, status: 'private' })).rejects.toThrow(/stays published/)
    expect((await data.homebrew.setUse(publishedId, true)).usageCount).toBe(1)
    // Idempotent: a second use changes nothing.
    expect((await data.homebrew.setUse(publishedId, true)).usageCount).toBe(1)
    expect(await data.homebrew.used()).toContain(publishedId)
    expect((await data.homebrew.mine()).map(h => h.id)).toEqual(expect.arrayContaining([publishedId, privateId]))
    // Owners can't set their own counts.
    const direct = await generateClient<Schema>().models.Homebrew.update({ id: publishedId, usageCount: 99 } as never)
    expect(direct.errors?.length).toBeGreaterThan(0)
  })

  it('serves shared characters to guests, read-only', async () => {
    await as(null)
    const shared = await data.characters.get(characterId)
    expect(shared).toMatchObject({ id: characterId, mine: false, character: { name: 'Commander Shepard' } })
    await expect(data.characters.update(characterId, character('Hacked'))).rejects.toThrow(DataError)
    const list = await generateClient<Schema>().models.Character.list({ authMode: 'identityPool' })
    expect(list.errors?.length).toBeGreaterThan(0)
  })

  it('keeps another user to reads, votes and uses of public homebrew', async () => {
    await as(2)
    expect((await data.characters.get(characterId))?.mine).toBe(false)
    await expect(data.characters.update(characterId, character('Hacked'))).rejects.toThrow(DataError)
    await expect(data.characters.remove(characterId)).rejects.toThrow(DataError)
    expect((await data.characters.get(characterId))?.character.name).toBe('Commander Shepard')
    expect(await data.characters.list()).toEqual([])
    // Nobody lists others' records (Gen 1 let any signed-in user list everything): owner
    // rules filter a list to the caller's own rows.
    for (const list of [
      await generateClient<Schema>().models.Character.list(),
      await generateClient<Schema>().models.Profile.list(),
      await generateClient<Schema>().models.Homebrew.list(),
      await generateClient<Schema>().models.Bookmark.list(),
    ]) {
      const owners = (list.data as { owner?: string | null }[]).map(row => row.owner)
      expect(owners.filter(owner => !owner?.startsWith(session!.sub))).toEqual([])
    }

    const profile = await data.profile.get(userA.sub)
    expect(profile).toMatchObject({ username: 'Sandbox Shepard', webhooks: [] })
    const webhooks = await generateClient<Schema>().models.Profile.get({ id: userA.sub }, { selectionSet: ['id', 'webhooks'] })
    expect(webhooks.data?.webhooks ?? null).toBeNull()

    expect(await data.homebrew.getPublic(publishedId)).toMatchObject({ title: 'Sandbox Rifle', authorId: userA.sub, usageCount: 1 })
    expect(await data.homebrew.getPublic(privateId)).toBeNull()
    expect((await data.homebrew.listPublic('weapons')).items.map(h => h.id)).toContain(publishedId)
    expect((await generateClient<Schema>().models.Homebrew.get({ id: privateId })).data).toBeNull()
    await expect(data.homebrew.setUse(privateId, true)).rejects.toThrow(DataError)
    expect((await data.homebrew.setVote(publishedId, true)).voteCount).toBe(1)
    expect((await data.homebrew.setVote(publishedId, false)).voteCount).toBe(0)
  })

  it('lets the author delete everything', async () => {
    await as(1)
    await expect(data.homebrew.setVote(publishedId, true)).rejects.toThrow(/voted for/)
    expect((await data.homebrew.setUse(publishedId, false)).usageCount).toBe(0)
    await data.characters.remove(characterId)
    expect(await data.characters.get(characterId)).toBeNull()
    // Every homebrew of the test account (earlier runs' leftovers too).
    for (const homebrew of await data.homebrew.mine()) await data.homebrew.remove(homebrew.id)
    expect(await data.homebrew.mine()).toEqual([])
    const profile = await generateClient<Schema>().models.Profile.delete({ id: session!.sub })
    expect(profile.errors).toBeUndefined()
  })
})
