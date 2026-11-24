import type { CollectionSource } from '../../schemas/game'
import { parseYaml } from '../../content/format'
import { readRecordFile } from '../file'
import { canEdit, checkEditPath, DEFAULT_EDITOR_ACCESS, MAX_FILE_BYTES, parseRecordPath, type EditorAccess } from '../paths'
import { commitMessage, editorBranch, githubUser, isEditorBranch, plainName, prBody, prTitle, readEditorMarker, replyBody, safeText, type FileChange, type PrFile } from '../pr'
import type { GitHub, PullSummary } from './github'

/**
 * What the `content-editor` Lambda does (plan/33 §1.4), independent of AWS: read a file,
 * open or update an editor pull request, list a mod's edits with their checks and comments,
 * reply. Every call checks the caller's groups and the paths again (the AppSync rule is the
 * first gate); it writes only `editor/…` branches, never merges, never touches the base branch.
 */

export interface EditorCaller {
  sub: string
  groups: readonly string[]
  /** Display name (the site profile's), shown on the PR. */
  name: string
}

export interface EditorServiceOptions {
  github: GitHub
  sources: Record<string, CollectionSource>
  access?: EditorAccess
  /** The branch PRs target (`master`). */
  base: string
  /** The site named in PR bodies (`n7.world`). */
  site: string
  /** The marker key of a caller (a hash of the sub). */
  key: (sub: string) => string
  now?: () => Date
  random?: () => string
  /** Submits per caller per day (an in-memory guard against a runaway loop). */
  dailyLimit?: number
  /** How many of a caller's PRs `myEdits` details. */
  editsLimit?: number
}

export type EditorErrorCode = 'forbidden' | 'invalid' | 'not-found' | 'limit'

export class EditorError extends Error {
  constructor(readonly code: EditorErrorCode, message: string) {
    super(`${code}: ${message}`)
    this.name = 'EditorError'
  }
}

export interface SubmitFile {
  path: string
  /** The new text, or null to delete the file. */
  text: string | null
  /** The blob sha the edit started from; null for a new file. */
  baseSha: string | null
}

export interface SubmitInput {
  files: SubmitFile[]
  title: string
  summary?: string
  /** Open as a draft PR (or keep one a draft); false marks a draft ready. */
  draft?: boolean
  /** Add a commit to this editor PR instead of opening one. */
  pr?: number
  /** The mod's GitHub username, @mentioned in a new PR's body. */
  github?: string
}

export type SubmitResult =
  | { status: 'ok', number: number, url: string, branch: string, commit: string }
  /** The files changed since the mod opened them: their current text, to merge (plan/33 §1.7). */
  | { status: 'conflict', files: Array<{ path: string, sha: string | null, text: string | null }> }

export interface OpenEdit {
  number: number
  url: string
  title: string
  editor: string | null
  mine: boolean
  draft: boolean
}

export interface FileResult {
  path: string
  /** The branch read: the base branch, or the PR's branch. */
  ref: string
  /** The commit read. */
  commit: string
  /** Null when the file doesn't exist there. */
  sha: string | null
  text: string | null
  /** Other open editor PRs that change this file. */
  openEdits: OpenEdit[]
}

export interface EditSummary {
  number: number
  title: string
  url: string
  state: 'open' | 'closed' | 'merged'
  draft: boolean
  branch: string
  createdAt: string
  updatedAt: string
  files: string[]
  check: { name: string, status: string, conclusion: string | null, url: string, summary: string | null } | null
  reviews: Array<{ user: string | null, state: string, body: string, at: string | null, url: string }>
  comments: Array<{ user: string | null, bot: boolean, body: string, at: string, url: string, path?: string, line?: number | null }>
}

const MAX_FILES = 20
const VALIDATE_CHECK = 'validate'
const EDITED_BY = /Edited by \*\*([^*]+)\*\*/

