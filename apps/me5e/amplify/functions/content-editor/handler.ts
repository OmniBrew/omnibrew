import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { DynamoDBDocumentClient, GetCommand } from '@aws-sdk/lib-dynamodb'
import type { AppSyncIdentityCognito, AppSyncResolverEvent } from 'aws-lambda'
import { createEditorService, createGitHub, EditorError, editorKey, installationToken, readPrivateKey, type EditorCaller, type EditorService } from '@omnibrew/engine/editor/server'
import { me5eDefinition } from '../../../game/definition'

/**
 * The content editor's resolver (plan/33 §1.4). AppSync lets only `editors` and `admins`
 * call it; the service checks the groups and every path again, writes only `editor/…`
 * branches and never merges. The caller's name on the PR is their site profile's display
 * name (the Profile table, read only), never their email or Cognito username.
 */
const env = (name: string) => {
  const v = process.env[name]
  if (!v) throw new Error(`${name} is not set`)
  return v
}

const db = DynamoDBDocumentClient.from(new DynamoDBClient({}))
let service: EditorService | undefined

/** Built on first use: Amplify resolves the secret into the environment before the handler runs. */
function editor(): EditorService {
  if (service) return service
  const token = installationToken({ appId: env('GITHUB_APP_ID'), installationId: env('GITHUB_INSTALLATION_ID'), privateKey: readPrivateKey(env('GITHUB_APP_PRIVATE_KEY')) })
  service = createEditorService({
    github: createGitHub({ repo: env('GITHUB_REPO'), token }),
    sources: me5eDefinition.sources,
    base: env('GITHUB_BASE'),
    site: env('EDITOR_SITE'),
    key: editorKey,
  })
  return service
}

async function displayName(sub: string): Promise<string> {
  const row = await db.send(new GetCommand({ TableName: env('PROFILE_TABLE'), Key: { id: sub }, ProjectionExpression: 'username' }))
  const name = row.Item?.username
  return typeof name === 'string' && name.trim() ? name : 'An editor'
}

type Args = { path?: string, pr?: number | null, input?: unknown, text?: string }
type Event = AppSyncResolverEvent<Args> & { fieldName?: string }

export const handler = async (event: Event) => {
  const field = event.fieldName ?? event.info?.fieldName
  const identity = event.identity as AppSyncIdentityCognito | null
  if (!identity?.sub) throw new Error('forbidden: sign in first')
  const caller: EditorCaller = { sub: identity.sub, groups: identity.groups ?? [], name: '' }
  const args = event.arguments
  try {
    switch (field) {
      case 'editorFile': return await editor().file(caller, { path: args.path ?? '', pr: args.pr ?? null })
      case 'editorMyEdits': return await editor().myEdits(caller)
      case 'editorSubmit': return await editor().submit({ ...caller, name: await displayName(caller.sub) }, args.input)
      case 'editorComment': return await editor().comment({ ...caller, name: await displayName(caller.sub) }, { pr: args.pr ?? 0, text: args.text ?? '' })
      default: throw new Error(`unknown field ${field}`)
    }
  }
  catch (e) {
    // EditorError messages start with their code (forbidden, invalid, not-found, limit) for the page.
    if (!(e instanceof EditorError)) console.error(JSON.stringify({ field, error: (e as Error).message }))
    throw e
  }
}
