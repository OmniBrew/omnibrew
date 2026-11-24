import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  canEdit, changedPaths, checkEditPath, commitMessage, DEFAULT_EDITOR_ACCESS, deleteBlockers, editMessages, editorBranch,
  editorCollections, editorRecords, fileRecord, flattenMessages, isEditorBranch, isPlainPath, isRecordId, mergeRecords,
  messageProblems, parseRecordPath, prBody, prTitle, readEditorMarker, readRecordFile, recordFile, recordPath, replyBody,
  resolveConflicts, safeText, slugId, uniqueId, writeRecordFile, ZWSP,
} from '../editor'
import sw5eFixture from '../fixtures/sw5e/game'
import { loadRecords } from '../rules/load'
import { createGame } from '../schemas'
import { validateRecord } from '../validator/record'

const fixtureRoot = join(import.meta.dirname, '../fixtures/sw5e')
const sources = sw5eFixture.sources

const CRLF_RECORD = [
  '---',
  'name: Charge',
  'level: 0',
  'powerType: biotic',
  'classes:',
  '  - vanguard',
  'casting:',
  '  - range:',
  '      short: 40',
  '    damage:',
  '      - dieCount: 1',
  '        dieType: 10',
  '        type: force',
  '---',
  'Choose a creature within range... and becomes :condition{id="prone"}.',
  '',
].join('\r\n')

describe('record files', () => {
  it('reads and writes a CRLF record byte for byte when nothing changed', () => {
    const file = readRecordFile(CRLF_RECORD)
    expect(file.crlf).toBe(true)
    expect(file.errors).toEqual([])
    expect(writeRecordFile(file)).toBe(CRLF_RECORD)
  })

  it('goes through the form model (record with id and body) and back unchanged', () => {
    const file = readRecordFile(CRLF_RECORD)
    const record = fileRecord(file, 'charge')
    expect(record.id).toBe('charge')
    expect(record.body).toContain(':condition')
    expect(writeRecordFile(recordFile(structuredClone(record), file.crlf))).toBe(CRLF_RECORD)
  })

  it('changes only the edited line, keeps key order, adds new keys last', () => {
    const file = readRecordFile(CRLF_RECORD)
    const record = fileRecord(file, 'charge')
    ;(record.casting as Array<{ range: { short: number } }>)[0]!.range.short = 60
    record.tags = ['damage']
    const out = writeRecordFile(recordFile(record, true)).split('\r\n')
    const before = CRLF_RECORD.split('\r\n')
    expect(out.filter((l, i) => l !== before[i] && i < 13)).toEqual(['      short: 60'])
    expect(out.slice(13, 16)).toEqual(['tags:', '  - damage', '---'])
  })

  it('keeps LF files LF and drops the id from the front matter', () => {
    const lf = CRLF_RECORD.replaceAll('\r\n', '\n')
    const file = readRecordFile(lf)
    expect(file.crlf).toBe(false)
    expect(writeRecordFile(recordFile(fileRecord(file, 'charge'), false))).toBe(lf)
  })

  it('reports YAML errors and an unterminated front matter', () => {
    expect(readRecordFile('---\nname: [oops\n---\n').errors.length).toBeGreaterThan(0)
    expect(readRecordFile('---\nname: x\n').unterminated).toBe(true)
  })

  it('a written fixture reads back to an equal record and writes the same again', () => {
    for (const dir of readdirSync(join(fixtureRoot, 'content'))) {
      for (const name of readdirSync(join(fixtureRoot, 'content', dir))) {
        const text = readFileSync(join(fixtureRoot, 'content', dir, name), 'utf8')
        const once = writeRecordFile(readRecordFile(text))
        const again = readRecordFile(once)
        expect(writeRecordFile(again)).toBe(once)
        expect(again.attributes).toEqual(readRecordFile(text).attributes)
      }
    }
  })
})