/** Reads the submit input sent as JSON from the browser; anything off is `invalid`. */
export function readSubmitInput(raw: unknown): SubmitInput {
  const bad = (m: string): never => {
    throw new EditorError('invalid', m)
  }
  const o = (typeof raw === 'string' ? JSON.parse(raw) : raw) as Record<string, unknown> | null
  if (!o || typeof o !== 'object') bad('no input')
  const files = o!.files
  if (!Array.isArray(files) || !files.length) bad('no files')
  if ((files as unknown[]).length > MAX_FILES) bad(`at most ${MAX_FILES} files`)
  const out: SubmitFile[] = (files as unknown[]).map((f) => {
    const x = f as Record<string, unknown>
    if (typeof x?.path !== 'string') bad('a file without a path')
    if (x.text !== null && typeof x.text !== 'string') bad(`${x.path}: text must be a string or null`)
    if (x.baseSha !== null && (typeof x.baseSha !== 'string' || !/^[0-9a-f]{40}$/.test(x.baseSha))) bad(`${x.path}: baseSha must be a blob sha or null`)
    return { path: x.path as string, text: x.text as string | null, baseSha: x.baseSha as string | null }
  })
  if (typeof o!.title !== 'string') bad('no title')
  const pr = o!.pr
  if (pr !== undefined && pr !== null && (typeof pr !== 'number' || !Number.isInteger(pr) || pr < 1)) bad('pr must be a number')
  return {
    files: out,
    title: o!.title as string,
    summary: typeof o!.summary === 'string' ? o!.summary : undefined,
    draft: typeof o!.draft === 'boolean' ? o!.draft : undefined,
    pr: typeof pr === 'number' ? pr : undefined,
    github: typeof o!.github === 'string' ? o!.github : undefined,
  }
}

