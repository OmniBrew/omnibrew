import { createVerify, generateKeyPairSync } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { DEFAULT_EDITOR_ACCESS, readEditorMarker } from '../editor'
import {
  appJwt, createEditorService, createGitHub, editorKey, EditorError, installationToken, readPrivateKey, readSubmitInput,
  type CheckRun, type Comment, type GitHub, type PullSummary, type RepoFile, type TreeEntry,
} from '../editor/server'
import sw5eFixture from '../fixtures/sw5e/game'

const REPO = 'OmniBrew/editor-sandbox'
const sources = sw5eFixture.sources
const POWER = `${sources.powers!.dir}/shock.md`
const OTHER = `${sources.powers!.dir}/force-lightning.md`
const record = (name: string, extra = '') => `---\nname: ${name}\nlevel: 0\n${extra}---\nText.\n`

/** An in-memory repository behind the GitHub client's interface. */
function fakeGitHub() {
  let n = 0
  const sha = () => (++n).toString(16).padStart(40, '0')
  const blobs = new Map<string, string>()
  const commits = new Map<string, { tree: Map<string, string>, parent: string | null, message: string }>()
  const branches = new Map<string, string>()
  const pulls: Array<PullSummary & { from: string }> = []
  const comments = new Map<number, Comment[]>()
  const checks = new Map<string, CheckRun[]>()
  const calls: string[] = []

  const blob = (text: string) => {
    const s = sha()
    blobs.set(s, text)
    return s
  }
  const root = sha()
  commits.set(root, { tree: new Map([[POWER, blob(record('Shock'))], [OTHER, blob(record('Force Lightning'))], ['messages/en.yml', blob('a:\n  b: c\n')]]), parent: null, message: 'init' })
  branches.set('master', root)
  const resolve = (ref: string) => commits.get(ref) ? ref : branches.get(ref)!
  const changed = (a: string, b: string) => {
    const ta = commits.get(a)!.tree
    const tb = commits.get(b)!.tree
    return [...new Set([...ta.keys(), ...tb.keys()])].filter(p => ta.get(p) !== tb.get(p))
  }

  const gh: GitHub = {
    repo: REPO,
    async file(path, ref) {
      const s = commits.get(resolve(ref))?.tree.get(path)
      return s ? { path, sha: s, text: blobs.get(s)! } satisfies RepoFile : null
    },
    async branchSha(branch) {
      return branches.get(branch)!
    },
    async commit(parent, message, entries: TreeEntry[]) {
      calls.push(`commit ${entries.map(e => `${e.path}:${e.content === null ? 'delete' : 'write'}`).join(',')}`)
      const tree = new Map(commits.get(parent)!.tree)
      for (const e of entries) {
        if (e.content === null) tree.delete(e.path)
        else tree.set(e.path, blob(e.content))
      }
      const s = sha()
      commits.set(s, { tree, parent, message })
      return s
    },
    async createBranch(branch, s) {
      calls.push(`branch ${branch}`)
      if (branches.has(branch)) throw new Error('exists')
      branches.set(branch, s)
    },
    async moveBranch(branch, s) {
      calls.push(`move ${branch}`)
      branches.set(branch, s)
    },
    async deleteBranch(branch) {
      calls.push(`delete ${branch}`)
      branches.delete(branch)
    },
    async createPull(input) {
      calls.push(`pull ${input.head} -> ${input.base}`)
      const number = pulls.length + 1
      const p = {
        number, title: input.title, html_url: `https://github.com/${REPO}/pull/${number}`, state: 'open' as const, draft: input.draft, merged_at: null,
        updated_at: `2026-11-24T00:00:0${number}Z`, created_at: '2026-11-24T00:00:00Z', body: input.body, node_id: `PR_${number}`,
        head: { ref: input.head, sha: branches.get(input.head)!, repo: { full_name: REPO } }, base: { ref: input.base }, from: branches.get(input.base)!,
      }
      pulls.push(p)
      return p
    },
    async pull(number) {
      const p = pulls.find(x => x.number === number)
      return p ? { ...p, head: { ...p.head, sha: branches.get(p.head.ref) ?? p.head.sha } } : null
    },
    async closePull(number) {
      pulls.find(x => x.number === number)!.state = 'closed'
    },
    async pulls(state) {
      return pulls.filter(p => state === 'all' || p.state === state).map(p => ({ ...p, head: { ...p.head, sha: branches.get(p.head.ref) ?? p.head.sha } })).reverse()
    },
    async pullFiles(number) {
      const p = pulls.find(x => x.number === number)!
      return changed(p.from, branches.get(p.head.ref) ?? p.head.sha).map(filename => ({ filename, status: 'modified' }))
    },
    async issueComments(number) {
      return comments.get(number) ?? []
    },
    async reviewComments() {
      return [{ id: 9, body: 'Line note', created_at: '2026-11-24T01:00:00Z', user: { login: 'queryluke', type: 'User' }, html_url: 'u', path: POWER, line: 2 }]
    },
    async reviews() {
      return [{ id: 1, state: 'COMMENTED', body: 'Looks good', submitted_at: '2026-11-24T00:30:00Z', user: { login: 'queryluke', type: 'User' }, html_url: 'r' }]
    },
    async comment(number, body) {
      const c = { id: Math.random(), body, created_at: '2026-11-24T02:00:00Z', user: { login: 'omnibrew-editor[bot]', type: 'Bot' }, html_url: `c${number}` }
      comments.set(number, [...(comments.get(number) ?? []), c])
      return c
    },
    async checkRuns(s) {
      return checks.get(s) ?? []
    },
    async markReady(nodeId) {
      calls.push(`ready ${nodeId}`)
      pulls.find(p => p.node_id === nodeId)!.draft = false
    },
  }
  return { gh, branches, pulls, commits, blobs, calls, checks, comments, text: (ref: string, path: string) => blobs.get(commits.get(resolve(ref))!.tree.get(path)!) }
}

