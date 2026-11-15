import { createRules, type Rec } from '@omnibrew/engine/rules'
import { createGame } from '@omnibrew/engine/schemas'
import jsonpack from 'jsonpack/main'
import { describe, expect, it } from 'vitest'
import { me5eDefinition } from '../game/definition'
import { mapBookmark, mapBookmarks } from '../migrate/bookmarks'
import type { Gen1Homebrew, Gen1User } from '../migrate/gen1'
import { convertHomebrew, normalizeLiveHomebrew } from '../migrate/homebrew'
import { htmlToMarkdown } from '../migrate/html'
import { convertRoll, readLegacyLocal } from '../migrate/local'
import { migrateCharacter } from '../migrate/character'
import { migrateUser, pictureKey, type MigrateUserInput } from '../migrate/user'

/**
 * The 3d migration (plan/28 §1) on generated Gen 1 rows and content in memory. No real
 * user data: every row here is made up.
 */
const game = createGame(me5eDefinition)
const recs = (collections: Record<string, Rec[]>) => new Map(Object.entries(collections).map(([c, list]) => [c, new Map(list.map(r => [r.id as string, r]))]))
const records = recs({
  species: [{ id: 'human', name: 'Human', mechanics: [] }],
  classes: [{ id: 'vanguard', name: 'Vanguard', hitDie: 10, profs: {}, progression: { abi: [4] } }],
  vehicles: [{ id: 'destiny-ascension', name: 'Destiny Ascension' }],
  powers: [{ id: 'throw', name: 'Throw', level: 0, powerType: 'biotic', classes: ['vanguard'], casting: [{ castingTime: { unit: 'action' }, range: { short: 30 }, duration: { unit: 'instantaneous' } }] }],
  weapons: [{ id: 'predator', name: 'Predator', kind: 'weapon', weaponType: 'heavy_pistol', rarity: 'common', damage: [{ dieCount: 1, dieType: 8, type: 'piercing' }] }],
  skills: [],
})
const rules = createRules(game, records)

const SUB = '11111111-2222-4333-8444-555555555555'
const USERNAME = 'google_1234567890'
const HB_POWER = 'aaaaaaaa-bbbb-4ccc-8ddd-000000000001'
const HB_WEAPON = 'aaaaaaaa-bbbb-4ccc-8ddd-000000000002'
const HB_OTHER = 'aaaaaaaa-bbbb-4ccc-8ddd-000000000003'

function liveCharacter(id: string, patch: Rec = {}) {
  return {
    id,
    name: `Generated ${id}`,
    meta: { version: '1.0.2', remote: true },
    species: 'human',
    classes: [{ id: 'vanguard', levels: 3, subclass: null, hitPoints: [10, 6, 6], asi: {} }],
    abilityScores: Object.fromEntries(['str', 'dex', 'con', 'int', 'wis', 'cha'].map(a => [a, { value: 12, other: null, override: null }])),
    selected: [],
    equipment: [],
    powers: [],
    currentStats: { resources: {}, toggles: {} },
    settings: {},
    options: {},
    ...patch,
  }
}

const livePower = (patch: Rec = {}) => ({
  name: 'Gen Push',
  version: 1,
  level: 1,
  type: 'biotic',
  classes: ['vanguard'],
  mechanics: [{ castingTime: { unit: 'action' }, range: { short: 30 }, duration: { length: 1, unit: 'minute' }, concentration: false, damage: false, primes: false, detonates: false }],
  advancements: [],
  html: '<p>Push a creature <strong>hard</strong> up to <me-distance length="20" />.</p><ul><li>One</li><li>Two</li></ul>',
  ...patch,
})

function gen1Homebrew(id: string, model: string, data: Rec, patch: Partial<Gen1Homebrew> = {}): Gen1Homebrew {
  return { id, owner: USERNAME, title: String(data.name), titleId: 'x', data: JSON.stringify(data), model, usageCount: 3, voteCount: 2, private: 0, development: 0, published: 1, official: 0, createdAt: '2022-01-01T00:00:00.000Z', updatedAt: '2022-02-01T00:00:00.000Z', ...patch }
}

