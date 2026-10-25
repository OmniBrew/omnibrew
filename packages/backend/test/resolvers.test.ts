import { describe, expect, it, vi } from 'vitest'

// The AppSync JS resolvers with @aws-appsync/utils replaced by a small fake: what they
// ask DynamoDB for and how they answer. The sandbox check (apps/me5e/test/sandbox.test.ts)
// runs them for real.

class ResolverError extends Error {
  constructor(message: string, readonly type?: string) {
    super(message)
  }
}

class EarlyReturn extends Error {
  constructor(readonly value: unknown) {
    super('early return')
  }
}

vi.mock('@aws-appsync/utils', () => ({
  util: {
    error: (message: string, type?: string) => { throw new ResolverError(message, type) },
    unauthorized: () => { throw new ResolverError('Unauthorized', 'Unauthorized') },
    time: { nowISO8601: () => '2026-10-25T00:00:00.000Z' },
    dynamodb: { toMapValues: (v: Record<string, unknown>) => ({ marshalled: v }) },
  },
  runtime: { earlyReturn: (value: unknown) => { throw new EarlyReturn(value) } },
}))

// The requests are DynamoDB shapes checked field by field below.
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- see above
type Resolver = { request(ctx: unknown): any, response(ctx: unknown): any }
// A computed path: the resolvers are untyped JS (AppSync runs them as written).
const load = (name: string) => import(`../resolvers/${name}.js`) as Promise<Resolver>
const tally = await load('tally-homebrew')
const listPublic = await load('list-public-homebrew')
const getPublic = await load('get-public-homebrew')
const ensureProfile = await load('ensure-profile')

const identity = { sub: 'sub-b', username: 'google_b' }
// A branch deployment: table names still end in NONE.
const stash = { awsAppsyncApiId: 'api', amplifyApiEnvironmentName: 'main' }
const published = { id: 'h1', owner: 'sub-a::google_a', status: 'published', usageCount: 2, voteCount: 5, kind: 'weapons', title: 'T', slug: 't', data: '{}' }

function tallyContext(field: 'setHomebrewUse' | 'setHomebrewVote', homebrew: Record<string, unknown>, active = true, who = identity) {
  return { info: { fieldName: field }, identity: who, args: { homebrewId: homebrew.id, active }, stash: { ...stash, homebrew }, error: undefined as unknown }
}

describe('tally-homebrew', () => {
  it('puts a use row and adds one to usageCount in one transaction', () => {
    const ctx = tallyContext('setHomebrewUse', published)
    const request = tally.request(ctx)
    expect(request.operation).toBe('TransactWriteItems')
    const [row, count] = request.transactItems
    expect(row).toMatchObject({ table: 'HomebrewUse-api-NONE', operation: 'PutItem', key: { marshalled: { id: 'sub-b#h1' } }, condition: { expression: 'attribute_not_exists(id)' } })
    expect(row.attributeValues.marshalled).toMatchObject({ owner: 'sub-b::google_b', homebrewId: 'h1', __typename: 'HomebrewUse' })
    expect(count).toMatchObject({ table: 'Homebrew-api-NONE', operation: 'UpdateItem', key: { marshalled: { id: 'h1' } } })
    expect(count.update.expressionNames['#count']).toBe('usageCount')
    expect(count.update.expressionValues.marshalled[':delta']).toBe(1)
    expect(tally.response(ctx)).toEqual({ homebrewId: 'h1', usageCount: 3, voteCount: 5, active: true })
  })

  it('removes a vote and changes nothing when the row was already gone', () => {
    const ctx = tallyContext('setHomebrewVote', published, false)
    const [row, count] = tally.request(ctx).transactItems
    expect(row).toMatchObject({ table: 'HomebrewVote-api-NONE', operation: 'DeleteItem', condition: { expression: 'attribute_exists(id)' } })
    expect(count.update.expressionNames['#count']).toBe('voteCount')
    expect(tally.response(ctx)).toEqual({ homebrewId: 'h1', usageCount: 2, voteCount: 4, active: false })
    ctx.error = { type: 'DynamoDB:TransactionCanceledException', message: 'cancelled' }
    expect(tally.response(ctx)).toEqual({ homebrewId: 'h1', usageCount: 2, voteCount: 5, active: false })
  })

  it('refuses votes on unpublished or own homebrew, and any use of private homebrew by others', () => {
    expect(() => tally.request(tallyContext('setHomebrewVote', { ...published, status: 'development' }))).toThrow(/voted for/)
    expect(() => tally.request(tallyContext('setHomebrewVote', published, true, { sub: 'sub-a', username: 'google_a' }))).toThrow(/voted for/)
    expect(() => tally.request(tallyContext('setHomebrewUse', { ...published, status: 'private' }))).toThrow(/Unauthorized/)
    // A Gen 1 row owned by a bare username is still the author's.
    expect(() => tally.request(tallyContext('setHomebrewUse', { ...published, owner: 'google_a', status: 'private' }, true, { sub: 'sub-a', username: 'google_a' }))).not.toThrow()
  })

  it('passes other errors on', () => {
    const ctx = tallyContext('setHomebrewUse', published)
    ctx.error = { type: 'DynamoDB:AccessDeniedException', message: 'denied' }
    expect(() => tally.response(ctx)).toThrow(/denied/)
  })
})

describe('public homebrew', () => {
  it('lists published by default, never private', () => {
    const request = listPublic.request({ args: { kind: 'weapons' } })
    expect(request).toMatchObject({ operation: 'Query', index: 'byKind', limit: 100 })
    expect(request.query.expressionValues.marshalled).toEqual({ ':kind': 'weapons', ':status': 'published' })
    expect(() => listPublic.request({ args: { kind: 'weapons', status: 'private' } })).toThrow(/Unauthorized/)
    expect(listPublic.request({ args: { kind: 'weapons', limit: 1000 } }).limit).toBe(100)
  })

  it('hides private items and exposes the author as a profile id', () => {
    const result = listPublic.response({ result: { items: [published, { ...published, id: 'h2', status: 'private' }], nextToken: 'n' } })
    expect(result.items).toHaveLength(1)
    expect(result.items[0]).toMatchObject({ id: 'h1', authorId: 'sub-a', official: false })
    expect(result.items[0]).not.toHaveProperty('owner')
    expect(getPublic.response({ result: { ...published, status: 'private' } })).toBeNull()
    expect(getPublic.response({ result: null })).toBeNull()
  })
})

describe('ensure-profile', () => {
  it('returns an existing profile without writing', () => {
    expect(() => ensureProfile.request({ prev: { result: { id: 'sub-b' } }, identity })).toThrow(EarlyReturn)
  })

  it('creates the profile under the caller sub, never overwriting', () => {
    const request = ensureProfile.request({ prev: { result: null }, identity })
    expect(request).toMatchObject({ operation: 'PutItem', key: { marshalled: { id: 'sub-b' } }, condition: { expression: 'attribute_not_exists(id)' } })
    expect(request.attributeValues.marshalled).toMatchObject({ owner: 'sub-b::google_b', maxCharacters: 50 })
  })
})