const ana = { sub: 'sub-ana', groups: ['editors'], name: 'Ana' }
const ben = { sub: 'sub-ben', groups: ['editors'], name: 'Ben' }
const admin = { sub: 'sub-luke', groups: ['admins'], name: 'Luke' }
const player = { sub: 'sub-pat', groups: [], name: 'Pat' }

function setup() {
  const repo = fakeGitHub()
  const service = createEditorService({
    github: repo.gh, sources, access: DEFAULT_EDITOR_ACCESS, base: 'master', site: 'n7.world', key: editorKey,
    now: () => new Date('2026-11-24T12:00:00Z'), random: () => 'a1b2', dailyLimit: 5,
  })
  return { ...repo, service }
}

describe('editor service', () => {
  it('reads a file at master with its blob sha', async () => {
    const { service } = setup()
    const f = await service.file(ana, { path: POWER })
    expect(f).toMatchObject({ path: POWER, ref: 'master', text: record('Shock'), openEdits: [] })
    expect(f.sha).toMatch(/^[0-9a-f]{40}$/)
  })

  it('opens a PR on an editor/ branch with one commit, never touching master', async () => {
    const { service, branches, calls, pulls, text } = setup()
    const before = branches.get('master')
    const f = await service.file(ana, { path: POWER })
    const result = await service.submit(ana, { files: [{ path: POWER, text: record('Shock', 'tags:\n  - damage\n'), baseSha: f.sha }], title: 'Edit power Shock', summary: 'Added a tag. cc @luke', github: 'ana-k' })
    expect(result).toMatchObject({ status: 'ok', number: 1, branch: 'editor/powers-shock-20261124-a1b2' })
    expect(branches.get('master')).toBe(before)
    expect(calls).toEqual([`commit ${POWER}:write`, 'branch editor/powers-shock-20261124-a1b2', 'pull editor/powers-shock-20261124-a1b2 -> master'])
    expect(text('editor/powers-shock-20261124-a1b2', POWER)).toContain('- damage')
    expect(pulls[0]!.body).toContain('Edited by **Ana** (@ana-k) on the n7.world editor.')
    expect(pulls[0]!.body).not.toContain('@luke')
    expect(readEditorMarker(pulls[0]!.body)).toBe(editorKey('sub-ana'))
    expect(pulls[0]!.body).not.toContain('sub-ana')
  })

  it('refuses non-editors, other paths, and strings for editors (admins only)', async () => {
    const { service } = setup()
    await expect(service.file(player, { path: POWER })).rejects.toThrow(/^forbidden/)
    await expect(service.submit(player, { files: [{ path: POWER, text: record('X'), baseSha: null }], title: 't' })).rejects.toThrow(/^forbidden/)
    await expect(service.submit(ana, { files: [{ path: '.github/workflows/validate.yml', text: 'x: 1\n', baseSha: null }], title: 't' })).rejects.toThrow(/^invalid/)
    await expect(service.submit(ana, { files: [{ path: 'messages/en.yml', text: 'a:\n  b: d\n', baseSha: null }], title: 't' })).rejects.toThrow(/^forbidden/)
    const f = await service.file(admin, { path: 'messages/en.yml' })
    expect(await service.submit(admin, { files: [{ path: 'messages/en.yml', text: 'a:\n  b: d\n', baseSha: f.sha }], title: 'Strings' })).toMatchObject({ status: 'ok', branch: 'editor/messages-en-20261124-a1b2' })
  })

  it('refuses text the site couldn’t read, and deleting what isn’t a record', async () => {
    const { service } = setup()
    const f = await service.file(ana, { path: POWER })
    await expect(service.submit(ana, { files: [{ path: POWER, text: '---\nname: [oops\n---\n', baseSha: f.sha }], title: 't' })).rejects.toThrow(/^invalid/)
    await expect(service.submit(ana, { files: [{ path: POWER, text: '---\nname: x\n', baseSha: f.sha }], title: 't' })).rejects.toThrow(/never closed/)
    await expect(service.submit(admin, { files: [{ path: 'messages/en.yml', text: null, baseSha: f.sha }], title: 't' })).rejects.toThrow(/only records/)
    await expect(service.submit(ana, { files: [{ path: POWER, text: 'x'.repeat(600 * 1024), baseSha: f.sha }], title: 't' })).rejects.toThrow(/larger/)
  })

  it('returns a conflict with the current text when master changed since the file was opened', async () => {
    const { service, gh, branches } = setup()
    const f = await service.file(ana, { path: POWER })
    branches.set('master', await gh.commit(branches.get('master')!, 'someone else', [{ path: POWER, content: record('Shock!') }]))
    const result = await service.submit(ana, { files: [{ path: POWER, text: record('Shock 2'), baseSha: f.sha }], title: 't' })
    expect(result).toMatchObject({ status: 'conflict', files: [{ path: POWER, text: record('Shock!') }] })
    expect(await service.submit(ana, { files: [{ path: `${sources.powers!.dir}/new-one.md`, text: record('New'), baseSha: f.sha }], title: 't' })).toMatchObject({ status: 'conflict', files: [{ sha: null }] })
  })

  it('adds and deletes records in one commit', async () => {
    const { service, calls, text } = setup()
    const other = await service.file(ana, { path: OTHER })
    const added = `${sources.powers!.dir}/new-power.md`
    const result = await service.submit(ana, { files: [{ path: added, text: record('New Power'), baseSha: null }, { path: OTHER, text: null, baseSha: other.sha }], title: 'Add and remove' })
    expect(result.status).toBe('ok')
    expect(calls[0]).toBe(`commit ${added}:write,${OTHER}:delete`)
    const branch = (result as { branch: string }).branch
    expect(text(branch, added)).toBe(record('New Power'))
  })

  it('adds a commit to an open editor PR (any editor), comments, and marks a draft ready', async () => {
    const { service, pulls, calls, comments, text } = setup()
    const f = await service.file(ana, { path: POWER })
    const first = await service.submit(ana, { files: [{ path: POWER, text: record('Shock 2'), baseSha: f.sha }], title: 't', draft: true }) as { number: number, branch: string }
    expect(pulls[0]!.draft).toBe(true)
    const onPr = await service.file(ben, { path: POWER, pr: first.number })
    expect(onPr).toMatchObject({ ref: first.branch, text: record('Shock 2') })
    const second = await service.submit(ben, { files: [{ path: POWER, text: record('Shock 3'), baseSha: onPr.sha }], title: 't', summary: 'Fixed the name', pr: first.number, draft: false })
    expect(second).toMatchObject({ status: 'ok', number: first.number, branch: first.branch })
    expect(text(first.branch, POWER)).toBe(record('Shock 3'))
    expect(calls).toContain(`move ${first.branch}`)
    expect(calls).toContain('ready PR_1')
    expect(comments.get(1)![0]!.body).toContain('**Ben** updated this pull request')
    // a stale base on the PR's branch is a conflict too
    expect((await service.submit(ana, { files: [{ path: POWER, text: record('Shock 4'), baseSha: onPr.sha }], title: 't', pr: first.number })).status).toBe('conflict')
  })

  it('never adds to a PR that isn’t the editor’s, or a closed one', async () => {
    const { service, pulls } = setup()
    const f = await service.file(ana, { path: POWER })
    const first = await service.submit(ana, { files: [{ path: POWER, text: record('S'), baseSha: f.sha }], title: 't' }) as { number: number }
    pulls[0]!.state = 'closed'
    await expect(service.submit(ana, { files: [{ path: POWER, text: record('S2'), baseSha: f.sha }], title: 't', pr: first.number })).rejects.toThrow(/closed/)
    pulls.push({ ...pulls[0]!, number: 2, state: 'open', head: { ...pulls[0]!.head, ref: 'feature/x' } })
    await expect(service.submit(ana, { files: [{ path: POWER, text: record('S2'), baseSha: f.sha }], title: 't', pr: 2 })).rejects.toThrow(/^not-found/)
    pulls.push({ ...pulls[0]!, number: 3, state: 'open', body: 'no marker' })
    await expect(service.comment(ana, { pr: 3, text: 'hi' })).rejects.toThrow(/^not-found/)
  })

  it('lists open edits of a file to other editors', async () => {
    const { service } = setup()
    const f = await service.file(ana, { path: POWER })
    await service.submit(ana, { files: [{ path: POWER, text: record('S'), baseSha: f.sha }], title: 'Ana’s edit' })
    const forBen = await service.file(ben, { path: POWER })
    expect(forBen.openEdits).toEqual([{ number: 1, url: `https://github.com/${REPO}/pull/1`, title: 'Ana’s edit', editor: 'Ana', mine: false, draft: false }])
    expect((await service.file(ana, { path: POWER })).openEdits[0]!.mine).toBe(true)
    expect((await service.file(ben, { path: OTHER })).openEdits).toEqual([])
  })

  it('lists my edits with the validate check, reviews and comments, and only mine', async () => {
    const { service, checks, pulls } = setup()
    const f = await service.file(ana, { path: POWER })
    const mine = await service.submit(ana, { files: [{ path: POWER, text: record('S'), baseSha: f.sha }], title: 'Mine' }) as { commit: string }
    const g = await service.file(ben, { path: OTHER })
    await service.submit(ben, { files: [{ path: OTHER, text: record('O'), baseSha: g.sha }], title: 'Ben’s' })
    checks.set(mine.commit, [{ name: 'validate', status: 'completed', conclusion: 'failure', html_url: 'ci', output: { title: 'x', summary: '1 error' } }])
    await service.comment(ana, { pr: 1, text: 'Thanks @luke' })
    pulls[0]!.merged_at = '2026-11-25T00:00:00Z'
    pulls[0]!.state = 'closed'
    const edits = await service.myEdits(ana)
    expect(edits).toHaveLength(1)
    expect(edits[0]).toMatchObject({ number: 1, title: 'Mine', state: 'merged', files: [POWER], check: { conclusion: 'failure', summary: '1 error' } })
    expect(edits[0]!.reviews).toEqual([{ user: 'queryluke', state: 'COMMENTED', body: 'Looks good', at: '2026-11-24T00:30:00Z', url: 'r' }])
    expect(edits[0]!.comments.map(c => [c.user, c.bot, c.body.split('\n')[0]])).toEqual([['queryluke', false, 'Line note'], ['omnibrew-editor[bot]', true, '**Ana** (via the editor):']])
    expect(edits[0]!.comments[1]!.body).not.toContain('@luke')
  })

  it('limits submits per day', async () => {
    const { service } = setup()
    const f = await service.file(ana, { path: POWER })
    for (let i = 0; i < 5; i++) await service.submit(ana, { files: [{ path: POWER, text: record(`S${i}`), baseSha: f.sha }], title: 't' }).catch(() => {})
    await expect(service.submit(ana, { files: [{ path: POWER, text: record('S'), baseSha: f.sha }], title: 't' })).rejects.toThrow(/^limit/)
  })

  it('reads submit input strictly', () => {
    expect(() => readSubmitInput('{}')).toThrow(EditorError)
    expect(() => readSubmitInput({ files: [{ path: POWER, text: 1, baseSha: null }], title: 't' })).toThrow(/text/)
    expect(() => readSubmitInput({ files: [{ path: POWER, text: 'x', baseSha: 'nope' }], title: 't' })).toThrow(/baseSha/)
    expect(() => readSubmitInput({ files: Array.from({ length: 21 }, () => ({ path: POWER, text: 'x', baseSha: null })), title: 't' })).toThrow(/at most/)
    expect(() => readSubmitInput({ files: [{ path: POWER, text: 'x', baseSha: null }], title: 't', pr: 1.5 })).toThrow(/pr/)
    expect(readSubmitInput(JSON.stringify({ files: [{ path: POWER, text: null, baseSha: 'a'.repeat(40) }], title: 't', draft: true }))).toMatchObject({ draft: true })
  })
})