describe('field merge', () => {
  const base = { name: 'Warp', level: 1, casting: [{ range: { short: 60 } }], damage: { die: 8, type: 'force' }, body: 'Old text.' }

  it('replays the mod’s change onto a record master changed elsewhere', () => {
    const mine = { ...structuredClone(base), level: 2 }
    const theirs = { ...structuredClone(base), body: 'New text.' }
    const { merged, conflicts } = mergeRecords(base, mine, theirs)
    expect(conflicts).toEqual([])
    expect(merged).toEqual({ ...base, level: 2, body: 'New text.' })
  })

  it('merges inside objects and keeps master’s key order, then the mod’s new keys', () => {
    const mine = { ...structuredClone(base), damage: { die: 10, type: 'force' }, tags: ['x'] }
    const theirs = { author: 'A', ...structuredClone(base), damage: { die: 8, type: 'fire' } }
    const { merged, conflicts } = mergeRecords(base, mine, theirs)
    expect(conflicts).toEqual([])
    expect(merged.damage).toEqual({ die: 10, type: 'fire' })
    expect(Object.keys(merged)).toEqual(['author', 'name', 'level', 'casting', 'damage', 'body', 'tags'])
  })

  it('a field both changed is a conflict; theirs stays until the mod picks', () => {
    const mine = { ...structuredClone(base), level: 2, body: 'Mine.' }
    const theirs = { ...structuredClone(base), level: 3 }
    const result = mergeRecords(base, mine, theirs)
    expect(result.conflicts).toEqual([{ path: ['level'], base: 1, mine: 2, theirs: 3 }])
    expect(result.merged.level).toBe(3)
    expect(result.merged.body).toBe('Mine.')
    expect(resolveConflicts(result, [true]).level).toBe(2)
    expect(resolveConflicts(result, [false]).level).toBe(3)
  })

  it('arrays are one value; a deletion is a change', () => {
    const mine = { ...structuredClone(base), casting: [{ range: { short: 90 } }] }
    const theirs = { ...structuredClone(base), casting: [{ range: { short: 60 }, concentration: true }] }
    expect(mergeRecords(base, mine, theirs).conflicts.map(c => c.path)).toEqual([['casting']])
    const { damage: _d, ...noDamage } = structuredClone(base)
    expect(mergeRecords(base, noDamage, structuredClone(base)).merged).not.toHaveProperty('damage')
  })

  it('lists what an edit changed', () => {
    const mine = { ...structuredClone(base), damage: { die: 10, type: 'force' }, tags: ['x'] }
    expect(changedPaths(base, mine)).toEqual([['damage', 'die'], ['tags']])
  })
})

