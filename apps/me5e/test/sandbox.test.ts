import { randomUUID } from 'node:crypto'
import { existsSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import type { Schema } from '@omnibrew/backend'
import { newCharacter, type Character } from '@omnibrew/engine/character'
import { ConflictError, createUserData, DataError, type DataSession, type UserData } from '@omnibrew/engine/data'
import { actions, createRules, setChoice } from '@omnibrew/engine/rules'
import { loadRecords, loadRules } from '@omnibrew/engine/rules/load'
import { createGame } from '@omnibrew/engine/schemas'
import { validateRecord } from '@omnibrew/engine/validator/record'
import { Amplify } from 'aws-amplify'
import { fetchAuthSession, getCurrentUser, signIn, signOut } from 'aws-amplify/auth'
import { generateClient } from 'aws-amplify/data'
import { getUrl, remove, uploadData } from 'aws-amplify/storage'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { me5e } from '../game'
import { meCharacter } from '../game/character'
import { mergeBookmarks } from '../../../packages/engine/app/utils/bookmarks'
import { normalizeWebhooks, setWebhookCharacter } from '../../../packages/engine/app/utils/discord'
import { copiesOf, mergeHomebrew, syncCopies } from '../../../packages/engine/app/utils/homebrew'

/**
 * The data layer against a deployed sandbox (plan/20), with two test accounts of the dev
 * user pool (never real users). Local only and opt-in:
 *
 *   corepack pnpm --filter @omnibrew/me5e sandbox     (deploys, writes amplify_outputs.json)
 *   SANDBOX_TEST=1 corepack pnpm vitest run apps/me5e/test/sandbox.test.ts
 *
 * The accounts come from apps/me5e/.env (SANDBOX_TEST_EMAIL/_PASSWORD, ..._2). Everything
 * the test creates is deleted at the end. The builder round trip (plan/24) also needs the
 * content repo next to this checkout.
 */
const contentDir = fileURLToPath(new URL('../../../../omnibrew-me5e-data', import.meta.url))

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
  const builtId = randomUUID()
  const created = { homebrew: [] as string[], bookmarks: [] as string[], pictures: [] as string[] }
  const playerCharacterId = randomUUID()
  let brewId: string
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
    await data.homebrew.setVote(brewId, false).catch(() => {})
    await data.homebrew.setUse(brewId, false).catch(() => {})
    await data.characters.remove(playerCharacterId).catch(() => {})
    await data.profile.mine().then(() => generateClient<Schema>().models.Profile.delete({ id: session!.sub })).catch(() => {})
    await as(1)
    await data.homebrew.setUse(publishedId, false).catch(() => {})
    await data.characters.remove(characterId).catch(() => {})
    await data.characters.remove(builtId).catch(() => {})
    for (const id of created.bookmarks) await data.bookmarks.remove(id).catch(() => {})
    for (const path of created.pictures) await remove({ path }).catch(() => {})
    for (const id of created.homebrew) await data.homebrew.remove(id).catch(() => {})
    await generateClient<Schema>().models.Profile.delete({ id: session!.sub }).catch(() => {})
    await as(null)
  })

  it('creates the profile on first use and updates it', async () => {
    await as(1)
    userA = session!
    const profile = await data.profile.mine()
    expect(profile).toMatchObject({ id: userA.sub, maxCharacters: 50 })
    // Webhooks in this site's shape (plan/26 §1.5); the URL is a made-up one in Discord's form, never posted to.
    const hooks = normalizeWebhooks([{ id: 'w1', name: 'Table', url: 'https://discord.com/api/webhooks/100000000000000001/sandbox-test-token-not-real-0000', characters: [] }])
    await data.profile.update({ username: 'Sandbox Shepard', preferences: { units: 'imperial', colorMode: 'light' }, webhooks: setWebhookCharacter(hooks, 'w1', characterId, true) })
    const saved = await data.profile.mine()
    expect(saved).toMatchObject({ username: 'Sandbox Shepard', preferences: { units: 'imperial', colorMode: 'light' } })
    expect(normalizeWebhooks(saved.webhooks)).toEqual([{ id: 'w1', name: 'Table', url: hooks[0]!.url, characters: [characterId] }])
  })

  it('stores a profile picture under the uploader\u2019s identity, readable through a signed URL', async () => {
    // A 1x1 WebP; the page resizes real pictures to 256 px first.
    const webp = Buffer.from('UklGRiQAAABXRUJQVlA4IBgAAAAwAQCdASoBAAEAAwA0JaQAA3AA/vuUAAA=', 'base64')
    const { path } = await uploadData({ path: ({ identityId }) => `profile-pictures/${identityId}/${Date.now()}.webp`, data: webp, options: { contentType: 'image/webp' } }).result
    created.pictures.push(path)
    await data.profile.update({ profileImg: path })
    expect((await data.profile.mine()).profileImg).toBe(path)
    const res = await fetch((await getUrl({ path })).url)
    expect(res.status).toBe(200)
    expect(Buffer.from(await res.arrayBuffer()).equals(webp)).toBe(true)
    // Someone else's folder can't be written.
    await expect(uploadData({ path: 'profile-pictures/someone-else/x.webp', data: webp }).result).rejects.toThrow()
  })

  it('creates, lists, reads, updates characters with a kept id', async () => {
    const stored = await data.characters.create(character('Shepard'), characterId)
    expect(stored).toMatchObject({ id: characterId, mine: true, character: { name: 'Shepard' } })
    expect((await data.characters.list()).map(c => c.id)).toContain(characterId)
    await data.characters.update(characterId, { ...character('Commander Shepard'), state: { ...character('x').state, credits: 5 } })
    expect((await data.characters.get(characterId))?.character).toMatchObject({ name: 'Commander Shepard', state: { credits: 5 } })
  })

  it('saves only from the latest revision: a stale save is a conflict', async () => {
    const current = (await data.characters.get(characterId))!
    const first = await data.characters.update(characterId, { ...current.character, name: 'Tab One' }, current.revision)
    expect(first.revision).toBe((current.revision ?? 0) + 1)
    // A second tab still holding the old revision loses.
    await expect(data.characters.update(characterId, { ...current.character, name: 'Tab Two' }, current.revision)).rejects.toBeInstanceOf(ConflictError)
    expect((await data.characters.get(characterId))?.character.name).toBe('Tab One')
    // "Keep mine": save over it from the newer revision.
    const mine = await data.characters.update(characterId, { ...current.character, name: 'Commander Shepard' }, first.revision)
    expect(mine.revision).toBe(first.revision! + 1)
  })

  it.skipIf(!existsSync(contentDir))('round-trips a built character: builder, save, reload, sheet', async () => {
    const rules = loadRules(contentDir, me5e)
    // The builder: species, class and its picks, abilities, a weapon; then play: damage and a used resource.
    let c = newCharacter({ id: 'me5e', character: meCharacter }, 'Sandbox Infiltrator')
    c.species = 'batarian'
    c.classes = [{ id: 'infiltrator', levels: 3, subclass: null, hitPoints: [8, 5, 5], rolledHitPoints: false, asi: {} }]
    c.abilityScores = { ...c.abilityScores, method: 'buy', base: { str: 8, dex: 15, con: 14, int: 15, wis: 10, cha: 8 } }
    c = setChoice(c, 'class/infiltrator/skill', ['stealth', 'perception', 'investigation'])
    c = actions.addItem(c, { id: 'm-3-predator', kind: 'weapon' })
    c = actions.setEquipped(rules.sheet(c), c.equipment[0]!.uuid, true)
    c = actions.damage(rules.sheet(c), 4)
    const before = rules.sheet(c)

    const stored = await data.characters.create(c, builtId)
    const reloaded = (await data.characters.get(builtId))!
    expect(reloaded.revision).toBe(stored.revision)
    expect(reloaded.character).toEqual(c)
    const after = rules.sheet(reloaded.character)
    expect({ ac: after.ac, hp: after.hp, skills: after.skills, attacks: after.weaponAttacks.attacks.map(a => after.card(a).hit) })
      .toEqual({ ac: before.ac, hp: before.hp, skills: before.skills, attacks: before.weaponAttacks.attacks.map(a => before.card(a).hit) })
    expect(after.skills.stealth!.proficient).toBe(true)
    expect(after.hp.current).toBe(after.hp.max - 4)
    await data.characters.remove(builtId)
  })

  it('adds, lists and removes bookmarks', async () => {
    const bookmark = await data.bookmarks.add('powers', 'warp')
    created.bookmarks.push(bookmark.id)
    expect((await data.bookmarks.list()).map(b => b.recordId)).toContain('warp')
    await data.bookmarks.remove(bookmark.id)
    expect((await data.bookmarks.list()).map(b => b.id)).not.toContain(bookmark.id)
  })

  it('uploads this browser\u2019s bookmarks on sign-in, once each', async () => {
    const kept = await data.bookmarks.add('weapons', 'm-3-predator')
    created.bookmarks.push(kept.id)
    const local = [{ type: 'weapons', recordId: 'm-3-predator' }, { type: 'bestiary', recordId: 'husk' }]
    const { upload } = mergeBookmarks(local, await data.bookmarks.list())
    expect(upload).toEqual([{ type: 'bestiary', recordId: 'husk' }])
    for (const b of upload) created.bookmarks.push((await data.bookmarks.add(b.type, b.recordId)).id)
    expect((await data.bookmarks.list()).map(b => `${b.type}/${b.recordId}`)).toEqual(expect.arrayContaining(['bestiary/husk', 'weapons/m-3-predator']))
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

  it.skipIf(!existsSync(contentDir))('publishes a valid homebrew weapon that another player uses, votes for and sees on a sheet', async () => {
    const game = createGame(me5e)
    const { records } = loadRecords(contentDir, me5e)
    const kind = me5e.homebrew!.kinds.find(k => k.collection === 'weapons')!
    const weapon = { ...kind.defaults(), name: 'Sandbox Hand Cannon', damage: { dieCount: 2, dieType: 10, type: 'fire' }, body: 'Hits hard at :distance{length=30}.' }
    const broken = { ...weapon, damage: { dieCount: 2, dieType: 7, type: 'fire' } }
    const check = (k: string, d: Record<string, unknown>, id: string) => validateRecord(game, k, { ...d, id }, records).filter(i => i.severity === 'error').map(i => ({ path: i.path, message: i.message }))

    await as(1)
    // Sharing needs a valid record; a broken one is refused, a private draft saves anyway.
    const draft = await data.homebrew.save({ kind: 'weapons', title: weapon.name, data: broken, status: 'private' }, check)
    brewId = draft.id
    created.homebrew.push(brewId)
    await expect(data.homebrew.save({ id: brewId, kind: 'weapons', title: weapon.name, data: broken, status: 'published' }, check)).rejects.toThrow(/dieType/)
    const published = await data.homebrew.save({ id: brewId, kind: 'weapons', title: weapon.name, data: weapon, status: 'published' }, check)
    expect(published.status).toBe('published')

    await as(2)
    const found = (await data.homebrew.listPublic('weapons')).items.find(h => h.id === brewId)!
    expect(found).toMatchObject({ title: weapon.name, authorId: userA.sub })
    expect((await data.homebrew.setUse(brewId, true)).usageCount).toBe(1)
    expect((await data.homebrew.setVote(brewId, true)).voteCount).toBe(1)

    // The player equips it; the character keeps a copy, so its sheet computes for anyone.
    let c = newCharacter({ id: 'me5e', character: meCharacter }, 'Sandbox Gunner')
    c.classes = [{ id: 'soldier', levels: 3, subclass: null, hitPoints: [10, 6, 6], rolledHitPoints: false, asi: {} }]
    c = actions.addItem(c, { id: brewId, kind: 'weapon' })
    c = syncCopies(c, new Map([[brewId, { id: brewId, kind: 'weapons', data: found.data, author: 'Sandbox Shepard', updatedAt: found.updatedAt ?? null }]])).character
    const rulesFor = (ch: Character) => createRules(game, mergeHomebrew(records, copiesOf(ch), { weapons: 'weapon' }))
    c = actions.setEquipped(rulesFor(c).sheet(c), c.equipment[0]!.uuid, true)
    await data.characters.create(c, playerCharacterId)

    await as(null)
    const shared = (await data.characters.get(playerCharacterId))!
    expect(shared.character.homebrew?.[brewId]?.data.name).toBe(weapon.name)
    const sheet = rulesFor(shared.character).sheet(shared.character)
    const card = sheet.weaponAttacks.attacks.find(a => a.name === weapon.name)!
    expect(sheet.card(card).damages?.[0]?.text).toMatch(/2d10.*fire/)

    await as(2)
    await data.homebrew.setVote(brewId, false)
    await data.homebrew.setUse(brewId, false)
    await data.characters.remove(playerCharacterId)
  }, 120_000)

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
