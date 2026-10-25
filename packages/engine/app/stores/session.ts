/**
 * The signed-in user (Amplify JS v6, plan/20). Prerendered pages are built signed out;
 * the session is read once the page has hydrated (plugins/amplify.client.ts), so the
 * first client render matches the HTML. `status` is `loading` until then. Amplify itself
 * loads on demand (utils/amplify.ts).
 */
export interface SessionUser {
  /** Cognito sub: the profile id. */
  sub: string
  /** Cognito username: `google_…` for Google accounts, the sub for email accounts. */
  username: string
  email: string | null
  groups: string[]
}

export type SessionStatus = 'loading' | 'signedOut' | 'signedIn'

/** What a sign-in or sign-up step needs next. */
export type AuthStep = 'done' | 'confirmSignUp' | 'resetPassword'

const REDIRECT_KEY = 'omnibrew:after-sign-in'

export const useSession = defineStore('session', () => {
  const status = ref<SessionStatus>('loading')
  const user = ref<SessionUser | null>(null)
  /** Whether the site has a backend (amplify_outputs.json); without one, nobody signs in. */
  const enabled = ref(amplifyEnabled)

  const signedIn = computed(() => status.value === 'signedIn')

  let listening = false
  /** Amplify, listening to its auth events (sign-in elsewhere, sign-out, a failed token refresh). */
  async function amplify() {
    const modules = await loadAmplify()
    if (!listening) {
      listening = true
      modules.utils.Hub.listen('auth', ({ payload }) => {
        if (payload.event === 'tokenRefresh_failure') {
          // Reading the session again would retry the refresh; the user signs in again.
          user.value = null
          status.value = 'signedOut'
        }
        else if (['signedIn', 'signedOut', 'signInWithRedirect'].includes(payload.event)) refresh(true)
      })
    }
    return modules
  }
  const isAdmin = computed(() => user.value?.groups.includes('admins') ?? false)

  /**
   * Reads the current session (after hydration, after sign-in, on Amplify's auth events).
   * `force` loads Amplify even when the browser holds no session (the OAuth callback).
   */
  async function refresh(force = false) {
    if (!enabled.value || (!force && !mayHaveSession())) {
      user.value = null
      status.value = 'signedOut'
      return
    }
    try {
      const { auth } = await amplify()
      const [current, session] = await Promise.all([auth.getCurrentUser(), auth.fetchAuthSession()])
      const claims = session.tokens?.idToken?.payload ?? {}
      user.value = {
        sub: current.userId,
        username: current.username,
        email: typeof claims.email === 'string' ? claims.email : null,
        groups: Array.isArray(claims['cognito:groups']) ? claims['cognito:groups'].map(String) : [],
      }
      status.value = 'signedIn'
    }
    catch {
      user.value = null
      status.value = 'signedOut'
    }
  }

  async function signInWithPassword(email: string, password: string): Promise<AuthStep> {
    const { auth } = await amplify()
    const { nextStep } = await auth.signIn({ username: email, password })
    if (nextStep.signInStep === 'CONFIRM_SIGN_UP') return 'confirmSignUp'
    if (nextStep.signInStep === 'RESET_PASSWORD') return 'resetPassword'
    if (nextStep.signInStep !== 'DONE') throw new Error(`Unsupported sign-in step: ${nextStep.signInStep}`)
    await refresh()
    return 'done'
  }

  /** Goes to Google through the Cognito hosted domain; returns at /auth/callback. */
  async function signInWithGoogle(redirect?: string) {
    rememberRedirect(redirect)
    const { auth } = await amplify()
    await auth.signInWithRedirect({ provider: 'Google' })
  }

  async function register(email: string, password: string): Promise<AuthStep> {
    const { auth } = await amplify()
    const { nextStep } = await auth.signUp({ username: email, password, options: { userAttributes: { email } } })
    return nextStep.signUpStep === 'CONFIRM_SIGN_UP' ? 'confirmSignUp' : 'done'
  }

  async function confirmRegistration(email: string, code: string) {
    const { auth } = await amplify()
    await auth.confirmSignUp({ username: email, confirmationCode: code })
  }

  async function resendCode(email: string) {
    const { auth } = await amplify()
    await auth.resendSignUpCode({ username: email })
  }

  async function startPasswordReset(email: string) {
    const { auth } = await amplify()
    await auth.resetPassword({ username: email })
  }

  async function finishPasswordReset(email: string, code: string, password: string) {
    const { auth } = await amplify()
    await auth.confirmResetPassword({ username: email, confirmationCode: code, newPassword: password })
  }

  async function logOut() {
    const { auth } = await amplify()
    await auth.signOut()
    user.value = null
    status.value = 'signedOut'
  }

  /** Where to go after a Google sign-in (kept across the redirect). */
  function rememberRedirect(path?: string) {
    try {
      if (path) sessionStorage.setItem(REDIRECT_KEY, path)
      else sessionStorage.removeItem(REDIRECT_KEY)
    }
    catch {
      // Storage blocked: the callback goes home.
    }
  }

  function takeRedirect() {
    try {
      const path = sessionStorage.getItem(REDIRECT_KEY)
      sessionStorage.removeItem(REDIRECT_KEY)
      return path
    }
    catch {
      return null
    }
  }

  return {
    status, user, enabled, signedIn, isAdmin,
    refresh, signInWithPassword, signInWithGoogle, register, confirmRegistration, resendCode,
    startPasswordReset, finishPasswordReset, logOut, takeRedirect,
  }
})
