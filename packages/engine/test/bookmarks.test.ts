import { describe, expect, it } from 'vitest'
import { createLocalBookmarks, groupBookmarks, mergeBookmarks } from '../app/utils/bookmarks'

const memory = () => {
  const data = new Map<string, string>()
  return { getItem: (k: string) => data.get(k) ?? null, setItem: (k: string, v: string) => void data.set(k, v), removeItem: (k: string) => void data.delete(k), data }
}

describe('local bookmarks', () => {
  it('keeps one list per game and drops malformed entries', () => {
    const storage = memory()
    const me = createLocalBookmarks(storage, 'me5e')
    me.save([{ type: 'powers', recordId: 'warp' }, { id: 'x', type: 'npc', recordId: 'gen-1', data: { name: 'Bob' } }])
    expect(createLocalBookmarks(storage, 'sw5e').list()).toEqual([])
    expect(me.list()).toEqual([{ type: 'powers', recordId: 'warp' }, { type: 'npc', recordId: 'gen-1', data: { name: 'Bob' } }])
    storage.setItem('omnibrew:me5e:bookmarks', JSON.stringify([{ type: 'powers' }, 'junk', { type: 'weapons', recordId: 'm-3' }]))
    expect(me.list()).toEqual([{ type: 'weapons', recordId: 'm-3' }])
    storage.setItem('omnibrew:me5e:bookmarks', '{not json')
    expect(me.list()).toEqual([])
    me.clear()
    expect(storage.data.size).toBe(0)
  })

  it('works without storage', () => {
    const none = createLocalBookmarks(null, 'me5e')
    none.save([{ type: 'powers', recordId: 'warp' }])
    expect(none.list()).toEqual([])
  })
})

describe('signing in', () => {
  it('uploads what the account lacks and collapses duplicates', () => {
    const remote = [{ id: '1', type: 'powers', recordId: 'warp' }, { id: '2', type: 'powers', recordId: 'warp' }, { id: '3', type: 'weapons', recordId: 'm-3' }]
    const local = [{ type: 'powers', recordId: 'warp' }, { type: 'bestiary', recordId: 'husk' }, { type: 'bestiary', recordId: 'husk' }]
    const { keep, upload, duplicates } = mergeBookmarks(local, remote)
    expect(keep.map(b => b.id)).toEqual(['1', '3'])
    expect(duplicates.map(b => b.id)).toEqual(['2'])
    expect(upload).toEqual([{ type: 'bestiary', recordId: 'husk' }])
  })
})

describe('the bookmarks page', () => {
  it('groups in the game order, unknown types last', () => {
    const groups = groupBookmarks([{ type: 'zzz' }, { type: 'powers' }, { type: 'weapons' }, { type: 'aaa' }, { type: 'powers' }], ['weapons', 'powers'])
    expect(groups.map(g => [g.type, g.items.length])).toEqual([['weapons', 1], ['powers', 2], ['aaa', 1], ['zzz', 1]])
  })
})