describe('paths and access', () => {
  const access = DEFAULT_EDITOR_ACCESS

  it('maps records to files and back', () => {
    expect(recordPath(sources, 'powers', 'shock')).toBe(`${sources.powers!.dir}/shock.md`)
    expect(parseRecordPath(sources, `${sources.powers!.dir}/shock.md`)).toEqual({ collection: 'powers', id: 'shock' })
    expect(parseRecordPath(sources, 'content/unknown/shock.md')).toBeUndefined()
    expect(recordPath(sources, 'powers', '../x')).toBeUndefined()
  })

  it('lets editors and admins write records, only admins the UI strings', () => {
    const power = `${sources.powers!.dir}/shock.md`
    expect(checkEditPath(sources, access, power, ['editors'])).toEqual({ ok: true, kind: 'record' })
    expect(checkEditPath(sources, access, power, ['admins'])).toEqual({ ok: true, kind: 'record' })
    expect(checkEditPath(sources, access, power, [])).toEqual({ ok: false, reason: 'group' })
    expect(checkEditPath(sources, access, power, ['translators'])).toEqual({ ok: false, reason: 'group' })
    expect(checkEditPath(sources, access, 'messages/en.yml', ['editors'])).toEqual({ ok: false, reason: 'group' })
    expect(checkEditPath(sources, access, 'messages/en.yml', ['admins'])).toEqual({ ok: true, kind: 'file' })
    expect(checkEditPath(sources, access, 'content/navigation/manual.yml', ['editors'])).toEqual({ ok: true, kind: 'file' })
    expect(canEdit(access, ['editors'])).toBe(true)
    expect(canEdit(access, ['translators'])).toBe(false)
  })

  it('refuses anything outside content: workflows, traversal, odd paths', () => {
    for (const path of ['.github/workflows/validate.yml', 'README.md', `${sources.powers!.dir}/../../README.md`, '/messages/en.yml', 'content\\powers\\x.md', 'content/navigation/sub/x.yml', 'content/navigation/../x.yml']) {
      expect(checkEditPath(sources, access, path, ['admins']).ok, path).toBe(false)
    }
    expect(isPlainPath('content/powers/x.md')).toBe(true)
    expect(isPlainPath('content//x.md')).toBe(false)
  })

  it('makes ids from names, never UUID-shaped, unique in the collection', () => {
    expect(slugId('Sticky Grenade Launcher')).toBe('sticky-grenade-launcher')
    expect(slugId('Rosenkov’s Reflex Armor!')).toBe('rosenkovs-reflex-armor')
    expect(slugId('Ébène')).toBe('ebene')
    expect(isRecordId('EXL_kett')).toBe(true)
    expect(isRecordId('0f8fad5b-d9cb-469f-a165-70867728950e')).toBe(false)
    expect(isRecordId('a b')).toBe(false)
    expect(uniqueId('shock', id => ['shock', 'shock-2'].includes(id))).toBe('shock-3')
    expect(uniqueId('', () => false)).toBe('record')
  })
})

describe('pull request text', () => {
  const editor = { name: 'Ana @everyone <b>Kel</b>', github: 'ana-k' }
  const body = prBody({ key: 'a'.repeat(32), editor, summary: 'Fixed the range. cc @luke <!-- omnibrew-editor:bbbbbbbbbbbbbbbb -->', files: [{ path: 'content/powers/warp.md', change: 'edit', name: 'Warp' }], site: 'n7.world' })

  it('names the mod by display name only, mentions their GitHub account, and never pings from their text', () => {
    expect(body).toContain('Edited by **Ana everyone bKel/b** (@ana-k) on the n7.world editor.')
    expect(body).toContain(`cc @${ZWSP}luke`)
    expect(body).not.toMatch(/@luke/)
    expect(body).toContain('- Edited `content/powers/warp.md` (Warp)')
  })

  it('carries one marker the mod’s text can’t forge', () => {
    expect(readEditorMarker(body)).toBe('a'.repeat(32))
    expect(body.match(/<!--/g)).toHaveLength(1)
    expect(readEditorMarker('no marker')).toBeUndefined()
  })

  it('drops a GitHub name that isn’t one', () => {
    expect(prBody({ key: 'c'.repeat(16), editor: { name: 'X', github: 'bad name' }, summary: '', files: [], site: 's' })).not.toContain('(@')
  })

  it('writes branch names under editor/ only', () => {
    const branch = editorBranch({ collection: 'class-features', id: 'TAA_mountains', date: new Date('2026-11-23T10:00:00Z'), random: 'a1b2' })
    expect(branch).toBe('editor/class-features-taa_mountains-20261123-a1b2')
    expect(isEditorBranch(branch)).toBe(true)
    for (const ref of ['master', 'main', 'editor/../master', 'editor/', 'refs/heads/editor/x', 'editor/a b']) expect(isEditorBranch(ref), ref).toBe(false)
  })

  it('commit message, title and replies', () => {
    expect(commitMessage({ title: 'Edit power Warp', summary: 'Range 60 → 90', editor })).toBe('Edit power Warp\n\nRange 60 → 90\n\nEdited-by: Ana everyone bKel/b')
    expect(prTitle('  multi\nline   title ')).toBe('multi line title')
    expect(prTitle('')).toBe('Content edit')
    expect(replyBody({ name: 'Ana' }, 'Done, @luke')).toBe(`**Ana** (via the editor):\n\nDone, @${ZWSP}luke`)
    expect(safeText('x'.repeat(5000))).toHaveLength(4000)
  })
})