function gen1User(): Gen1User {
  return {
    profile: {
      id: USERNAME,
      owner: `${SUB}::${USERNAME}`,
      username: 'Generated Player',
      profileImg: `${USERNAME}-profile.png`,
      imperial: true,
      darkMode: false,
      maxCharacters: 2,
      webhooks: JSON.stringify([{ id: 'w1', name: 'Table', link: 'https://discord.com/api/webhooks/1/abc', characters: [{ name: 'A', id: 'c-1' }] }]),
    },
    characters: [
      { id: 'c-1', owner: USERNAME, data: jsonpack.pack(liveCharacter('c-1', { powers: [{ id: HB_POWER, klass: 'vanguard', advancement: null }] })), createdOn: '2022-01-01T00:00:00.000Z', updatedOn: '2022-03-01T00:00:00.000Z' },
      { id: 'c-2', owner: USERNAME, data: jsonpack.pack(liveCharacter('c-2', { equipment: [{ type: 'weapon', id: HB_OTHER, uuid: 'w', equipped: true, mods: {} }] })), createdOn: '2022-01-02T00:00:00.000Z' },
      { id: 'c-3', owner: USERNAME, data: jsonpack.pack(liveCharacter('c-3')), createdOn: '2022-01-03T00:00:00.000Z' },
      { id: 'c-bad', owner: USERNAME, data: 'not jsonpack {', createdOn: '2022-01-04T00:00:00.000Z' },
    ],
    bookmarks: [
      { id: 'b1', owner: USERNAME, model: 'powers', modelId: 'throw' },
      { id: 'b2', owner: USERNAME, model: 'powers', modelId: 'throw' },
      { id: 'b3', owner: USERNAME, model: 'vehicles', modelId: 'destiny-acension' },
      { id: 'b4', owner: USERNAME, model: 'genpc', modelId: 'generated-x-1', data: jsonpack.pack({ id: 'generated-x-1', name: 'Human Soldier', cr: '00125' }) },
      { id: 'b5', owner: USERNAME, model: 'weapons', modelId: HB_OTHER, data: jsonpack.pack(JSON.stringify({ name: 'Other Gun' })) },
      { id: 'b6', owner: USERNAME, model: '', modelId: '' },
    ],
    homebrew: [
      gen1Homebrew(HB_POWER, 'powers', livePower()),
      gen1Homebrew(HB_WEAPON, 'weapons', { name: 'Broken Gun', type: 'no_such_type', html: '<p>x</p>' }),
    ],
    uses: [{ id: 'u1', owner: USERNAME, homebrewId: HB_OTHER }, { id: 'u2', owner: USERNAME, homebrewId: 'gone' }],
    votes: [{ id: 'v1', owner: USERNAME, homebrewId: HB_OTHER }],
  }
}

function input(patch: Partial<MigrateUserInput> = {}): MigrateUserInput {
  let n = 0
  return {
    game,
    content: rules.content,
    records,
    caller: { sub: SUB, username: USERNAME },
    gen1: gen1User(),
    existing: { profile: { maxCharacters: 50 }, characterIds: new Set(), characterCount: 0, bookmarkKeys: new Set(), useIds: new Set(), voteIds: new Set() },
    homebrew: new Map([[HB_OTHER, { id: HB_OTHER, owner: 'someone-else', kind: 'weapons', title: 'Other Gun', data: { name: 'Other Gun', weaponType: 'heavy_pistol' }, updatedAt: '2022-05-01T00:00:00.000Z' }]]),
    authorName: owner => (owner === 'someone-else' ? 'Other Player' : 'Generated Player'),
    now: '2026-11-14T00:00:00.000Z',
    newId: () => `new-${++n}`,
    ...patch,
  }
}

