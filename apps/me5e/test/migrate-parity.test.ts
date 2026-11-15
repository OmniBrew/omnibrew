import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { bundleRecords, createRules, splitBundle } from '@omnibrew/engine/rules'
import { loadRecords } from '@omnibrew/engine/rules/load'
import { createGame } from '@omnibrew/engine/schemas'
import jsonpack from 'jsonpack/main'
import { describe, expect, it } from 'vitest'
import { me5e } from '../game'
import { me5eDefinition } from '../game/definition'
import { migrateCharacter } from '../migrate/character'
import { migrateUser } from '../migrate/user'
import { rulesBundleOptions } from '../rules-bundle'

/**
 * Parity on migrated characters (plan/28 §7): every generated parity fixture, stored as a
 * Gen 1 row (jsonpack) and brought over by `migrateUser` with the Lambda's content (the
 * bundle's records), is exactly the character `parity.test.ts` compares with the live sheet,
 * and computes. Local only: needs the content repo next to this checkout.
 */
const contentDir = fileURLToPath(new URL('../../../../omnibrew-me5e-data', import.meta.url))
const fixturesDir = fileURLToPath(new URL('./fixtures/characters', import.meta.url))
const enabled = existsSync(`${contentDir}/content`)

describe.skipIf(!enabled)('migrated characters keep parity', () => {
  it('every fixture, through migrateUser, equals the parity-tested character and computes', () => {
    const { records } = loadRecords(contentDir, me5e)
    const lambdaRecords = bundleRecords(splitBundle(records, { ...rulesBundleOptions, keepBody: [] }))
    const game = createGame(me5eDefinition)
    const lambdaRules = createRules(game, lambdaRecords)
    const fullRules = createRules(createGame(me5e), records)
    const files = readdirSync(fixturesDir).filter(f => f.endsWith('.json'))
    expect(files.length).toBeGreaterThan(100)
    const raw = files.map(f => JSON.parse(readFileSync(`${fixturesDir}/${f}`, 'utf8')) as Record<string, unknown>)
    const t = '2024-01-01T00:00:00.000Z'
    const out = migrateUser({
      game, content: lambdaRules.content, records: lambdaRecords, caller: { sub: 'sub', username: 'user' },
      gen1: { profile: null, characters: raw.map((c, i) => ({ id: `c-${i}`, owner: 'user', data: jsonpack.pack(c), createdOn: t, updatedOn: t })), bookmarks: [], homebrew: [], uses: [], votes: [] },
      existing: { profile: null, characterIds: new Set(), characterCount: 0, bookmarkKeys: new Set(), useIds: new Set(), voteIds: new Set() },
      homebrew: new Map(), authorName: () => null, now: t, newId: () => 'x',
    })
    expect(out.report.characters.failed).toEqual([])
    expect(out.characters).toHaveLength(files.length)
    out.characters.forEach((row) => {
      const i = Number(row.id.slice(2))
      const direct = migrateCharacter(raw[i]!, { game: createGame(me5e), content: fullRules.content, now: t }).character
      expect(row.data, files[i]).toEqual(direct)
      expect(() => fullRules.sheet(row.data).defenses).not.toThrow()
    })
  }, 300_000)
})
