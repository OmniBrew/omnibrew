import type { CollectionSource } from '../schemas/game'

/**
 * Which files of a content repo the editor writes, and who may (plan/33 §1.4, §1.9). The
 * browser uses it to show or hide pages; the server checks it again before every commit.
 * Records are `<source dir>/<id>.md` of a collection the game defines; other files are
 * listed with their own groups (ME: navigation for every editor, UI strings for admins).
 */
export interface EditorAccess {
  /** Cognito groups that may edit records. */
  editors: string[]
  /** Other files: an exact path, or a folder ending in `/*.<ext>` (one level). */
  files: Array<{ path: string, groups: string[] }>
}

export const DEFAULT_EDITOR_ACCESS: EditorAccess = {
  editors: ['editors', 'admins'],
  files: [
    { path: 'content/navigation/*.yml', groups: ['editors', 'admins'] },
    { path: 'messages/en.yml', groups: ['admins'] },
  ],
}

/** Largest file the editor writes (the biggest content file is about 60 KB). */
export const MAX_FILE_BYTES = 512 * 1024

type Sources = Record<string, CollectionSource>

/** Ids the editor creates: letters, digits, `-` and `_` (content ids such as `EXL_kett` keep their case). */
const ID = /^[a-z0-9][\w-]*$/i
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** A content id the editor may write: the file-name characters content uses, never UUID-shaped (B117). */
export const isRecordId = (id: string) => id.length <= 80 && ID.test(id) && !UUID.test(id)

/** A new record's id from its name: lower case, words joined by `-` ("Sticky Grenade" → `sticky-grenade`). */
export function slugId(name: string): string {
  return name
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
    .replace(/-+$/, '')
}

/** `base`, or `base-2`, `base-3`… when taken. */
export function uniqueId(base: string, taken: (id: string) => boolean): string {
  const start = base || 'record'
  if (!taken(start)) return start
  for (let n = 2; ; n++) if (!taken(`${start}-${n}`)) return `${start}-${n}`
}

/** `content/powers/warp.md` for a collection and id. */
export function recordPath(sources: Sources, collection: string, id: string): string | undefined {
  const source = sources[collection]
  return source && isRecordId(id) ? `${source.dir}/${id}.md` : undefined
}

/** The collection and id of a record file, or undefined for any other path. */
export function parseRecordPath(sources: Sources, path: string): { collection: string, id: string } | undefined {
  const m = path.match(/^(.+)\/([^/]+)\.md$/)
  if (!m) return undefined
  const collection = Object.keys(sources).find(c => sources[c]!.dir === m[1])
  return collection && isRecordId(m[2]!) ? { collection, id: m[2]! } : undefined
}

/** A plain repo-relative path: no `..`, no leading or doubled slash, no backslash, no control characters. */
export function isPlainPath(path: string): boolean {
  return path.length > 0
    && path.length <= 200
    && !path.startsWith('/')
    && ![...path].some(c => c === '\\' || c.charCodeAt(0) < 32)
    && path.split('/').every(part => part !== '' && part !== '.' && part !== '..')
}

function matches(pattern: string, path: string) {
  const star = pattern.match(/^(.*\/)\*(\.[a-z]+)$/)
  if (!star) return pattern === path
  const rest = path.slice(star[1]!.length)
  return path.startsWith(star[1]!) && rest.endsWith(star[2]!) && !rest.includes('/') && isRecordId(rest.slice(0, -star[2]!.length))
}

export type PathCheck = { ok: true, kind: 'record' | 'file' } | { ok: false, reason: 'path' | 'group' }

/** May someone in `groups` write `path`? */
export function checkEditPath(sources: Sources, access: EditorAccess, path: string, groups: readonly string[]): PathCheck {
  if (!isPlainPath(path)) return { ok: false, reason: 'path' }
  const inGroup = (allowed: string[]) => allowed.some(g => groups.includes(g))
  if (parseRecordPath(sources, path)) return inGroup(access.editors) ? { ok: true, kind: 'record' } : { ok: false, reason: 'group' }
  const file = access.files.find(f => matches(f.path, path))
  if (!file) return { ok: false, reason: 'path' }
  return inGroup(file.groups) ? { ok: true, kind: 'file' } : { ok: false, reason: 'group' }
}

/** May someone in `groups` use the editor at all? */
export const canEdit = (access: EditorAccess, groups: readonly string[]) => access.editors.some(g => groups.includes(g))
