// Restore saved preferences once the page has hydrated (async layouts and pages hydrate after
// `app:mounted`), so the first client render matches the prerendered HTML.
export default defineNuxtPlugin((nuxtApp) => {
  nuxtApp.hooks.hookOnce('app:suspense:resolve', () => usePreferences().restore())
})