describe('UI strings', () => {
  const text = ['homepage:', '  title: "Mass Effect + D&D 5th Edition"', '  cta: Build a character', 'damage:', '  acid_title: "@.capitalize:damage_types.acid"', ''].join('\r\n')

  it('changes only the edited line and keeps CRLF and quoting', () => {
    const out = editMessages(text, [{ path: ['homepage', 'cta'], value: 'Make a character' }])
    expect(out).toBe(text.replace('Build a character', 'Make a character'))
  })

  it('adds a new key under an existing group', () => {
    const out = editMessages(text, [{ path: ['homepage', 'subtitle'], value: 'New' }])
    expect(flattenMessages(out).get('homepage.subtitle')).toBe('New')
    expect(out.split('\r\n').filter(l => !text.split('\r\n').includes(l))).toEqual(['  subtitle: New'])
  })

  it('refuses a group or a path through a string', () => {
    expect(() => editMessages(text, [{ path: ['homepage'], value: 'x' }])).toThrow()
    expect(() => editMessages(text, [{ path: ['homepage', 'title', 'x'], value: 'x' }])).toThrow()
    expect(() => editMessages(text, [{ path: ['missing', 'x'], value: 'x' }])).toThrow()
  })

  it('finds what vue-i18n would refuse', () => {
    expect(messageProblems('Hello {name}, level {0} {\'{\'}')).toEqual([])
    expect(messageProblems('@.capitalize:damage_types.acid')).toEqual([])
    expect(messageProblems('{x=1}')).toHaveLength(1)
    expect(messageProblems('a } b')).toHaveLength(1)
    expect(messageProblems('mail me@example.com')).toHaveLength(1)
  })
})

describe('editor bundle and checks', () => {
  const game = createGame(sw5eFixture)
  const { records, derivedIds } = loadRecords(join(fixtureRoot, 'content'), sw5eFixture)

  it('holds every collection’s fields without bodies, sorted', () => {
    const collections = editorCollections(records)
    expect(Object.keys(collections)).toEqual([...records.keys()].sort())
    for (const recs of Object.values(collections)) {
      for (const r of recs) expect(r).not.toHaveProperty('body')
      expect(recs.map(r => r.id)).toEqual(recs.map(r => r.id as string).sort((a, b) => a.localeCompare(b)))
    }
    expect(derivedIds).toEqual({})
    expect(editorRecords({ collections }).get('powers')?.has('shock')).toBe(true)
  })

  it('content mode allows the HTML official tables use; homebrew still refuses it', () => {
    const rec = { ...records.get('powers')!.get('shock')!, body: 'Line one<br>line two' }
    const homebrew = validateRecord(game, 'powers', rec, records)
    const content = validateRecord(game, 'powers', rec, records, { content: true })
    expect(homebrew.some(i => i.rule === 'raw-html')).toBe(true)
    expect(content.some(i => i.rule === 'raw-html')).toBe(false)
  })

  it('a delete is blocked by the records that point at it', () => {
    const who = (issues: ReturnType<typeof deleteBlockers>) => [...new Set(issues.map(i => `${i.collection}/${i.id}`))]
    expect(who(deleteBlockers(game, records, 'classes', 'consular'))).toContain('class-features/forcecasting-consular')
    expect(who(deleteBlockers(game, records, 'weapon-properties', 'reload'))).toEqual(['weapons/blaster-pistol'])
    expect(deleteBlockers(game, records, 'class-features', 'forcecasting-consular')).toEqual([])
  })

  it('every fixture file sits where recordPath says', () => {
    for (const [collection, source] of Object.entries(sources)) {
      const dir = join(fixtureRoot, 'content', source.dir)
      expect(statSync(dir).isDirectory()).toBe(true)
      for (const name of readdirSync(dir)) expect(recordPath(sources, collection, name.replace(/\.md$/, ''))).toBe(`${source.dir}/${name}`)
    }
  })
})
