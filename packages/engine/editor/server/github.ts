/**
 * The few GitHub REST calls the content editor makes (plan/33 §1.4), as a GitHub App
 * installation on one repository. `fetch` and the token are injected, so tests run it
 * against a fake and the Lambda against api.github.com. No library: about a dozen calls.
 */

export interface GitHubOptions {
  /** `owner/name`. */
  repo: string
  /** An installation access token (cached by the caller). */
  token: () => Promise<string>
  fetch?: typeof fetch
  api?: string
}

export class GitHubError extends Error {
  constructor(readonly status: number, message: string) {
    super(message)
    this.name = 'GitHubError'
  }
}

export interface RepoFile {
  path: string
  /** Blob sha. */
  sha: string
  /** UTF-8 text. */
  text: string
}

export interface PullSummary {
  number: number
  title: string
  html_url: string
  state: 'open' | 'closed'
  draft: boolean
  merged_at: string | null
  updated_at: string
  created_at: string
  body: string | null
  head: { ref: string, sha: string, repo: { full_name: string } | null }
  base: { ref: string }
  node_id: string
}

export interface TreeEntry {
  path: string
  /** File text, or null to delete the path. */
  content: string | null
}

export interface Comment {
  id: number
  body: string
  created_at: string
  user: { login: string, type: string } | null
  html_url: string
  /** Review comments only: the file and line it's on. */
  path?: string
  line?: number | null
}

export interface Review {
  id: number
  state: string
  body: string | null
  submitted_at: string | null
  user: { login: string, type: string } | null
  html_url: string
}

export interface CheckRun {
  name: string
  status: string
  conclusion: string | null
  html_url: string
  output?: { title: string | null, summary: string | null }
}

const decode = (base64: string) => new TextDecoder().decode(Uint8Array.from(atob(base64.replace(/\s/g, '')), c => c.charCodeAt(0)))
const encodePath = (path: string) => path.split('/').map(encodeURIComponent).join('/')