describe('htmlToMarkdown', () => {
  it('converts the live editor\'s HTML', () => {
    expect(htmlToMarkdown('<p>A <strong>bold</strong> and <em>soft</em> word.</p><p>Next&nbsp;line &amp; more</p>')).toBe('A **bold** and *soft* word.\n\nNext line & more')
    expect(htmlToMarkdown('<ol><li>One</li><li class="ql-indent-1">Sub</li><li>Two</li></ol><p>After</p>')).toBe('1. One\n   2. Sub\n3. Two\n\nAfter')
    expect(htmlToMarkdown('<p>See <a href="https://n7.world">this</a><br>now</p>')).toBe('See [this](https://n7.world)\nnow')
  })

  it('keeps me-* tags for the MDC step and reports tags it drops', () => {
    const dropped: string[] = []
    expect(htmlToMarkdown('<p><u>Under</u> <me-condition id="primed" /> <blink>x</blink></p>', t => dropped.push(t))).toBe('Under <me-condition id="primed" /> x')
    expect(dropped).toEqual(['u', 'blink'])
  })

  it('escapes markdown syntax in text', () => {
    expect(htmlToMarkdown('<p>2*3 [x] a_b</p>')).toBe('2\\*3 \\[x\\] a\\_b')
  })
})

describe('bookmarks', () => {
  it('maps the live models, homebrew and generated NPCs', () => {
    expect(mapBookmark({ model: 'powers', modelId: 'throw' })).toEqual({ type: 'powers', recordId: 'throw' })
    expect(mapBookmark({ model: 'vehicles', modelId: 'destiny-acension' })).toEqual({ type: 'vehicles', recordId: 'destiny-ascension' })
    expect(mapBookmark({ model: 'bestiary', modelId: 'generated-a-1', data: jsonpack.pack({ name: 'NPC' }) })).toEqual({ type: 'genpc', recordId: 'generated-a-1', data: { title: 'NPC', to: '/generators/npc?bookmark=generated-a-1', npc: { name: 'NPC' }, format: 'live' } })
    expect(mapBookmark({ model: 'weapons', modelId: HB_OTHER, data: jsonpack.pack(JSON.stringify({ name: 'Gun' })) })).toEqual({ type: 'homebrew', recordId: HB_OTHER, data: { title: 'Gun', to: `/homebrew/view?id=${HB_OTHER}` } })
    expect(mapBookmark({ model: 'genpc', modelId: 'generated-b', data: null })).toBeNull()
  })

  it('drops duplicates and empty ones', () => {
    expect(mapBookmarks([{ model: 'powers', modelId: 'throw' }, { model: 'powers', modelId: 'throw' }, { model: '', modelId: '' }])).toEqual({ bookmarks: [{ type: 'powers', recordId: 'throw' }], dropped: 1 })
  })
})

describe('convertHomebrew', () => {
  it('converts a live power: renamed fields, HTML body as MDC, status and counts kept', () => {
    const row = convertHomebrew(game, records, gen1Homebrew(HB_POWER, 'powers', livePower()))
    expect(row.migration.issues).toBeUndefined()
    expect(row).toMatchObject({ id: HB_POWER, owner: USERNAME, kind: 'powers', title: 'Gen Push', slug: 'gen-push', status: 'published', usageCount: 3, voteCount: 2, official: false })
    expect(row.data).toMatchObject({ name: 'Gen Push', powerType: 'biotic', casting: [{ castingTime: { unit: 'action' } }] })
    expect(row.data).not.toHaveProperty('html')
    expect(row.data).not.toHaveProperty('type')
    expect(row.data.body).toBe('Push a creature **hard** up to :distance{length="20"}.\n\n- One\n- Two')
  })

  it('keeps an invalid record private, with its old status and the errors', () => {
    const row = convertHomebrew(game, records, gen1Homebrew(HB_WEAPON, 'weapons', { name: 'Broken Gun', type: 'no_such_type' }))
    expect(row.status).toBe('private')
    expect(row.migration.status).toBe('published')
    expect(row.migration.issues!.length).toBeGreaterThan(0)
  })

  it('reads data stored as a map or a string, and keeps a row it can\'t read', () => {
    expect(convertHomebrew(game, records, { ...gen1Homebrew(HB_POWER, 'powers', livePower()), data: livePower() }).migration.issues).toBeUndefined()
    const bad = convertHomebrew(game, records, { ...gen1Homebrew(HB_POWER, 'powers', livePower()), data: '{oops' })
    expect(bad).toMatchObject({ status: 'private', data: { name: 'Gen Push' } })
  })

  it('refuses kinds the new site has no homebrew for', () => {
    expect(convertHomebrew(game, records, gen1Homebrew(HB_POWER, 'armor', { name: 'A' })).migration.issues![0]!.message).toMatch(/no homebrew kind/)
  })
})

