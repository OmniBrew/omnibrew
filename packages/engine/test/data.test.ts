import { describe, expect, it, vi } from 'vitest'
import { z } from 'zod'
import type { Character } from '../character'
import { CharacterValidationError, createUserData, DataError, type DataClient, type DataSession, isOwner, ownerKey, readJson, slugify } from '../data'

// The data layer against a mocked Amplify client: what it sends and how it reads replies.

const session: DataSession = { sub: '11111111-2222-3333-4444-555555555555', username: 'google_123' }
const owner = ownerKey(session)

const character = (patch: Partial<Character> = {}): Character => ({
  version: 1,
  game: 'test',
  name: 'Shepard',
  experience: { points: 0, milestone: 1, useMilestone: false },
  species: null,
  background: null,
  classes: [],
  abilityScores: {
    method: 'manual',
    base: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
    bonus: { str: null, dex: null, con: null, int: null, wis: null, cha: null },
    override: { str: null, dex: null, con: null, int: null, wis: null, cha: null },
  },
  choices: [],
  powers: [],
  equipment: [],
  companions: [],
  customFeatures: [],
  details: { characteristics: {}, notes: '' },
  state: { hitPointsLost: 0, tempHp: { max: 0, value: 0 }, hitDiceUsed: {}, deathSaves: { successes: 0, failures: 0 }, inspiration: false, conditions: [], exhaustion: 0, credits: 0, pointsUsed: {}, slotsUsed: {}, resources: {}, toggles: {}, game: { renown: 2 } },
  overrides: {
    hp: null, ac: null, acBonus: 0, speeds: {}, senses: {},
    attack: { all: 0, melee: 0, ranged: 0, power: 0 }, damage: { all: 0, melee: 0, ranged: 0, power: 0 },
    defenses: { resistance: [], immunity: [], vulnerability: [], conditionImmunity: [] },
    profs: { skill: [], expertise: [], savingThrow: [], armor: [], weapon: [], tool: [] },
    powercasting: {}, game: {},
  },
  options: { tashas: false, armorSpeedPenalty: true, armorProficiencyPenalty: true, abilityScoreOnTop: false, game: {} },
  meta: {},
  ...patch,
})

const game = { id: 'test', character: { state: () => ({ renown: z.number() }) } }

/** A client whose every call resolves to `{ data: null }` unless a test says otherwise. */
function mockClient() {
  const model = () => ({
    get: vi.fn(async () => ({ data: null })),
    create: vi.fn(async (input: Record<string, unknown>) => ({ data: { id: 'new-id', owner, ...input } })),
    update: vi.fn(async (input: Record<string, unknown>) => ({ data: { owner, ...input } })),
    delete: vi.fn(async () => ({ data: {} })),
  })
  const client = {
    models: {
      Character: { ...model(), listCharacterByOwner: vi.fn() },
      Profile: model(),
      Bookmark: { ...model(), listBookmarkByOwner: vi.fn() },
      Homebrew: { ...model(), listHomebrewByOwner: vi.fn() },
      HomebrewUse: { listHomebrewUseByOwner: vi.fn() },
      HomebrewVote: { listHomebrewVoteByOwner: vi.fn() },
    },
    queries: { getPublicHomebrew: vi.fn(), listPublicHomebrew: vi.fn() },
    mutations: { ensureProfile: vi.fn(), setHomebrewUse: vi.fn(), setHomebrewVote: vi.fn() },
  }
  return client
}

function setup(signedIn = true) {
  const client = mockClient()
  const data = createUserData({ client: client as unknown as DataClient, game, session: () => (signedIn ? session : null) })
  return { client, data }
}

