/**
 * The GitHub App the content editor opens pull requests with (plan/33 §1.3): `omnibrew-editor`,
 * installed on the OmniBrew org for the content repo and the sandbox's test repo only.
 */
export const EDITOR_GITHUB = {
  appId: '5906813',
  installationId: '185440511',
  /** Amplify builds (prod pool) edit the content repo; sandboxes (dev pool) the test repo. */
  repo: { prod: 'OmniBrew/masseffect-5e-data', dev: 'OmniBrew/editor-sandbox' },
  base: 'master',
}
