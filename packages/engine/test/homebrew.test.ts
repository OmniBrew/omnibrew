import { describe, expect, it } from 'vitest'
import { copiesOf, diffSummaries, escapeTags, getPath, isHomebrewId, mergeHomebrew, missingFields, referencedHomebrew, removeCopy, setPath, syncCopies, unusedCopies } from '../app/utils/homebrew'

const A = '3f0f6a2e-1c5d-4c1e-9a43-0d6f2b1a7c11'
const B = '9b1d2c3e-4f50-4a6b-8c7d-0e1f2a3b4c5d'

describe('field paths', () => {
  it('reads and writes nested paths, creating arrays for numeric keys', () => {
    const r = setPath({ name: 'X' }, 'casting.0.range.short', 30)
    expect(r).toEqual({ name: 'X', casting: [{ range: { short: 30 } }] })
    expect(getPath(r, 'casting.0.range.short')).toBe(30)
    expect(getPath(r, 'casting.1.range')).toBeUndefined()
  })

  it('drops empty values and the objects they leave empty, never array slots', () => {
    let r: Record<string, unknown> = { casting: [{ range: { short: 30, aoe: { size: 10 } } }], tags: ['a'] }
    r = setPath(r, 'casting.0.range.aoe.size', undefined)
    expect(r.casting).toEqual([{ range: { short: 30 } }])
    r = setPath(r, 'casting.0.range.short', '')
    expect(r.casting).toEqual([{}])
    expect(setPath(r, 'tags', [])).not.toHaveProperty('tags')
  })

  it('does not change the original', () => {
    const r = { a: { b: 1 } }
    setPath(r, 'a.b', 2)
    expect(r.a.b).toBe(1)
  })

  it('lists required fields left empty, shown ones only', () => {
    const fields = [
      { path: 'name', label: '', input: { kind: 'text' as const }, required: true },
      { path: 'slot', label: '', input: { kind: 'text' as const }, required: true, when: { path: 'coverage', is: ['piece'] } },
    ]
    expect(missingFields(fields, { coverage: 'suit' })).toEqual(['name'])
    expect(missingFields(fields, { name: 'A', coverage: 'piece' })).toEqual(['slot'])
  })
})

describe('homebrew in the rules', () => {
  const content = new Map([['weapons', new Map([['pistol', { id: 'pistol', name: 'Pistol' }]])], ['powers', new Map()]])

  it('adds homebrew to copies of the collections it joins, marked and with its item kind', () => {
    const merged = mergeHomebrew(content, [{ id: A, kind: 'weapons', data: { name: 'Hand Cannon', body: 'text' }, author: 'Liara' }], { weapons: 'weapon' })
    expect(merged.get('weapons')!.get(A)).toEqual({ name: 'Hand Cannon', kind: 'weapon', id: A, homebrew: true, author: 'Liara' })
    expect(content.get('weapons')!.has(A)).toBe(false)
    expect(merged.get('powers')).toBe(content.get('powers'))
  })

  it('never lets a non-UUID id or a content id be replaced', () => {
    const merged = mergeHomebrew(content, [{ id: 'pistol', kind: 'weapons', data: { name: 'Evil' } }])
    expect(merged.get('weapons')!.get('pistol')!.name).toBe('Pistol')
    expect(isHomebrewId(A)).toBe(true)
    expect(isHomebrewId('m-3-predator')).toBe(false)
  })

  it('escapes tags in homebrew text so no raw HTML renders', () => {
    expect(escapeTags({ a: '<img src=x onerror=alert(1)>', b: [':distance{length=30}'] })).toEqual({ a: '&lt;img src=x onerror=alert(1)>', b: [':distance{length=30}'] })
    const merged = mergeHomebrew(content, [{ id: A, kind: 'weapons', data: { name: '<script>x</script>' } }])
    expect(merged.get('weapons')!.get(A)!.name).toBe('&lt;script>x&lt;/script>')
  })
})

describe('copies on a character', () => {
  const character: Parameters<typeof syncCopies>[0] = {
    powers: [{ id: A }, { id: 'warp' }],
    equipment: [{ id: 'pistol', mods: [{ id: B }] }],
    choices: [{ values: ['alert', { ability: 'str', amount: 1 }] }],
  }

  it('finds every homebrew id the character uses', () => {
    expect([...referencedHomebrew(character)]).toEqual([A, B])
  })

  it('copies newly used homebrew and refreshes older copies', () => {
    const available = new Map([
      [A, { id: A, kind: 'powers', data: { name: 'Burn' }, author: 'Liara', updatedAt: '2026-11-02' }],
      [B, { id: B, kind: 'mods', data: { name: 'Scope' }, updatedAt: '2026-11-01' }],
    ])
    const first = syncCopies(character, available)
    expect(first.added).toEqual([A, B])
    expect(first.character.homebrew![A]).toEqual({ kind: 'powers', data: { name: 'Burn' }, author: 'Liara', updatedAt: '2026-11-02' })
    expect(syncCopies(first.character, available).character).toBe(first.character)
    available.set(A, { id: A, kind: 'powers', data: { name: 'Burn II' }, author: 'Liara', updatedAt: '2026-11-05' })
    const second = syncCopies(first.character, available)
    expect(second.refreshed).toEqual([A])
    expect(second.character.homebrew![A]!.data.name).toBe('Burn II')
    expect(copiesOf(second.character).map(h => h.id)).toEqual([A, B])
  })

  it('keeps copies whose source is gone, and lists unused ones', () => {
    const withCopies = { ...character, homebrew: { [A]: { kind: 'powers', data: { name: 'Burn' } }, [B]: { kind: 'mods', data: {} } } }
    expect(syncCopies(withCopies, new Map()).character).toBe(withCopies)
    const unused = { ...withCopies, powers: [] }
    expect(unusedCopies(unused)).toEqual([A])
    expect(Object.keys(removeCopy(unused, A).homebrew!)).toEqual([B])
  })
})

describe('what changes', () => {
  it('lists changed, added and removed lines', () => {
    expect(diffSummaries(
      [{ key: 'ac', value: '15' }, { key: 'speed.walk', value: '30' }, { key: 'attack.Fist', value: '+4' }],
      [{ key: 'ac', value: '17' }, { key: 'speed.walk', value: '30' }, { key: 'defense.resistance', value: 'fire' }],
    )).toEqual([
      { key: 'ac', before: '15', after: '17' },
      { key: 'defense.resistance', before: null, after: 'fire' },
      { key: 'attack.Fist', before: '+4', after: null },
    ])
  })
})
