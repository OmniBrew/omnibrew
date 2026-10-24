import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { createGame } from '@omnibrew/engine/schemas'
import { validateContent } from '@omnibrew/engine/validator'
import { describe, expect, it } from 'vitest'
import { me5e } from '../game'
import { meLegacy } from '../game/legacy'
import { legacyTagsToMdc } from '../game/mdc'

describe('ME5e game definition', () => {
  const game = createGame(me5e)

  it('builds a schema for every source collection', () => {
    expect(Object.keys(game.schemas).sort()).toEqual(Object.keys(me5e.sources).sort())
  })

  it('validates primer tiers as merged deltas', () => {
    const edge = (tiers: unknown[]) => ({ id: 'PRIME_x', name: 'X', type: 'primers', mechanics: [{ type: 'me:primer-detonation', levels: [1, 5], tiers }] })
    const base = { damage: [{ dieCount: 1, dieType: 6, type: 'fire' }], shortDesc: 'Boom.' }
    expect(game.schemas.edges!.safeParse(edge([base, { damage: [{ dieCount: 2 }] }])).success).toBe(true)
    expect(game.schemas.edges!.safeParse(edge([base, { damage: [{ type: 'heat' }] }])).success).toBe(false)
  })

  it('namespaces every ME mechanic and keeps the old names as legacy aliases', () => {
    const meTypes = game.mechanicTypes.filter(t => t.startsWith('me:'))
    expect(meTypes.length).toBeGreaterThan(20)
    expect(game.legacyMechanicTypes.get('shields')).toBe('me:shields')
  })
})

describe('ME legacy adapter', () => {
  const notes: string[] = []
  const ctx = (collection: string) => ({ collection, note: (rule: string) => notes.push(rule) })

  it('turns heat and versatile into weapon property values', () => {
    const out = meLegacy({ type: 'melee', properties: ['versatile', 'light'], heat: 3, versatile: { dieCount: 1, dieType: 10, type: 'slashing' } }, ctx('weapons'))
    expect(out).toMatchObject({
      weaponType: 'melee',
      properties: [{ id: 'versatile', value: { dieCount: 1, dieType: 10 } }, { id: 'light' }, { id: 'heat', value: 3 }],
    })
    expect(out).not.toHaveProperty('heat')
    expect(out).not.toHaveProperty('type')
  })

  it('maps armor placement onto suit or piece', () => {
    expect(meLegacy({ type: 'heavy', placement: 'body_armor' }, ctx('armor'))).toMatchObject({ armorType: 'heavy', coverage: 'suit' })
    expect(meLegacy({ type: 'light', placement: 'head' }, ctx('armor'))).toMatchObject({ coverage: 'piece', slot: 'head' })
  })

  it('renames power fields', () => {
    const out = meLegacy({ type: 'biotic', mechanics: [{}], advancements: [{ id: 'a', mechanics: [{}] }] }, ctx('powers'))
    expect(out).toMatchObject({ powerType: 'biotic', casting: [{}], advancements: [{ id: 'a', casting: [{}] }] })
  })
})

describe('legacy tags to MDC', () => {
  it('rewrites me-distance and me-condition, self-closing or not', () => {
    expect(legacyTagsToMdc('a <me-distance length="10" adj/> sphere')).toBe('a :distance{length="10" adj} sphere')
    expect(legacyTagsToMdc('within <me-distance length=\'150\' abbr /> of')).toBe('within :distance{length=\'150\' abbr} of')
    expect(legacyTagsToMdc('is <me-condition id="primed" sub="necrotic"></me-condition>.')).toBe('is :condition{id="primed" sub="necrotic"}.')
    expect(legacyTagsToMdc('<v-chip>new</v-chip>')).toBe('<v-chip>new</v-chip>')
  })
})

// Runs only where the content repo is checked out next to the monorepo (not in CI).
const contentRoot = join(import.meta.dirname, '../../../../omnibrew-me5e-data')
describe.skipIf(!existsSync(contentRoot))('ME5e content', () => {
  it('loads every collection', () => {
    const result = validateContent(contentRoot, me5e)
    expect(result.counts.powers).toBeGreaterThan(80)
    expect(result.counts['class-features']).toBeGreaterThan(400)
  })
})
