/**
 * The text of an editor pull request (plan/33 §1.3): branch name, commit message, PR body
 * and comment replies. Commits and PRs are by the GitHub App; the mod is named by display
 * name only (the repo is public: no email, no Cognito username), and a hidden marker with a
 * key derived from their account lets "My edits" find their PRs. Mod-written text never
 * pings anyone (`@` is broken) and can't forge a marker (HTML comments are removed).
 */

export type FileChange = 'edit' | 'add' | 'delete'

export interface PrFile {
  path: string
  change: FileChange
  /** The record's display name, when it has one. */
  name?: string
}

export interface PrEditor {
  /** Display name from the site profile. */
  name: string
  /** GitHub username the mod chose to give, @mentioned so GitHub notifies them. */
  github?: string
}

/** A zero-width space: breaks an @mention without changing what readers see. */
export const ZWSP = String.fromCharCode(0x200B)

const MARKER = /<!-- omnibrew-editor:([a-f0-9]{16,64}) -->/

/** The branch prefix the server may write; everything else (`master` included) is refused. */
export const EDITOR_BRANCH_PREFIX = 'editor/'

const refPart = (s: string) => s.toLowerCase().replace(/[^a-z0-9_-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 50) || 'edit'

/** `editor/powers-warp-20261123-a1b2`. `random` is a few hex characters. */
export function editorBranch(input: { collection: string, id: string, date: Date, random: string }): string {
  const day = input.date.toISOString().slice(0, 10).replaceAll('-', '')
  return `${EDITOR_BRANCH_PREFIX}${refPart(`${input.collection}-${input.id}`)}-${day}-${refPart(input.random).slice(0, 8)}`
}

/** A branch the server may write: under `editor/`, plain characters only. */
export const isEditorBranch = (ref: string) => /^editor\/[a-z0-9][a-z0-9_-]*$/.test(ref) && ref.length <= 100

/** One line, no markdown that links, mentions or hides text. */
export function plainName(name: string): string {
  return name.replace(/[\r\n\t]+/g, ' ').replace(/[`*_[\]()<>@#|\\~!]/g, '').replace(/\s+/g, ' ').trim().slice(0, 40) || 'An editor'
}

/** A GitHub username, or undefined when it isn't one. */
export const githubUser = (name?: string) => (name && /^[a-z0-9](?:[a-z0-9]|-(?=[a-z0-9])){0,38}$/i.test(name) ? name : undefined)

/** Mod-written markdown made safe for a PR: no mentions, no HTML comments, bounded length. */
export function safeText(text: string, max = 4000): string {
  return text
    .replace(/\r\n?/g, '\n')
    .replace(/<!--|-->/g, '')
    .replace(/@(?=[a-z0-9])/gi, `@${ZWSP}`)
    .trim()
    .slice(0, max)
}

/** A one-line title (GitHub shows 256 at most; keep it readable). */
export const prTitle = (title: string) => safeText(title.replace(/\s+/g, ' '), 120) || 'Content edit'

export const editorMarker = (key: string) => `<!-- omnibrew-editor:${key} -->`

/** The key in a PR body written by `prBody` (the first marker: the server writes it at the top). */
export function readEditorMarker(body: string | null | undefined): string | undefined {
  return body?.match(MARKER)?.[1]
}

const CHANGE_WORD: Record<FileChange, string> = { edit: 'Edited', add: 'Added', delete: 'Deleted' }

export function prBody(input: { key: string, editor: PrEditor, summary: string, files: PrFile[], site: string }): string {
  const who = `**${plainName(input.editor.name)}**`
  const gh = githubUser(input.editor.github)
  const files = input.files.map(f => `- ${CHANGE_WORD[f.change]} \`${f.path}\`${f.name ? ` (${plainName(f.name)})` : ''}`)
  const summary = safeText(input.summary)
  return [
    editorMarker(input.key),
    `Edited by ${who}${gh ? ` (@${gh})` : ''} on the ${input.site} editor.`,
    '',
    summary || '_No description given._',
    '',
    '### Files',
    ...files,
    '',
    '_The **Validate content** check runs on this pull request. Merging it publishes the change to the beta site._',
  ].join('\n')
}

/** The commit message: the title, the mod's summary, and who made it. */
export function commitMessage(input: { title: string, summary?: string, editor: PrEditor }): string {
  const summary = input.summary ? safeText(input.summary, 2000) : ''
  return [prTitle(input.title), ...(summary ? ['', summary] : []), '', `Edited-by: ${plainName(input.editor.name)}`].join('\n')
}

/** A reply the App posts in a mod's name on their PR. */
export function replyBody(editor: PrEditor, text: string): string {
  return `**${plainName(editor.name)}** (via the editor):\n\n${safeText(text)}`
}
