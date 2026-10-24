import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { createGame } from '@omnibrew/engine/schemas'
import { validateContent } from '@omnibrew/engine/validator'
import { describe, expect, it } from 'vitest'
import { me5e } from '../game'

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

  it('namespaces every ME mechanic and keeps the old names as renames', () => {
    const meTypes = game.mechanicTypes.filter(t => t.startsWith('me:'))
    expect(meTypes.length).toBeGreaterThan(20)
    expect(game.legacyMechanicTypes.get('shields')).toBe('me:shields')
  })
})

// Runs only where the content repo is checked out next to the monorepo (not in CI;
// the content repo's own CI validates it).
const contentRoot = join(import.meta.dirname, '../../../../omnibrew-me5e-data')
describe.skipIf(!existsSync(join(contentRoot, 'content')))('ME5e content', () => {
  it('loads every collection with no errors or warnings', () => {
    const result = validateContent(contentRoot, me5e)
    expect(result.counts.powers).toBeGreaterThan(80)
    expect(result.counts['class-features']).toBeGreaterThan(400)
    expect(result.issues.filter(i => i.severity !== 'info')).toEqual([])
  })
})
