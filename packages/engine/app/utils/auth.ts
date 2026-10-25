/** The i18n key (under `auth.errors`) for an Amplify auth error, and its parameters. */
export function authErrorMessage(error: unknown): { key: string, params?: Record<string, string> } {
  const name = (error as { name?: string })?.name
  switch (name) {
    case 'NotAuthorizedException':
    case 'UserNotFoundException':
      return { key: 'auth.errors.wrong_password' }
    case 'UsernameExistsException':
      return { key: 'auth.errors.user_exists' }
    case 'CodeMismatchException':
      return { key: 'auth.errors.code_mismatch' }
    case 'ExpiredCodeException':
      return { key: 'auth.errors.code_expired' }
    case 'LimitExceededException':
    case 'TooManyRequestsException':
    case 'TooManyFailedAttemptsException':
      return { key: 'auth.errors.too_many' }
    case 'InvalidPasswordException':
      return { key: 'auth.errors.weak_password' }
    default:
      return { key: 'auth.errors.unknown', params: { message: (error as Error)?.message ?? String(error) } }
  }
}

/** A same-site path to return to after signing in (never another origin). */
export function safeRedirect(path: unknown): string | null {
  return typeof path === 'string' && path.startsWith('/') && !path.startsWith('//') && !path.startsWith('/auth/') ? path : null
}
