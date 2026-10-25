import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { recordPageRoutes } from '../content/routes'
import sw5eFixture from '../fixtures/sw5e/game'
import { formatDay, newestFirst } from '../app/utils/dates'

describe('news dates', () => {
  const posts = [
    { id: 'a', date: '2022-04-02' },
    { id: 'b', date: '2023-01-01' },
    { id: 'c' },
    { id: 'd', date: '2023-01-01' },
  ]

  it('sorts newest first, ties by id descending, undated last', () => {
    expect(newestFirst(posts, p => p.id).map(p => p.id)).toEqual(['d', 'b', 'a', 'c'])
  })

  it('shows calendar days without shifting them by time zone', () => {
    expect(formatDay('2023-01-01', 'en-US')).toBe('Sunday, January 1, 2023')
    expect(formatDay(new Date('2022-04-02T00:00:00Z'), 'en-US', 'short')).toBe('Apr 2, 2022')
    expect(formatDay(undefined, 'en-US')).toBe('')
  })
})

describe('record page routes', () => {
  const root = join(import.meta.dirname, '../fixtures/sw5e/content')

  it('lists a page per record, at the configured URL, without anchors or page-less collections', () => {
    const routes = recordPageRoutes(root, sw5eFixture, {
      'weapon-properties': '/appendix/weapon-properties#{id}',
      'armor-properties': false,
      'class-features': '/classes/{klass}#{id}',
      'powers': '/force-powers/{id}',
    })
    expect(routes).toEqual([
      '/armor/battle-armor',
      '/classes/consular',
      '/force-powers/force-lightning',
      '/force-powers/shock',
      '/weapons/blaster-pistol',
    ])
  })
})
