import { cpSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import sw5eFixture from '../fixtures/sw5e/game'
import { createGame, defineGame } from '../schemas'
import { findBacklog } from '../validator/backlog'
import { checkProse } from '../validator/prose'
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

describe('prose', () => {
  const game = createGame(defineGame({ ...sw5eFixture, enums: { ...sw5eFixture.enums, extend: { ...sw5eFixture.enums?.extend, edgeTypes: ['commands'] } } }))
  const prose = (...lines: string[]) => {
    const records = new Map<string, Map<string, Record<string, unknown>>>([
      ['conditions', new Map([['prone', { id: 'prone', name: 'Prone' }]])],
      ['feats', new Map([['f', { id: 'f', body: lines.join('\n') }]])],
    ])
    return checkProse(game, records, new Map()).map(i => `${i.severity}:${i.rule}`)
  }

  it('accepts the engine components wherever MDC reads them', () => {
    expect(prose(
      'Within :distance{length="5" adj num-only} of you (:condition{id="prone"}), 60/[:distance{length="100" abbr}].',
      '## Heading :change-badge{type="new"}',
      '::edge-list{type="commands"}',
      '::',
      `::source-reference{pages="2-3" source="races" :additional='[{"source":"wiki","pages":"Asari"}]'}`,
      '::',
      'A ratio of 1:2{x} is not a component.',
    )).toEqual([])
  })

  it('rejects framework tags, naming the component to use', () => {
    const records = new Map([['feats', new Map([['f', { id: 'f', body: 'within <me-distance length="5" /> and <v-chip>new</v-chip>' }]])]])
    expect(checkProse(game, records, new Map()).map(i => [i.rule, i.message])).toEqual([
      ['framework-tag', '<me-distance> is a framework tag; content uses MDC components; use :distance'],
      ['framework-tag', '<v-chip> is a framework tag; content uses MDC components'],
    ])
  })

  it('checks component names, kinds, props and references', () => {
    expect(prose(' :distanse{length="5"}')).toEqual(['error:mdc-unknown-component'])
    expect(prose(' :distance{lenght="5"}')).toEqual(['warning:mdc-unknown-prop', 'error:mdc-missing-prop'])
    expect(prose('::distance{length="5"}', '::')).toEqual(['error:mdc-component-kind'])
    expect(prose(' :change-badge{type="old"}')).toEqual(['error:mdc-invalid-prop'])
    expect(prose(' :condition{id="stunned"}')).toEqual(['error:ref-missing'])
    expect(prose('::edge-list{type="nope"}', '::')).toEqual(['error:mdc-invalid-prop'])
  })

  it('flags components MDC would show as text', () => {
    expect(prose('a range of 60/:distance{length="100"}')).toEqual(['error:mdc-not-parsed'])
    expect(prose('<p>within :distance{length="5"}</p>')).toEqual(['error:mdc-in-html'])
  })
})
