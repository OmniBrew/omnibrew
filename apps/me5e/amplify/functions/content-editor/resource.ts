import { defineFunction, secret } from '@aws-amplify/backend'
import { pool } from '../../auth/resource'
import { EDITOR_GITHUB } from './github'

/**
 * `editorFile`, `editorSubmit`, `editorMyEdits` and `editorComment` (plan/33 §1.4). The App's
 * private key is an Amplify secret (SSM SecureString: the app's Secrets page for builds,
 * `ampx sandbox secret set` for sandboxes), base64 of the `.pem`. In the data stack, as the
 * API's resolver. `ME5E_EDITOR_REPO` overrides the repository.
 */
export const contentEditor = defineFunction({
  name: 'content-editor',
  entry: './handler.ts',
  runtime: 24,
  architecture: 'arm64',
  memoryMB: 512,
  timeoutSeconds: 25,
  resourceGroupName: 'data',
  logging: { format: 'json', retention: '1 month' },
  environment: {
    GITHUB_APP_ID: EDITOR_GITHUB.appId,
    GITHUB_INSTALLATION_ID: EDITOR_GITHUB.installationId,
    GITHUB_REPO: process.env.ME5E_EDITOR_REPO ?? (pool === 'prod' ? EDITOR_GITHUB.repo.prod : EDITOR_GITHUB.repo.dev),
    GITHUB_BASE: EDITOR_GITHUB.base,
    EDITOR_SITE: 'n7.world',
    GITHUB_APP_PRIVATE_KEY: secret('GITHUB_APP_PRIVATE_KEY'),
  },
})