describe('GitHub client', () => {
  function fakeFetch(responses: Record<string, { status: number, body?: unknown }>) {
    const seen: Array<{ url: string, method: string, headers: Record<string, string>, body?: string }> = []
    const f = (async (url: string, init: RequestInit) => {
      seen.push({ url, method: init.method!, headers: init.headers as Record<string, string>, body: init.body as string | undefined })
      const key = `${init.method} ${url.replace('https://api.github.com', '')}`
      const r = responses[key] ?? { status: 500, body: { message: `no fake for ${key}` } }
      return new Response(r.body === undefined ? null : JSON.stringify(r.body), { status: r.status })
    }) as unknown as typeof fetch
    return { f, seen }
  }

  it('reads a file as UTF-8, and a missing one as null, with the installation token', async () => {
    const text = 'name: Café\n'
    const { f, seen } = fakeFetch({
      [`GET /repos/${REPO}/contents/content/powers/x.md?ref=master`]: { status: 200, body: { type: 'file', sha: 'abc', encoding: 'base64', content: Buffer.from(text).toString('base64').replace(/(.{20})/g, '$1\n') } },
      [`GET /repos/${REPO}/contents/content/powers/y.md?ref=master`]: { status: 404, body: { message: 'Not Found' } },
    })
    const gh = createGitHub({ repo: REPO, token: async () => 'tok', fetch: f })
    expect(await gh.file('content/powers/x.md', 'master')).toEqual({ path: 'content/powers/x.md', sha: 'abc', text })
    expect(await gh.file('content/powers/y.md', 'master')).toBeNull()
    expect(seen[0]!.headers.Authorization).toBe('Bearer tok')
  })

  it('builds a commit from the parent’s tree, writing and deleting paths', async () => {
    const { f, seen } = fakeFetch({
      [`GET /repos/${REPO}/git/commits/p1`]: { status: 200, body: { tree: { sha: 't0' } } },
      [`POST /repos/${REPO}/git/trees`]: { status: 201, body: { sha: 't1' } },
      [`POST /repos/${REPO}/git/commits`]: { status: 201, body: { sha: 'c1' } },
    })
    const gh = createGitHub({ repo: REPO, token: async () => 'tok', fetch: f })
    expect(await gh.commit('p1', 'msg', [{ path: 'a.md', content: 'x' }, { path: 'b.md', content: null }])).toBe('c1')
    expect(JSON.parse(seen[1]!.body!)).toEqual({ base_tree: 't0', tree: [{ path: 'a.md', mode: '100644', type: 'blob', content: 'x' }, { path: 'b.md', mode: '100644', type: 'blob', sha: null }] })
    expect(JSON.parse(seen[2]!.body!)).toEqual({ message: 'msg', tree: 't1', parents: ['p1'] })
  })

  it('moves a branch without forcing, and reports GitHub’s message on failure', async () => {
    const { f, seen } = fakeFetch({ [`PATCH /repos/${REPO}/git/refs/heads/editor/x`]: { status: 422, body: { message: 'Update is not a fast forward' } } })
    const gh = createGitHub({ repo: REPO, token: async () => 'tok', fetch: f })
    await expect(gh.moveBranch('editor/x', 'c2')).rejects.toThrow('422 Update is not a fast forward')
    expect(JSON.parse(seen[0]!.body!)).toEqual({ sha: 'c2', force: false })
  })
})

