import { cpSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import sw5eFixture from '../fixtures/sw5e/game'
import { findBacklog } from '../validator/backlog'
import { legacyMerge } from '../validator/load'
import { validateContent } from '../validator/validate'

const fixtureDir = join(import.meta.dirname, '../fixtures/sw5e/content')

function brokenCopy(edits: Record<string, [string | RegExp, string]>) {
  const dir = mkdtempSync(join(tmpdir(), 'omnibrew-'))
  cpSync(fixtureDir, dir, { recursive: true })
  for (const [file, [from, to]] of Object.entries(edits)) {
    const path = join(dir, file)
    writeFileSync(path, readFileSync(path, 'utf8').replace(from, to))
  }
  return dir
}

describe('SW5e-shaped fixtures', () => {
  it('validate with no issues', () => {
    const result = validateContent(fixtureDir, sw5eFixture)
    expect(result.issues).toEqual([])
    expect(result.counts).toMatchObject({ 'powers': 2, 'classes': 1, 'class-features': 1, 'weapons': 1, 'armor': 1 })
  })

  it('catch a missing prerequisite, a missing property value and a force power without alignment', () => {
    const dir = brokenCopy({
      'powers/force-lightning.md': ['prerequisite: shock', 'prerequisite: shok'],
      'weapons/blaster-pistol.md': ['    value: 16\n', ''],
      'powers/shock.md': ['alignment: dark\n', ''],
    })
    const rules = validateContent(dir, sw5eFixture).issues.map(i => `${i.collection}/${i.id}:${i.rule}`)
    expect(rules.sort()).toEqual([
      'powers/force-lightning:ref-missing',
      'powers/shock:force-power-alignment',
      'weapons/blaster-pistol:property-value',
    ])
  })

  it('report YAML errors per file', () => {
    const dir = brokenCopy({ 'armor/battle-armor.md': ['armorType: heavy', 'armorType: heavy\narmorType: light'] })
    const issues = validateContent(dir, sw5eFixture).issues
    expect(issues).toMatchObject([{ severity: 'error', rule: 'yaml-error', file: 'armor/battle-armor.md' }])
  })
})

describe('rules written as notes', () => {
  it('flags global notes, text-only actions, riders and prose-only features, not structured ones', () => {
    const records = new Map([['class-features', new Map<string, Record<string, unknown>>([
      ['a', { mechanics: [{ type: 'global-note', subType: 'defenses', value: 'Null Critical' }] }],
      ['b', { mechanics: [{ type: 'reaction', name: 'Dodge', shortDesc: 'Halve the damage.' }] }],
      ['c', { mechanics: [{ type: 'action', damage: [{ dieCount: 1, dieType: 6 }], notes: ['Hit: CON save or stunned'] }] }],
      ['d', { body: 'At 13th level you can use Indomitable twice.' }],
      ['e', { mechanics: [{ type: 'asi', ability: 'dex', amount: 1 }], body: 'text' }],
    ])]])
    const rules = findBacklog(records, new Map()).map(i => `${i.id}:${i.rule}`)
    expect(rules).toEqual(['a:note-only:global-note', 'b:note-only:text-action', 'c:note-only:rider-note', 'd:note-only:prose-only'])
  })
})

describe('legacy data/text merge', () => {
  it('merges arrays of `{ id }` by id and other arrays by index, like build-data.js', () => {
    expect(legacyMerge(
      { a: [{ id: 'x', n: 1 }, { id: 'y', n: 2 }], b: [{ choices: 1 }], c: 1 },
      { a: [{ id: 'y', t: 'Y' }, { id: 'z', t: 'Z' }], b: [{ text: 't' }], c: 2 },
    )).toEqual({
      a: [{ id: 'x', n: 1 }, { id: 'y', n: 2, t: 'Y' }, { id: 'z', t: 'Z' }],
      b: [{ choices: 1, text: 't' }],
      c: 2,
    })
  })
})