describe('helpers', () => {
  it('reads AWSJSON in either form', () => {
    expect(readJson('{"a":1}', {})).toEqual({ a: 1 })
    expect(readJson({ a: 1 }, {})).toEqual({ a: 1 })
    expect(readJson(null, [])).toEqual([])
    expect(readJson('not json', 'fallback')).toBe('fallback')
  })

  it('recognises every owner form (Gen 2 and Gen 1)', () => {
    expect(owner).toBe(`${session.sub}::google_123`)
    expect(isOwner(owner, session)).toBe(true)
    expect(isOwner('google_123', session)).toBe(true)
    expect(isOwner(session.sub, session)).toBe(true)
    expect(isOwner('someone::else', session)).toBe(false)
    expect(isOwner(owner, null)).toBe(false)
  })

  it('makes slugs like the live titleId', () => {
    expect(slugify('Kuwashii Visor: Mark Ⅱ')).toBe('kuwashii-visor-mark-ii')
    expect(slugify('  Ça va!  ')).toBe('ca-va')
  })
})

describe('characters', () => {
  it('validates and stores the model as JSON', async () => {
    const { client, data } = setup()
    const stored = await data.characters.create(character(), 'gen1-id')
    expect(client.models.Character.create).toHaveBeenCalledWith({ id: 'gen1-id', game: 'test', version: 1, name: 'Shepard', data: JSON.stringify(character()) })
    expect(stored).toMatchObject({ id: 'gen1-id', mine: true, character: character() })
  })

  it('refuses an invalid character or one of another game, before calling the API', async () => {
    const { client, data } = setup()
    await expect(data.characters.create({ ...character(), name: 3 } as unknown as Character)).rejects.toBeInstanceOf(CharacterValidationError)
    await expect(data.characters.update('x', character({ game: 'sw5e' }))).rejects.toThrow(/expected test/)
    await expect(data.characters.create(character({ state: { ...character().state, game: {} } }))).rejects.toThrow(/state\.game\.renown/)
    expect(client.models.Character.create).not.toHaveBeenCalled()
    expect(client.models.Character.update).not.toHaveBeenCalled()
  })

  it('lists every page of the owner index', async () => {
    const { client, data } = setup()
    client.models.Character.listCharacterByOwner
      .mockResolvedValueOnce({ data: [{ id: 'a', owner, data: JSON.stringify(character({ name: 'A' })) }], nextToken: 't1' })
      .mockResolvedValueOnce({ data: [{ id: 'b', owner: 'google_123', data: character({ name: 'B' }) }], nextToken: null })
    const list = await data.characters.list()
    expect(list.map(c => [c.id, c.character.name, c.mine])).toEqual([['a', 'A', true], ['b', 'B', true]])
    expect(client.models.Character.listCharacterByOwner).toHaveBeenNthCalledWith(2, { owner }, { limit: 100, nextToken: 't1' })
  })

  it('reads shared links signed out through the identity pool, and marks them not mine', async () => {
    const { client, data } = setup(false)
    client.models.Character.get.mockResolvedValueOnce({ data: { id: 'c', owner: 'other::user', data: JSON.stringify(character()) } } as never)
    const stored = await data.characters.get('c')
    expect(client.models.Character.get).toHaveBeenCalledWith({ id: 'c' }, { authMode: 'identityPool' })
    expect(stored?.mine).toBe(false)
    expect(await data.characters.get('missing')).toBeNull()
  })

  it('needs a session to write', async () => {
    const { data } = setup(false)
    await expect(data.characters.create(character())).rejects.toThrow(/not signed in/)
    await expect(data.characters.list()).rejects.toThrow(/not signed in/)
  })

  it('turns API errors into DataError', async () => {
    const { client, data } = setup()
    client.models.Character.delete.mockResolvedValueOnce({ data: null, errors: [{ message: 'Not Authorized to access deleteCharacter' }] } as never)
    await expect(data.characters.remove('x')).rejects.toThrow(DataError)
  })
})

describe('profile', () => {
  it('loads (or creates) the profile and parses its JSON fields', async () => {
    const { client, data } = setup()
    client.mutations.ensureProfile.mockResolvedValueOnce({ data: { id: session.sub, preferences: '{"units":"imperial"}', webhooks: '[{"name":"Table"}]', maxCharacters: 50 } })
    expect(await data.profile.mine()).toMatchObject({ id: session.sub, preferences: { units: 'imperial' }, webhooks: [{ name: 'Table' }], maxCharacters: 50, username: null })
  })

  it('updates its own profile only, stringifying JSON', async () => {
    const { client, data } = setup()
    await data.profile.update({ username: 'Garrus', preferences: { units: 'metric' } })
    expect(client.models.Profile.update).toHaveBeenCalledWith({ id: session.sub, username: 'Garrus', preferences: '{"units":"metric"}' })
  })

  it('reads another profile without its owner-only fields', async () => {
    const { client, data } = setup()
    await data.profile.get('other')
    const options = client.models.Profile.get.mock.calls[0] as unknown as [unknown, { selectionSet: string[] }]
    expect(options[1].selectionSet).not.toContain('webhooks')
    expect(options[1].selectionSet).not.toContain('maxCharacters')
  })
})

