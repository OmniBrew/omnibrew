// Restore saved preferences after hydration, so the first client render matches the prerendered HTML.
export default defineNuxtPlugin((nuxtApp) => {
  nuxtApp.hook('app:mounted', () => usePreferences().restore())
})
