/**
 * The first sign-in of a user with data on the game's older backend brings it across
 * (plan/28 §1; `game.legacyMigration`). Only signed-in sessions do anything, and only once
 * per account in this browser. The migration's code loads only then, so reference pages
 * don't preload the data layer.
 */
export default defineNuxtPlugin(() => {
  if (!useAppConfig().game.legacyMigration) return
  const session = useSession()
  const nuxtApp = useNuxtApp()
  watch(() => session.signedIn && session.user?.sub, async (sub) => {
    if (!sub) return
    try {
      // The game's plugin (`$characterGame`) runs after the engine's: read it here, not at setup.
      if (localStorage.getItem(`omnibrew:${nuxtApp.$characterGame.id}:migrated:${sub}`)) return
    }
    catch {
      // Storage blocked: ask the backend.
    }
    const { useLegacyMigration } = await import('../stores/legacy-migration')
    // After the await the Nuxt context is gone; the store takes what it needs when created.
    void nuxtApp.runWithContext(() => useLegacyMigration().run())
  })
})