describe('bookmarks', () => {
  it('adds, lists and removes', async () => {
    const { client, data } = setup()
    expect(await data.bookmarks.add('powers', 'warp')).toMatchObject({ type: 'powers', recordId: 'warp', data: null })
    expect(client.models.Bookmark.create).toHaveBeenCalledWith({ type: 'powers', recordId: 'warp' })
    client.models.Bookmark.listBookmarkByOwner.mockResolvedValueOnce({ data: [{ id: 'b1', type: 'powers', recordId: 'warp', data: '{"note":1}' }] })
    expect(await data.bookmarks.list()).toEqual([{ id: 'b1', type: 'powers', recordId: 'warp', data: { note: 1 } }])
    await data.bookmarks.remove('b1')
    expect(client.models.Bookmark.delete).toHaveBeenCalledWith({ id: 'b1' })
  })
})

describe('homebrew', () => {
  it('creates with a slug and the record as JSON', async () => {
    const { client, data } = setup()
    const saved = await data.homebrew.save({ kind: 'weapons', title: 'Black Widow X', data: { damage: '3d10' }, status: 'private' })
    expect(client.models.Homebrew.create).toHaveBeenCalledWith({ kind: 'weapons', title: 'Black Widow X', slug: 'black-widow-x', data: '{"damage":"3d10"}', status: 'private' })
    expect(saved).toMatchObject({ id: 'new-id', data: { damage: '3d10' }, usageCount: 0, voteCount: 0, official: false })
  })

  it('keeps published homebrew published', async () => {
    const { client, data } = setup()
    client.models.Homebrew.get.mockResolvedValueOnce({ data: { id: 'h', kind: 'weapons', title: 'T', slug: 't', data: '{}', status: 'published' } } as never)
    await expect(data.homebrew.save({ id: 'h', kind: 'weapons', title: 'T', data: {}, status: 'private' })).rejects.toThrow(/stays published/)
    expect(client.models.Homebrew.update).not.toHaveBeenCalled()
  })

  it('lists public homebrew and drops nulls', async () => {
    const { client, data } = setup()
    client.queries.listPublicHomebrew.mockResolvedValueOnce({ data: { items: [{ id: 'h', kind: 'powers', title: 'T', slug: 't', data: '{}', status: 'published', authorId: 'x', usageCount: 3 }, null], nextToken: 'n' } })
    const page = await data.homebrew.listPublic('powers')
    expect(client.queries.listPublicHomebrew).toHaveBeenCalledWith({ kind: 'powers', status: 'published', limit: 100, nextToken: null })
    expect(page).toEqual({ items: [expect.objectContaining({ id: 'h', authorId: 'x', usageCount: 3 })], nextToken: 'n' })
  })

  it('uses and votes through the tally mutations', async () => {
    const { client, data } = setup()
    client.mutations.setHomebrewUse.mockResolvedValueOnce({ data: { homebrewId: 'h', usageCount: 4, voteCount: 1, active: true } })
    client.mutations.setHomebrewVote.mockResolvedValueOnce({ data: null, errors: [{ message: 'Only published homebrew by someone else can be voted for' }] })
    expect(await data.homebrew.setUse('h', true)).toEqual({ homebrewId: 'h', usageCount: 4, voteCount: 1, active: true })
    await expect(data.homebrew.setVote('h', true)).rejects.toThrow(/voted for/)
    client.models.HomebrewUse.listHomebrewUseByOwner.mockResolvedValueOnce({ data: [{ homebrewId: 'h' }] })
    expect(await data.homebrew.used()).toEqual(['h'])
  })
})
