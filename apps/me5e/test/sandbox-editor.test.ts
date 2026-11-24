import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import type { Schema } from '@omnibrew/backend'
import { createUserData, type DataSession, type UserData } from '@omnibrew/engine/data'
import { readEditorMarker } from '@omnibrew/engine/editor'
import { Amplify } from 'aws-amplify'
import { fetchAuthSession, getCurrentUser, signIn, signOut } from 'aws-amplify/auth'
import { generateClient } from 'aws-amplify/data'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { EDITOR_GITHUB } from '../amplify/functions/content-editor/github'
import { meCharacter } from '../game/character'

/**
 * The content editor against a deployed sandbox (plan/33 piece 2): the dev pool's test
 * accounts and the test repository OmniBrew/editor-sandbox, never the content repo. Local
 * only and opt-in:
 *
 *   SANDBOX_TEST=1 corepack pnpm vitest run apps/me5e/test/sandbox-editor.test.ts
 *
 * Test account 1 must be in the dev pool's `editors` group, account 2 in no group. The
 * sandbox needs the App's key (`ampx sandbox secret set GITHUB_APP_PRIVATE_KEY`). `gh`
 * (signed in) checks the pull requests on GitHub and closes them, branches deleted, at the end.
 */
const outputsFile = fileURLToPath(new URL('../amplify_outputs.json', import.meta.url))
const envFile = fileURLToPath(new URL('../.env', import.meta.url))
if (process.env.SANDBOX_TEST && existsSync(envFile)) process.loadEnvFile(envFile)
const enabled = Boolean(process.env.SANDBOX_TEST && existsSync(outputsFile) && process.env.SANDBOX_TEST_EMAIL && process.env.SANDBOX_TEST_EMAIL_2)

const REPO = EDITOR_GITHUB.repo.dev
const PATH = 'content/powers/warp.md'
const gh = <T>(...args: string[]) => JSON.parse(execFileSync('gh', ['api', ...args], { encoding: 'utf8' })) as T

let session: DataSession | null = null
let data: UserData

async function as(user: 1 | 2 | null) {
  await signOut()
  session = null
  if (!user) return
  const suffix = user === 1 ? '' : '_2'
  const { nextStep } = await signIn({ username: process.env[`SANDBOX_TEST_EMAIL${suffix}`]!, password: process.env[`SANDBOX_TEST_PASSWORD${suffix}`]! })
  expect(nextStep.signInStep).toBe('DONE')
  const current = await getCurrentUser()
  await fetchAuthSession({ forceRefresh: true })
  session = { sub: current.userId, username: current.username }
}

