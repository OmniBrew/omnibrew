/**
 * Reads the session once the page has hydrated (async layouts and pages hydrate after
 * `app:mounted`), so the first client render matches the prerendered HTML, which has no
 * session. Amplify loads only if the browser may hold a session, or on the OAuth callback.
 */
export default defineNuxtPlugin((nuxtApp) => {
  const session = useSession()
  if (!session.enabled) return
  nuxtApp.hooks.hookOnce('app:suspense:resolve', () => session.refresh(useRoute().path.startsWith('/auth/callback')))
})
