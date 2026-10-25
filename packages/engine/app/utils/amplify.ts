/**
 * Amplify JS v6, loaded on demand (plan/20): ~180 KB gzipped that signed-out readers of
 * the reference pages never need. The config is the app's amplify_outputs.json
 * (`#amplify-outputs`); without one (CI, a plain build) the site runs signed out.
 */
import outputs from '#amplify-outputs'

const config = outputs as { auth?: { user_pool_client_id?: string } }

/** Whether the site has a backend to sign in to. */
export const amplifyEnabled = Boolean(config.auth)

interface AmplifyModules {
  auth: typeof import('aws-amplify/auth')
  data: typeof import('aws-amplify/data')
  utils: typeof import('aws-amplify/utils')
}

let loading: Promise<AmplifyModules> | null = null

/** Loads and configures Amplify once. */
export function loadAmplify(): Promise<AmplifyModules> {
  loading ??= (async () => {
    const [{ Amplify }, auth, data, utils] = await Promise.all([
      import('aws-amplify'),
      import('aws-amplify/auth'),
      import('aws-amplify/data'),
      import('aws-amplify/utils'),
      // Finishes a Google sign-in when the page is the OAuth callback.
      import('aws-amplify/auth/enable-oauth-listener'),
    ])
    Amplify.configure(outputs as Parameters<typeof Amplify.configure>[0])
    return { auth, data, utils }
  })()
  return loading
}

/**
 * Whether this browser may hold a session: Amplify keeps the last signed-in user under
 * `CognitoIdentityServiceProvider.<client id>.LastAuthUser` in localStorage.
 */
export function mayHaveSession() {
  try {
    return Boolean(localStorage.getItem(`CognitoIdentityServiceProvider.${config.auth?.user_pool_client_id}.LastAuthUser`))
  }
  catch {
    return true
  }
}
