/**
 * The first sign-in of a user with data on the game's older backend brings it across
 * (plan/28 §1; `game.legacyMigration`). Only signed-in sessions do anything, and only once
 * per account in this browser.
 */
export default defineNuxtPlugin(() => {
  if (!useAppConfig().game.legacyMigration) return
  const session = useSession()
  watch(() => session.signedIn && session.user?.sub, (sub) => {
    if (sub) void useLegacyMigration().run()
  }, { immediate: true })
})
