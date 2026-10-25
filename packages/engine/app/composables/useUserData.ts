import type { Schema } from '@omnibrew/backend'
import type { UserData } from '@omnibrew/engine/data'

let userData: Promise<UserData | null> | null = null

/**
 * The user-data layer (characters, profile, bookmarks, homebrew), loaded with Amplify on
 * first use. Browser only; null when the site has no backend.
 */
export function useUserData(): Promise<UserData | null> {
  if (!amplifyEnabled) return Promise.resolve(null)
  const nuxtApp = useNuxtApp()
  const session = useSession()
  userData ??= Promise.all([loadAmplify(), import('@omnibrew/engine/data')]).then(([{ data }, { createUserData }]) =>
    createUserData({ client: data.generateClient<Schema>(), game: nuxtApp.$characterGame, session: () => session.user }))
  return userData
}