describe('migrateUser', () => {
  it('brings over characters with the same ids, copies of their homebrew, and reports failures', () => {
    const out = migrateUser(input())
    expect(out.characters.map(c => c.id)).toEqual(['c-1', 'c-2', 'c-3'])
    expect(out.characters.every(c => c.owner === `${SUB}::${USERNAME}` && c.game === 'me5e')).toBe(true)
    expect(out.characters[0]!.data.homebrew![HB_POWER]).toMatchObject({ kind: 'powers', author: 'Generated Player', data: { name: 'Gen Push' } })
    expect(out.characters[1]!.data.homebrew![HB_OTHER]).toMatchObject({ kind: 'weapons', author: 'Other Player' })
    expect(out.characters[0]!.createdAt).toBe('2022-01-01T00:00:00.000Z')
    expect(out.report.characters.failed).toEqual([{ id: 'c-bad', name: null, message: expect.any(String) }])
    expect(out.done).toBe(true)
  })

  it('converts their own homebrew, or claims what the bulk run wrote', () => {
    const fresh = migrateUser(input())
    expect(fresh.homebrew.map(h => [h.id, h.owner, h.status])).toEqual([[HB_POWER, `${SUB}::${USERNAME}`, 'published'], [HB_WEAPON, `${SUB}::${USERNAME}`, 'private']])
    expect(fresh.report.homebrew).toEqual({ claimed: 0, converted: 2, private: [{ id: HB_WEAPON, title: 'Broken Gun' }] })
    const bulk = new Map(input().homebrew)
    for (const h of gen1User().homebrew) {
      const c = convertHomebrew(game, records, h)
      bulk.set(h.id, { id: h.id, owner: c.owner, kind: c.kind, title: c.title, data: c.data, migration: c.migration })
    }
    const claimed = migrateUser(input({ homebrew: bulk }))
    expect(claimed.claims).toEqual([HB_POWER, HB_WEAPON])
    expect(claimed.homebrew).toEqual([])
    expect(claimed.report.homebrew.private).toEqual([{ id: HB_WEAPON, title: 'Broken Gun' }])
  })

  it('writes uses and votes of homebrew that still exists, without touching counts', () => {
    const out = migrateUser(input())
    expect(out.uses).toEqual([{ id: `${SUB}#${HB_OTHER}`, owner: `${SUB}::${USERNAME}`, homebrewId: HB_OTHER, createdAt: '2026-11-14T00:00:00.000Z', updatedAt: '2026-11-14T00:00:00.000Z' }])
    expect(out.votes).toHaveLength(1)
  })

  it('maps bookmarks', () => {
    const out = migrateUser(input())
    expect(out.bookmarks.map(b => [b.type, b.recordId])).toEqual([['powers', 'throw'], ['vehicles', 'destiny-ascension'], ['genpc', 'generated-x-1'], ['homebrew', HB_OTHER]])
    expect(out.report.bookmarks).toEqual({ migrated: 4, existing: 0, dropped: 1 })
  })

  it('fills the profile from Gen 1, raises the character limit to fit, and finds the picture', () => {
    const out = migrateUser(input())
    expect(out.profile).toEqual({
      legacyId: USERNAME,
      username: 'Generated Player',
      preferences: { units: 'imperial', colorMode: 'light' },
      webhooks: [{ id: 'w1', name: 'Table', url: 'https://discord.com/api/webhooks/1/abc', characters: ['c-1'] }],
    })
    expect(out.picture).toBe(`public/${USERNAME}-profile.png`)
    // Gen 1 limit 2, new profile 50: 50 is enough for 3.
    expect(out.report.maxCharacters).toBeUndefined()
    const tight = migrateUser(input({ existing: { ...input().existing, profile: { maxCharacters: 2 }, characterCount: 1 } }))
    expect(tight.profile.maxCharacters).toBe(4)
    expect(tight.report.maxCharacters).toBe(4)
  })

  it('never overwrites what the user already has on the new site', () => {
    const out = migrateUser(input({
      existing: {
        profile: { username: 'Beta Name', profileImg: 'profile-pictures/x/1.webp', preferences: { units: 'metric' }, webhooks: [{ id: 'n', name: 'New', url: 'https://discord.com/api/webhooks/1/abc', characters: [] }], maxCharacters: 50 },
        characterIds: new Set(['c-1']),
        characterCount: 1,
        bookmarkKeys: new Set(['powers/throw']),
        useIds: new Set([HB_OTHER]),
        voteIds: new Set(),
      },
    }))
    expect(out.profile).toEqual({ legacyId: USERNAME, preferences: { units: 'metric', colorMode: 'light' } })
    expect(out.picture).toBeNull()
    expect(out.characters.map(c => c.id)).toEqual(['c-2', 'c-3'])
    expect(out.report.characters.existing).toBe(1)
    expect(out.bookmarks.map(b => b.recordId)).not.toContain('throw')
    expect(out.uses).toEqual([])
  })

  it('stops between characters when asked, and says what is left', () => {
    let calls = 0
    const out = migrateUser(input({ shouldStop: () => ++calls > 1 }))
    expect(out.characters.map(c => c.id)).toEqual(['c-1'])
    expect(out.report.characters.pending).toBe(3)
    expect(out.done).toBe(false)
  })

  it('handles a user with nothing on Gen 1', () => {
    const out = migrateUser(input({ gen1: { profile: null, characters: [], bookmarks: [], homebrew: [], uses: [], votes: [] } }))
    expect(out).toMatchObject({ characters: [], bookmarks: [], homebrew: [], picture: null, done: true, profile: { legacyId: USERNAME } })
  })

  it('reads the picture key with or without `public/`, never a URL', () => {
    expect(pictureKey('a-profile.png')).toBe('public/a-profile.png')
    expect(pictureKey('public/a-profile.png')).toBe('public/a-profile.png')
    expect(pictureKey('https://example.com/a.png')).toBeNull()
    expect(pictureKey(null)).toBeNull()
  })
})

