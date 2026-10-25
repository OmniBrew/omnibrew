import { describe, expect, it } from 'vitest'
import { z } from 'zod'
import { contentCollectionName, contentSchema } from '../content/collections'
import { parseFrontMatter, stringifyRecord, stringifyYaml, toCrlf } from '../content/format'
import { findMdcComponents, formatMdcAttrs, readMdcAttrs } from '../content/mdc'
import sw5eFixture from '../fixtures/sw5e/game'
import { createGame } from '../schemas'

describe('record files', () => {
  const record = {
    name: 'Charge',
    date: new Date('2018-12-15'),
    cr: '1',
    slots: { 1: [4, 5], 2: [0, 1] },
    text: 'Each creature within :distance{length="10"} of the target: save.',
    start: ':condition{id="prone"} first',
    html: 'line one\nline two',
    empty: [],
  }

  it('write deterministic YAML that reads back as the same record', () => {
    const text = stringifyRecord(record, 'Body text.\n\n')
    expect(text).toBe([
      '---',
      'name: Charge',
      'date: 2018-12-15',
      'cr: "1"',
      'slots:',
      '  1:',
      '    - 4',
      '    - 5',
      '  2:',
      '    - 0',
      '    - 1',
      'text: \'Each creature within :distance{length="10"} of the target: save.\'',
      'start: :condition{id="prone"} first',
      'html: |-',
      '  line one',
      '  line two',
      'empty: []',
      '---',
      'Body text.',
      '',
    ].join('\n'))
    const back = parseFrontMatter(text)
    expect(JSON.stringify(back.attributes)).toBe(JSON.stringify(record))
    expect(back.body).toBe('Body text.\n')
    expect(stringifyRecord(back.attributes, back.body)).toBe(text)
  })

  it('read CRLF files as LF', () => {
    const back = parseFrontMatter(toCrlf(stringifyRecord({ name: 'X' }, 'a\n\nb')))
    expect(back).toMatchObject({ attributes: { name: 'X' }, body: 'a\n\nb\n', errors: [] })
  })

  it('handle empty and missing front-matter', () => {
    expect(stringifyRecord({})).toBe('---\n---\n')
    expect(parseFrontMatter('---\n---\nhi')).toMatchObject({ attributes: {}, body: 'hi' })
    expect(parseFrontMatter('---\nx: 1\n')).toMatchObject({ unterminated: true })
    expect(parseFrontMatter('---\nx: a---\n---\n')).toMatchObject({ attributes: { x: 'a---' } })
  })

  it('never write YAML anchors for repeated objects', () => {
    const shared = { a: 1 }
    expect(stringifyYaml({ x: shared, y: shared })).toBe('x:\n  a: 1\ny:\n  a: 1\n')
  })
})

describe('MDC components', () => {
  it('keep braces inside quoted attribute values', () => {
    expect(readMdcAttrs('{length="1" override="extra {metric}" adj}', 0)).toEqual({ attrs: { length: '1', override: 'extra {metric}', adj: true }, end: 42 })
    expect(formatMdcAttrs({ ':additional': '[{"source":"wiki"}]', length: '5', adj: true })).toBe('{:additional=\'[{"source":"wiki"}]\' length="5" adj}')
  })

  it('find inline and block components and whether MDC reads them', () => {
    const found = findMdcComponents('a :distance{length="5"} b/:weight{amount="2"}\n::edge-list{type="x"}\n::\n<p>c :condition{id="prone"}</p>')
    expect(found.map(c => [c.kind, c.name, c.parsed, c.inHtml])).toEqual([
      ['inline', 'distance', true, false],
      ['inline', 'weight', false, false],
      ['block', 'edge-list', true, false],
      ['inline', 'condition', false, true],
    ])
  })
})

describe('Nuxt Content schemas', () => {
  const game = createGame(sw5eFixture)

  it('name collections as identifiers', () => {
    expect(contentCollectionName('class-features')).toBe('classFeatures')
  })

  it('leave out id, body and kind, merge unions and make every field optional', () => {
    const armor = contentSchema(game, 'armor')
    expect(Object.keys(armor.shape)).not.toContain('kind')
    expect(Object.keys(armor.shape)).toEqual(expect.arrayContaining(['name', 'coverage', 'slot', 'ac']))
    expect(armor.safeParse({}).success).toBe(true)
    const json = z.toJSONSchema(contentSchema(game, 'powers'), { unrepresentable: 'any' })
    expect(JSON.stringify(json)).not.toContain('$ref')
  })
})
