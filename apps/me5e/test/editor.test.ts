import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { gzipSync } from 'node:zlib'
import {
  DEFAULT_EDITOR_ACCESS, checkEditPath, deleteBlockers, editMessages, editorCollections, fileRecord, flattenMessages,
  messageProblems, parseRecordPath, readRecordFile, recordFile, writeRecordFile,
} from '@omnibrew/engine/editor'
import { loadRecords } from '@omnibrew/engine/rules/load'
import { createGame } from '@omnibrew/engine/schemas'
import { validateRecord } from '@omnibrew/engine/validator/record'
import { describe, expect, it } from 'vitest'
import { me5eDefinition } from '../game/definition'

// The content editor on ME's real content (plan/33 piece 1). Local only: needs the content repo next to omnibrew.
const contentRoot = resolve(__dirname, '../../../../omnibrew-me5e-data')
const has = existsSync(join(contentRoot, 'content'))
const sources = me5eDefinition.sources

describe.skipIf(!has)('content editor on ME content (local)', () => {
  const files = has
    ? Object.entries(sources).flatMap(([collection, s]) => readdirSync(join(contentRoot, s.dir)).filter(f => f.endsWith('.md')).map(f => ({ collection, path: `${s.dir}/${f}` })))
    : []
  const loaded = has ? loadRecords(contentRoot, me5eDefinition) : { records: new Map(), derivedIds: {} }
  const game = createGame(me5eDefinition)

  it('every record file reads into the form model and writes back byte for byte', () => {
    const changed: string[] = []
    for (const { path } of files) {
      const text = readFileSync(join(contentRoot, path), 'utf8')
      const file = readRecordFile(text)
      expect(file.errors, path).toEqual([])
      const id = parseRecordPath(sources, path)!.id
      const out = writeRecordFile(recordFile(structuredClone(fileRecord(file, id)), file.crlf))
      if (out !== text) {
        changed.push(path)
        // The exception changes quote style only: it reads back equal and writes stably.
        expect(readRecordFile(out).attributes).toEqual(file.attributes)
        expect(writeRecordFile(readRecordFile(out))).toBe(out)
      }
    }
    expect(files.length).toBeGreaterThan(2000)
    expect(changed).toEqual(['content/mods/sticky-grenade-launcher.md'])
  })

  it('every record is a path an editor may write, and no admin-only one', () => {
    for (const { path } of files) expect(checkEditPath(sources, DEFAULT_EDITOR_ACCESS, path, ['editors']).ok, path).toBe(true)
  })

  it('content mode finds no errors in today’s content (what CI accepts, the editor accepts)', () => {
    const errors: string[] = []
    for (const [collection, recs] of loaded.records) {
      const derived = new Set((loaded.derivedIds as Record<string, string[]>)[collection] ?? [])
      for (const [id, rec] of recs) {
        if (derived.has(id)) continue
        for (const i of validateRecord(game, collection, rec, loaded.records, { content: true })) if (i.severity === 'error') errors.push(`${collection}/${id}: ${i.message}`)
      }
    }
    expect(errors).toEqual([])
  }, 60_000)

  it('the editor bundle stays small and lists the derived Exalted Lineages', () => {
    const json = JSON.stringify({ collections: editorCollections(loaded.records), derived: loaded.derivedIds })
    const kb = gzipSync(json).length / 1024
    expect(kb).toBeLessThan(400)
    expect(Object.values(loaded.derivedIds as Record<string, string[]>).flat().length).toBeGreaterThanOrEqual(57)
  })

  it('deleting a class is blocked by its features', () => {
    const blockers = deleteBlockers(game, loaded.records, 'classes', 'adept')
    expect(blockers.some(i => i.collection === 'class-features')).toBe(true)
  })

  it('one UI string edit changes one line of messages/en.yml, and every string compiles', () => {
    const text = readFileSync(join(contentRoot, 'messages/en.yml'), 'utf8')
    const out = editMessages(text, [{ path: ['homepage', 'title'], value: 'Changed title' }])
    const a = text.split('\r\n')
    const b = out.split('\r\n')
    expect(b.length).toBe(a.length)
    expect(b.filter((l, i) => l !== a[i])).toHaveLength(1)
    const problems = [...flattenMessages(text)].flatMap(([k, v]) => messageProblems(v).map(p => `${k}: ${p}`))
    expect(problems).toEqual([])
    expect(checkEditPath(sources, DEFAULT_EDITOR_ACCESS, 'messages/en.yml', ['editors']).ok).toBe(false)
  })
})