// Each call is several GitHub requests behind AppSync and a Lambda (a cold start reads the secret).
describe.skipIf(!enabled)('content editor on the sandbox', { timeout: 60_000 }, () => {
  const opened: Array<{ number: number, branch: string }> = []
  let masterBefore: string

  beforeAll(() => {
    Amplify.configure(JSON.parse(readFileSync(outputsFile, 'utf8')))
    data = createUserData({ client: generateClient<Schema>(), game: { id: 'me5e', character: meCharacter }, session: () => session })
    masterBefore = gh<{ object: { sha: string } }>(`repos/${REPO}/git/ref/heads/master`).object.sha
    // Pull requests a failed run left open on the test repo.
    for (const p of gh<Array<{ number: number, head: { ref: string } }>>(`repos/${REPO}/pulls?state=open`)) {
      if (p.head.ref.startsWith('editor/')) opened.push({ number: p.number, branch: p.head.ref })
    }
    closeAll()
  })

  function closeAll() {
    for (const { number, branch } of opened.splice(0)) {
      try {
        execFileSync('gh', ['api', '-X', 'PATCH', `repos/${REPO}/pulls/${number}`, '-f', 'state=closed'], { stdio: 'ignore' })
        execFileSync('gh', ['api', '-X', 'DELETE', `repos/${REPO}/git/refs/heads/${branch}`], { stdio: 'ignore' })
      }
      catch { /* already gone */ }
    }
  }

  afterAll(async () => {
    if (!enabled) return
    closeAll()
    await as(null)
  })

  it('refuses a signed-in player outside the editors group', async () => {
    await as(2)
    await expect(data.editor.file(PATH)).rejects.toThrow(/Not Authorized|forbidden/)
    await expect(data.editor.submit({ files: [{ path: PATH, text: '---\nname: x\n---\n', baseSha: null }], title: 'nope' })).rejects.toThrow(/Not Authorized|forbidden/)
  })

  it('an editor reads a file, opens a PR on an editor/ branch, and master stays as it was', async () => {
    await as(1)
    const file = await data.editor.file(PATH)
    expect(file.text).toContain('name: Warp')
    expect(file.sha).toMatch(/^[0-9a-f]{40}$/)
    const text = `${file.text!.trimEnd()}\n\nAdded by the sandbox test.\n`
    const result = await data.editor.submit({ files: [{ path: PATH, text, baseSha: file.sha }], title: 'Sandbox test: edit Warp', summary: 'Opened by the sandbox test. cc @queryluke', draft: true })
    if (result.status === 'ok') opened.push({ number: result.number, branch: result.branch })
    expect(result.status).toBe('ok')
    if (result.status !== 'ok') return
    expect(result.branch).toMatch(/^editor\/powers-warp-\d{8}-[0-9a-f]+$/)

    const pr = gh<{ draft: boolean, base: { ref: string }, head: { ref: string }, body: string, user: { login: string, type: string } }>(`repos/${REPO}/pulls/${result.number}`)
    expect(pr).toMatchObject({ draft: true, base: { ref: 'master' }, head: { ref: result.branch }, user: { type: 'Bot' } })
    expect(readEditorMarker(pr.body)).toMatch(/^[0-9a-f]{32}$/)
    expect(pr.body).not.toContain('@queryluke')
    expect(pr.body).not.toContain(session!.sub)
    const commit = gh<{ commit: { verification: { verified: boolean }, message: string } }>(`repos/${REPO}/commits/${result.commit}`)
    expect(commit.commit.message).toMatch(/Edited-by: /)
    expect(commit.commit.verification.verified).toBe(true)
    expect(gh<{ object: { sha: string } }>(`repos/${REPO}/git/ref/heads/master`).object.sha).toBe(masterBefore)
  })

  it('reads the file from the PR, refuses a stale edit, and adds a commit to the PR', async () => {
    const { number } = opened[0]!
    const onPr = await data.editor.file(PATH, number)
    expect(onPr.text).toContain('Added by the sandbox test.')
    const master = await data.editor.file(PATH)
    const stale = await data.editor.submit({ files: [{ path: PATH, text: `${onPr.text}\nMore.\n`, baseSha: master.sha }], title: 't', pr: number })
    expect(stale).toMatchObject({ status: 'conflict', files: [{ path: PATH, sha: onPr.sha }] })
    const again = await data.editor.submit({ files: [{ path: PATH, text: `${onPr.text!.trimEnd()}\n\nMore text from the sandbox test.\n`, baseSha: onPr.sha }], title: 't', summary: 'Second commit', pr: number, draft: false })
    expect(again).toMatchObject({ status: 'ok', number })
    expect(gh<{ draft: boolean }>(`repos/${REPO}/pulls/${number}`).draft).toBe(false)
  })

  it('replies, and lists the PR in My edits with its comments', async () => {
    const { number } = opened[0]!
    await data.editor.comment(number, 'A reply from the sandbox test.')
    const edits = await data.editor.myEdits()
    const mine = edits.find(e => e.number === number)!
    expect(mine).toMatchObject({ state: 'open', files: [PATH] })
    expect(mine.comments.some(c => c.bot && c.body.includes('A reply from the sandbox test.'))).toBe(true)
    expect(mine.comments.some(c => c.body.includes('updated this pull request'))).toBe(true)
  })

  it('UI strings are for admins only', async () => {
    await expect(data.editor.file('messages/en.yml')).rejects.toThrow(/forbidden/)
  })
})