describe('GitHub App auth', () => {
  const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048, privateKeyEncoding: { type: 'pkcs1', format: 'pem' }, publicKeyEncoding: { type: 'spki', format: 'pem' } })

  it('reads the key as PEM or base64 of it', () => {
    expect(readPrivateKey(privateKey)).toBe(privateKey)
    expect(readPrivateKey(Buffer.from(privateKey).toString('base64'))).toBe(privateKey)
    expect(() => readPrivateKey('not a key')).toThrow()
  })

  it('signs a JWT GitHub accepts: RS256, backdated a minute, 9 minutes long', () => {
    const jwt = appJwt('5906813', privateKey, Date.parse('2026-11-24T12:00:00Z'))
    const [h, p, s] = jwt.split('.')
    expect(JSON.parse(Buffer.from(h!, 'base64url').toString())).toEqual({ alg: 'RS256', typ: 'JWT' })
    const payload = JSON.parse(Buffer.from(p!, 'base64url').toString())
    expect(payload).toEqual({ iss: '5906813', iat: Date.parse('2026-11-24T11:59:00Z') / 1000, exp: Date.parse('2026-11-24T12:08:00Z') / 1000 })
    expect(createVerify('RSA-SHA256').update(`${h}.${p}`).verify(publicKey, Buffer.from(s!, 'base64url'))).toBe(true)
  })

  it('caches the installation token until five minutes before it expires', async () => {
    let t = Date.parse('2026-11-24T12:00:00Z')
    let calls = 0
    const f = (async (url: string, init: RequestInit) => {
      calls++
      expect(url).toBe('https://api.github.com/app/installations/185440511/access_tokens')
      expect((init.headers as Record<string, string>).Authorization).toMatch(/^Bearer ey/)
      return new Response(JSON.stringify({ token: `tok${calls}`, expires_at: new Date(t + 60 * 60_000).toISOString() }), { status: 201 })
    }) as unknown as typeof fetch
    const token = installationToken({ appId: '1', installationId: '185440511', privateKey, fetch: f, now: () => t })
    expect(await token()).toBe('tok1')
    t += 50 * 60_000
    expect(await token()).toBe('tok1')
    t += 6 * 60_000
    expect(await token()).toBe('tok2')
  })

  it('the marker key is a hash, stable per user', () => {
    expect(editorKey('abc')).toMatch(/^[0-9a-f]{32}$/)
    expect(editorKey('abc')).toBe(editorKey('abc'))
    expect(editorKey('abc')).not.toBe(editorKey('abd'))
  })
})