describe('readLegacyLocal (v140)', () => {
  const storage = (items: Record<string, unknown>) => ({ getItem: (k: string) => (k in items ? JSON.stringify(items[k]) : null) })

  it('reads local characters, signed-out bookmarks, logs and preferences', () => {
    const out = readLegacyLocal(storage({
      v140: {
        auth: { isAuthenticated: false },
        user: { darkMode: true, imperial: false, bookmarks: [{ model: 'powers', modelId: 'throw', data: null }, { id: 'remote-1', model: 'weapons', modelId: 'predator' }] },
        characters: {
          localCharacters: [liveCharacter('1700000000000'), { id: 'kitchenSink', name: 'Debug' }],
          localLogs: { 1700000000000: [{ data: { type: 'attack', detail: 'Predator', subDetail: 'Hit', notation: '1d20+5', total: 17 }, source: { id: 1700000000000 }, timestamp: '2023-01-01T00:00:00.000Z' }, { junk: true }] },
        },
        migrator: { migrated: true },
      },
    }))!
    expect(out.key).toBe('v140')
    expect(out.characters.map(c => c.id)).toEqual(['1700000000000'])
    expect(out.bookmarks).toEqual([{ type: 'powers', recordId: 'throw' }])
    expect(out.preferences).toEqual({ units: 'metric', colorMode: 'dark' })
    expect(out.logs['1700000000000']).toEqual([{ id: 'legacy-0-2023-01-01T00:00:00.000Z', at: '2023-01-01T00:00:00.000Z', label: 'Predator — Hit', kind: 'attack', notation: '1d20+5', total: 17, dice: [] }])
  })

  it('reads an older v131 key the live site never migrated', () => {
    const out = readLegacyLocal(storage({ v131: { user: { bookmarks: { powers: [{ id: 'throw', name: 'Throw' }], bestiary: [{ id: 'generated-a-1', name: 'NPC' }] } }, cb: { characters: { abc: { name: 'Old' } } } } }))!
    expect(out.key).toBe('v131')
    expect(out.bookmarks).toEqual([{ type: 'powers', recordId: 'throw' }, { type: 'genpc', recordId: 'generated-a-1', data: { title: 'NPC', to: '/generators/npc?bookmark=generated-a-1', npc: { id: 'generated-a-1', name: 'NPC' }, format: 'live' } }])
    expect(out.characters).toEqual([{ id: 'abc', raw: { name: 'Old' } }])
  })

  it('is null without old data', () => {
    expect(readLegacyLocal(storage({}))).toBeNull()
    expect(readLegacyLocal({ getItem: () => '{broken' })).toBeNull()
  })

  it('skips log entries it cannot read', () => {
    expect(convertRoll({ data: { total: 'x' } }, 0)).toBeNull()
    expect(convertRoll({ data: { total: 3, text: 'Custom', type: 'mystery' } }, 1)).toMatchObject({ label: 'Custom', kind: 'custom', total: 3 })
  })
})