export function createEditorService(options: EditorServiceOptions) {
  const { github, sources, base, site, key } = options
  const access = options.access ?? DEFAULT_EDITOR_ACCESS
  const now = options.now ?? (() => new Date())
  const random = options.random ?? (() => Math.random().toString(16).slice(2, 6))
  const dailyLimit = options.dailyLimit ?? 50
  const editsLimit = options.editsLimit ?? 20
  const submits = new Map<string, number[]>()

  const requireEditor = (caller: EditorCaller) => {
    if (!canEdit(access, caller.groups)) throw new EditorError('forbidden', 'only editors may use the content editor')
  }
  const requirePath = (caller: EditorCaller, path: string) => {
    const check = checkEditPath(sources, access, path, caller.groups)
    if (!check.ok) throw new EditorError(check.reason === 'group' ? 'forbidden' : 'invalid', check.reason === 'group' ? `${path}: not yours to edit` : `${path}: not a file the editor writes`)
    return check.kind
  }
  /** An open-or-closed PR the editor made on this repo (any editor may add to one, plan/33 decision 10). */
  const isEditorPull = (p: PullSummary) => isEditorBranch(p.head.ref) && p.head.repo?.full_name === github.repo && p.base.ref === base && readEditorMarker(p.body) !== undefined
  const editorPull = async (number: number) => {
    const p = await github.pull(number)
    if (!p || !isEditorPull(p)) throw new EditorError('not-found', `#${number} is not a pull request made with the editor`)
    return p
  }
  const editorName = (p: PullSummary) => p.body?.match(EDITED_BY)?.[1] ?? null

  async function openEditsOf(path: string, caller: EditorCaller): Promise<OpenEdit[]> {
    const open = (await github.pulls('open')).filter(isEditorPull)
    const out: OpenEdit[] = []
    for (const p of open) {
      if ((await github.pullFiles(p.number)).some(f => f.filename === path)) {
        out.push({ number: p.number, url: p.html_url, title: p.title, editor: editorName(p), mine: readEditorMarker(p.body) === key(caller.sub), draft: p.draft })
      }
    }
    return out
  }

  /** The new text must be a file the site can read: record front matter parses, YAML parses. */
  function checkText(path: string, kind: 'record' | 'file', text: string) {
    if (new TextEncoder().encode(text).length > MAX_FILE_BYTES) throw new EditorError('invalid', `${path}: larger than ${MAX_FILE_BYTES / 1024} KB`)
    if (text.includes('\0')) throw new EditorError('invalid', `${path}: not text`)
    if (kind === 'record') {
      const file = readRecordFile(text)
      if (file.unterminated || file.errors.length) throw new EditorError('invalid', `${path}: ${file.errors[0] ?? 'the front matter is never closed'}`)
    }
    else if (parseYaml(text).errors.length) throw new EditorError('invalid', `${path}: ${parseYaml(text).errors[0]}`)
  }

  function countSubmit(caller: EditorCaller) {
    const day = now().getTime() - 24 * 60 * 60_000
    const recent = (submits.get(caller.sub) ?? []).filter(t => t > day)
    if (recent.length >= dailyLimit) throw new EditorError('limit', `at most ${dailyLimit} submits a day`)
    recent.push(now().getTime())
    submits.set(caller.sub, recent)
  }

  return {
    /** A file at the base branch, or at an editor PR's branch, with the other open edits of it. */
    async file(caller: EditorCaller, input: { path: string, pr?: number | null }): Promise<FileResult> {
      requireEditor(caller)
      requirePath(caller, input.path)
      let ref = base
      let commit: string
      if (input.pr) {
        const p = await editorPull(input.pr)
        ref = p.head.ref
        commit = p.head.sha
      }
      else commit = await github.branchSha(base)
      const file = await github.file(input.path, commit)
      const openEdits = (await openEditsOf(input.path, caller)).filter(e => e.number !== input.pr)
      return { path: input.path, ref, commit, sha: file?.sha ?? null, text: file?.text ?? null, openEdits }
    },

    /** Opens an editor PR, or adds a commit to one. Refuses files that changed since `baseSha`. */
    async submit(caller: EditorCaller, raw: unknown): Promise<SubmitResult> {
      requireEditor(caller)
      const input = readSubmitInput(raw)
      const seen = new Set<string>()
      input.files.forEach((f) => {
        if (seen.has(f.path)) throw new EditorError('invalid', `${f.path} is listed twice`)
        seen.add(f.path)
        const kind = requirePath(caller, f.path)
        if (f.text === null) {
          if (kind !== 'record') throw new EditorError('invalid', `${f.path}: only records can be deleted`)
          if (f.baseSha === null) throw new EditorError('invalid', `${f.path}: nothing to delete`)
        }
        else checkText(f.path, kind, f.text)
      })
      countSubmit(caller)

      const pull = input.pr ? await editorPull(input.pr) : null
      if (pull && pull.state !== 'open') throw new EditorError('invalid', `#${pull.number} is ${pull.merged_at ? 'merged' : 'closed'}`)
      const parent = pull ? pull.head.sha : await github.branchSha(base)

      const conflicts: Array<{ path: string, sha: string | null, text: string | null }> = []
      for (const f of input.files) {
        const current = await github.file(f.path, parent)
        if ((current?.sha ?? null) !== f.baseSha) conflicts.push({ path: f.path, sha: current?.sha ?? null, text: current?.text ?? null })
      }
      if (conflicts.length) return { status: 'conflict', files: conflicts }

      const editor = { name: caller.name, github: githubUser(input.github) }
      const prFiles: PrFile[] = input.files.map((f) => {
        const change: FileChange = f.text === null ? 'delete' : f.baseSha === null ? 'add' : 'edit'
        const attrs = f.text !== null && parseRecordPath(sources, f.path) ? readRecordFile(f.text).attributes : {}
        const name = typeof attrs.name === 'string' ? attrs.name : typeof attrs.title === 'string' ? attrs.title : undefined
        return { path: f.path, change, ...(name ? { name } : {}) }
      })
      const commit = await github.commit(parent, commitMessage({ title: input.title, summary: input.summary, editor }), input.files.map(f => ({ path: f.path, content: f.text })))

      if (pull) {
        await github.moveBranch(pull.head.ref, commit)
        const summary = input.summary ? safeText(input.summary) : ''
        await github.comment(pull.number, `**${plainName(caller.name)}** updated this pull request (${prFiles.map(f => `\`${f.path}\``).join(', ')}).${summary ? `\n\n${summary}` : ''}`)
        if (input.draft === false && pull.draft) await github.markReady(pull.node_id)
        return { status: 'ok', number: pull.number, url: pull.html_url, branch: pull.head.ref, commit }
      }

      // Named after the first record, else the first file (`messages-en`, `navigation-manual`).
      const first = input.files.map(f => parseRecordPath(sources, f.path)).find(Boolean)
      const parts = input.files[0]!.path.split('/')
      const branch = editorBranch({
        collection: first?.collection ?? parts[parts.length - 2] ?? 'site',
        id: first?.id ?? parts[parts.length - 1]!.replace(/\.\w+$/, ''),
        date: now(),
        random: random(),
      })
      await github.createBranch(branch, commit)
      try {
        const created = await github.createPull({
          title: prTitle(input.title),
          head: branch,
          base,
          body: prBody({ key: key(caller.sub), editor, summary: input.summary ?? '', files: prFiles, site }),
          draft: input.draft ?? false,
        })
        return { status: 'ok', number: created.number, url: created.html_url, branch, commit }
      }
      catch (e) {
        await github.deleteBranch(branch)
        throw e
      }
    },

    /** The caller's editor PRs, newest first, with the validate check, reviews and comments. */
    async myEdits(caller: EditorCaller): Promise<EditSummary[]> {
      requireEditor(caller)
      const mine = (await github.pulls('all')).filter(p => isEditorPull(p) && readEditorMarker(p.body) === key(caller.sub)).slice(0, editsLimit)
      return Promise.all(mine.map(async (p): Promise<EditSummary> => {
        const [files, runs, reviews, comments, lineComments] = await Promise.all([
          github.pullFiles(p.number), github.checkRuns(p.head.sha), github.reviews(p.number), github.issueComments(p.number), github.reviewComments(p.number),
        ])
        const run = runs.find(r => r.name === VALIDATE_CHECK)
        return {
          number: p.number,
          title: p.title,
          url: p.html_url,
          state: p.merged_at ? 'merged' : p.state,
          draft: p.draft,
          branch: p.head.ref,
          createdAt: p.created_at,
          updatedAt: p.updated_at,
          files: files.map(f => f.filename),
          check: run ? { name: run.name, status: run.status, conclusion: run.conclusion, url: run.html_url, summary: run.output?.summary ?? null } : null,
          reviews: reviews.filter(r => r.state !== 'PENDING').map(r => ({ user: r.user?.login ?? null, state: r.state, body: r.body ?? '', at: r.submitted_at, url: r.html_url })),
          comments: [...comments, ...lineComments]
            .map(c => ({ user: c.user?.login ?? null, bot: c.user?.type === 'Bot', body: c.body, at: c.created_at, url: c.html_url, ...(c.path ? { path: c.path, line: c.line ?? null } : {}) }))
            .sort((a, b) => a.at.localeCompare(b.at)),
        }
      }))
    },

    /** A reply on an editor PR, posted by the App in the caller's name. */
    async comment(caller: EditorCaller, input: { pr: number, text: string }) {
      requireEditor(caller)
      if (typeof input.text !== 'string' || !input.text.trim()) throw new EditorError('invalid', 'an empty reply')
      const p = await editorPull(input.pr)
      const c = await github.comment(p.number, replyBody({ name: caller.name }, input.text))
      return { url: c.html_url }
    },
  }
}

export type EditorService = ReturnType<typeof createEditorService>
