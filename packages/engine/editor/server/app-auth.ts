import { createHash, createPrivateKey, createSign } from 'node:crypto'

/**
 * GitHub App authentication (plan/33 §1.4), Node only: a JWT signed with the App's private
 * key (RS256, 9 minutes, backdated a minute for clock drift) is exchanged for an
 * installation token, which lasts an hour and is cached until five minutes before then.
 */

const b64url = (data: string | Buffer) => Buffer.from(data).toString('base64url')

/**
 * The private key from its secret: the `.pem` text, or the same base64-encoded on one line
 * (how it's stored as an Amplify secret).
 */
export function readPrivateKey(secret: string): string {
  const text = secret.includes('-----BEGIN') ? secret : Buffer.from(secret.trim(), 'base64').toString('utf8')
  if (!text.includes('-----BEGIN')) throw new Error('GitHub App private key: not a PEM, nor base64 of one')
  createPrivateKey(text) // throws when it isn't a usable key
  return text
}

/** The App's JWT. `now` in milliseconds. */
export function appJwt(appId: string, privateKey: string, now = Date.now()): string {
  const iat = Math.floor(now / 1000) - 60
  const header = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))
  const payload = b64url(JSON.stringify({ iat, exp: iat + 9 * 60, iss: appId }))
  const signature = createSign('RSA-SHA256').update(`${header}.${payload}`).sign(privateKey)
  return `${header}.${payload}.${b64url(signature)}`
}

export interface InstallationAuth {
  appId: string
  installationId: string
  privateKey: string
  fetch?: typeof fetch
  api?: string
  now?: () => number
}

/** A function returning a current installation token, fetching a new one only when needed. */
export function installationToken({ appId, installationId, privateKey, fetch: doFetch = fetch, api = 'https://api.github.com', now = Date.now }: InstallationAuth) {
  let cached: { token: string, expires: number } | undefined
  return async (): Promise<string> => {
    if (cached && cached.expires - 5 * 60_000 > now()) return cached.token
    const res = await doFetch(`${api}/app/installations/${installationId}/access_tokens`, {
      method: 'POST',
      headers: {
        'Accept': 'application/vnd.github+json',
        'Authorization': `Bearer ${appJwt(appId, privateKey, now())}`,
        'User-Agent': 'omnibrew-content-editor',
        'X-GitHub-Api-Version': '2022-11-28',
      },
    })
    if (!res.ok) throw new Error(`GitHub App token: ${res.status} ${(await res.text().catch(() => '')).slice(0, 200)}`)
    const body = await res.json() as { token: string, expires_at: string }
    cached = { token: body.token, expires: Date.parse(body.expires_at) }
    return body.token
  }
}

/** The key "My edits" finds a mod's PRs by: a hash of their Cognito sub, never the sub itself. */
export const editorKey = (sub: string) => createHash('sha256').update(`omnibrew-editor:${sub}`).digest('hex').slice(0, 32)