export function createGitHub({ repo, token, fetch: doFetch = fetch, api = 'https://api.github.com' }: GitHubOptions) {
  async function call<T>(method: string, path: string, body?: unknown, ok404 = false): Promise<T | null> {
    const res = await doFetch(`${api}${path}`, {
      method,
      headers: {
        'Accept': 'application/vnd.github+json',
        'Authorization': `Bearer ${await token()}`,
        'User-Agent': 'omnibrew-content-editor',
        'X-GitHub-Api-Version': '2022-11-28',
        ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    })
    if (res.status === 404 && ok404) return null
    if (!res.ok) {
      const text = await res.text().catch(() => '')
      let message = text
      try {
        message = (JSON.parse(text) as { message?: string }).message ?? text
      }
      catch { /* not JSON */ }
      throw new GitHubError(res.status, `GitHub ${method} ${path.split('?')[0]}: ${res.status} ${message}`.slice(0, 500))
    }
    if (res.status === 204) return null
    return await res.json() as T
  }
  const r = `/repos/${repo}`
  const must = <T>(v: T | null, what: string): T => {
    if (v === null) throw new GitHubError(404, `GitHub: ${what} not found`)
    return v
  }

  return {
    repo,

    /** A file's text and blob sha at a ref, or null when it doesn't exist there. */
    async file(path: string, ref: string): Promise<RepoFile | null> {
      const f = await call<{ type: string, sha: string, content?: string, encoding?: string }>('GET', `${r}/contents/${encodePath(path)}?ref=${encodeURIComponent(ref)}`, undefined, true)
      if (!f) return null
      if (f.type !== 'file' || f.encoding !== 'base64' || f.content === undefined) throw new GitHubError(422, `GitHub: ${path} is not a text file`)
      return { path, sha: f.sha, text: decode(f.content) }
    },

    /** The commit sha a branch points at. */
    async branchSha(branch: string): Promise<string> {
      return must(await call<{ object: { sha: string } }>('GET', `${r}/git/ref/heads/${encodePath(branch)}`, undefined, true), `branch ${branch}`).object.sha
    },

    /**
     * One commit on top of `parent` with these files changed (text) or deleted (null), via a
     * tree built on the parent's: GitHub stores the blobs and signs the commit (Verified).
     */
    async commit(parent: string, message: string, entries: TreeEntry[]): Promise<string> {
      const base = must(await call<{ tree: { sha: string } }>('GET', `${r}/git/commits/${parent}`), `commit ${parent}`)
      const tree = must(await call<{ sha: string }>('POST', `${r}/git/trees`, {
        base_tree: base.tree.sha,
        tree: entries.map(e => (e.content === null
          ? { path: e.path, mode: '100644', type: 'blob', sha: null }
          : { path: e.path, mode: '100644', type: 'blob', content: e.content })),
      }), 'tree')
      return must(await call<{ sha: string }>('POST', `${r}/git/commits`, { message, tree: tree.sha, parents: [parent] }), 'commit').sha
    },

    async createBranch(branch: string, sha: string): Promise<void> {
      await call('POST', `${r}/git/refs`, { ref: `refs/heads/${branch}`, sha })
    },

    /** Moves a branch forward (never forced: a branch someone else moved fails). */
    async moveBranch(branch: string, sha: string): Promise<void> {
      await call('PATCH', `${r}/git/refs/heads/${encodePath(branch)}`, { sha, force: false })
    },

    async deleteBranch(branch: string): Promise<void> {
      await call('DELETE', `${r}/git/refs/heads/${encodePath(branch)}`, undefined, true)
    },

    async createPull(input: { title: string, head: string, base: string, body: string, draft: boolean }): Promise<PullSummary> {
      return must(await call<PullSummary>('POST', `${r}/pulls`, input), 'pull request')
    },

    async pull(number: number): Promise<PullSummary | null> {
      return await call<PullSummary>('GET', `${r}/pulls/${number}`, undefined, true)
    },

    async closePull(number: number): Promise<void> {
      await call('PATCH', `${r}/pulls/${number}`, { state: 'closed' })
    },

    /** Pull requests, newest update first (one page of 100). */
    async pulls(state: 'open' | 'closed' | 'all'): Promise<PullSummary[]> {
      return (await call<PullSummary[]>('GET', `${r}/pulls?state=${state}&sort=updated&direction=desc&per_page=100`)) ?? []
    },

    async pullFiles(number: number): Promise<Array<{ filename: string, status: string }>> {
      return (await call<Array<{ filename: string, status: string }>>('GET', `${r}/pulls/${number}/files?per_page=100`)) ?? []
    },

    async issueComments(number: number): Promise<Comment[]> {
      return (await call<Comment[]>('GET', `${r}/issues/${number}/comments?per_page=100`)) ?? []
    },

    async reviewComments(number: number): Promise<Comment[]> {
      return (await call<Comment[]>('GET', `${r}/pulls/${number}/comments?per_page=100`)) ?? []
    },

    async reviews(number: number): Promise<Review[]> {
      return (await call<Review[]>('GET', `${r}/pulls/${number}/reviews?per_page=100`)) ?? []
    },

    async comment(number: number, body: string): Promise<Comment> {
      return must(await call<Comment>('POST', `${r}/issues/${number}/comments`, { body }), 'comment')
    },

    async checkRuns(sha: string): Promise<CheckRun[]> {
      return (await call<{ check_runs: CheckRun[] }>('GET', `${r}/commits/${sha}/check-runs?per_page=100`))?.check_runs ?? []
    },

    /** Marks a draft PR ready for review (GraphQL only). */
    async markReady(nodeId: string): Promise<void> {
      const res = await call<{ errors?: Array<{ message: string }> }>('POST', '/graphql', {
        query: 'mutation($id: ID!) { markPullRequestReadyForReview(input: { pullRequestId: $id }) { pullRequest { isDraft } } }',
        variables: { id: nodeId },
      })
      if (res?.errors?.length) throw new GitHubError(422, `GitHub: ${res.errors[0]!.message}`)
    },
  }
}

export type GitHub = ReturnType<typeof createGitHub>
