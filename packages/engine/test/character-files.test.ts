import { describe, expect, it } from 'vitest'
import { EXPORT_FORMAT, exportFile, exportName, isLegacyCharacter, parseImport } from '../app/utils/character-files'
import { newCharacter } from '../character'

describe('character files', () => {
  const a = newCharacter({ id: 'test' }, 'Todd')
  const b = newCharacter({ id: 'test' }, 'Liara T\'Soni')

  it('round-trips exports', () => {
    expect(exportFile('test', [a])).toEqual({ format: EXPORT_FORMAT, game: 'test', character: a })
    expect(parseImport(JSON.stringify(exportFile('test', [a, b])))).toEqual([
      { kind: 'current', game: 'test', character: a },
      { kind: 'current', game: 'test', character: b },
    ])
    expect(exportName([b])).toBe('Liara TSoni.json')
    expect(exportName([a, b], new Date('2026-11-01T12:00:00Z'))).toBe('characters-2026-11-01.json')
  })

  it('reads the live site exports', () => {
    const old = { name: 'Old', meta: { version: '1.0.1' }, currentStats: {} }
    expect(isLegacyCharacter(old)).toBe(true)
    expect(isLegacyCharacter(a)).toBe(false)
    expect(parseImport(JSON.stringify(old))).toEqual([{ kind: 'legacy', character: old }])
    expect(parseImport(JSON.stringify([old, old]))).toHaveLength(2)
    expect(parseImport(JSON.stringify({ x: old, y: old }))).toHaveLength(2)
  })

  it('rejects other files', () => {
    expect(() => parseImport('nope')).toThrow('not JSON')
    expect(() => parseImport('{"a":1}')).toThrow('no characters')
  })
})
