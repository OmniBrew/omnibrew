import { importLegacyPreferences, type LegacyPreferencesConfig } from '../utils/legacy-preferences'

// Restore saved preferences once the page has hydrated (async layouts and pages hydrate after
// `app:mounted`), so the first client render matches the prerendered HTML. The game's old
// site's units and color mode come first, once, if this site has none saved (plan/28 §2).
export default defineNuxtPlugin((nuxtApp) => {
  nuxtApp.hooks.hookOnce('app:suspense:resolve', () => {
    const { game } = useAppConfig() as unknown as { game: { legacyPreferences?: LegacyPreferencesConfig | null } }
    let colorMode: 'dark' | 'light' | undefined
    try {
      colorMode = importLegacyPreferences(game.legacyPreferences, localStorage, { preferences: 'omnibrew:preferences', colorMode: 'nuxt-color-mode', flag: 'omnibrew:legacy-preferences' }).colorMode
    }
    catch {
      // Storage blocked.
    }
    if (colorMode) useColorMode().preference = colorMode
    usePreferences().restore()
  })
})