describe('the live editor none-values (found by the dry run)', () => {
  const notes: string[] = []
  const norm = (kind: string, rec: Rec) => normalizeLiveHomebrew(kind, rec, n => notes.push(n))

  it('drops `false`/null markers and reads `pc` as the casting ability', () => {
    expect(norm('weapons', {
      damage: { dieCount: 1, dieType: 8, bonus: false, mod: false },
      addDamages: [{ bonus: { value: null, limit: null }, addTo: false }],
      versatile: false,
      properties: ['light'],
    })).toEqual({ damage: { dieCount: 1, dieType: 8, mod: false }, addDamages: [{}], properties: ['light'] })
    expect(norm('powers', {
      mechanics: [{ dc: { save: 'dex', mod: 'pc', bonus: false }, attack: { mod: 'pc' }, resource: false, damage: [{ bonus: { value: 2, limit: null } }] }, { duration: { length: 1, unit: 'hour' } }],
      advancements: [{ id: 'Improved Raise', name: 'Improved Raise', text: null }],
    })).toEqual({
      mechanics: [{ dc: { save: 'dex' }, attack: {}, damage: [{ bonus: { value: 2, type: 'flat' } }], concentration: false }, { duration: { length: 1, unit: 'hour' } }],
      advancements: [{ id: 'improved-raise', name: 'Improved Raise' }],
    })
    expect(notes).toEqual(['advancement-id: "Improved Raise" is "improved-raise"'])
  })

  it('keeps `false` where it means something (a damage `mod: false`, an attack turned off)', () => {
    expect(norm('powers', { mechanics: [{ concentration: true, attack: false }, { attack: false }] })).toEqual({ mechanics: [{ concentration: true, attack: false }, { attack: false }] })
  })
})

describe('old free-text ids (found by the dry run)', () => {
  it('keeps a typed species or custom armor name in id form, reported, instead of failing the character', () => {
    const { character, report } = migrateCharacter(liveCharacter('x', {
      species: 'Human (Earth Born)',
      equipment: [{ type: 'armor', id: '-Heavy Chest 1', uuid: 'a1', equipped: true, mods: [], custom: { name: 'Heavy Chest', type: 'heavy', placement: 'chest' } }],
    }), { game, content: rules.content })
    expect(character.species).toBe('Human-Earth-Born')
    expect(character.equipment[0]!.id).toBe('Heavy-Chest-1')
    expect(report.unknown).toContainEqual(expect.objectContaining({ id: 'Human (Earth Born)', message: expect.stringContaining('kept as "Human-Earth-Born"') }))
    expect(report.renamed).toContainEqual(expect.objectContaining({ id: '-Heavy Chest 1' }))
  })
})
