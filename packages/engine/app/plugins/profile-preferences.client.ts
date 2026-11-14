import type { UnitSystem } from '../stores/preferences'

/**
 * The profile's preferences (plan/26 §1.2): units and color mode follow the account. When
 * the user signs in on this page, the profile's choices apply; while signed in, changing
 * one saves it to the profile. A session restored on load reads nothing, so pages cost no
 * extra request, and signed-out readers never load Amplify.
 */
export default defineNuxtPlugin((nuxtApp) => {
  const session = useSession()
  const preferences = usePreferences()
  const colorMode = useColorMode()
  let saved: Record<string, unknown> | null = null
  let applying = false
  let timer: ReturnType<typeof setTimeout> | undefined
  // The browser's saved choices are restored after hydration (plugins/preferences.client.ts); only changes after that are the user's.
  let ready = false
  nuxtApp.hooks.hookOnce('app:suspense:resolve', () => {
    setTimeout(() => (ready = true), 0)
  })

  // A sign-in, or a finished migration (it may have brought the old site's units and color mode).
  watch(() => [session.signIns, useState<number>('legacy-migration:finished', () => 0).value], async () => {
    try {
      const data = await useUserData()
      if (!data) return
      saved = (await data.profile.mine()).preferences ?? {}
      applying = true
      if (saved.units === 'metric' || saved.units === 'imperial') preferences.setUnits(saved.units as UnitSystem)
      if (saved.colorMode === 'light' || saved.colorMode === 'dark' || saved.colorMode === 'system') colorMode.preference = saved.colorMode
      await nextTick()
    }
    catch {
      // The profile couldn't load: the browser's own choices stay.
    }
    finally {
      applying = false
    }
  })

  watch(() => [preferences.units, colorMode.preference], () => {
    if (!ready || applying || !session.signedIn) return
    clearTimeout(timer)
    timer = setTimeout(async () => {
      try {
        const data = await useUserData()
        if (!data) return
        saved ??= (await data.profile.mine()).preferences ?? {}
        const next = { ...saved, units: preferences.units, colorMode: colorMode.preference }
        if (next.units === saved.units && next.colorMode === saved.colorMode) return
        saved = (await data.profile.update({ preferences: next })).preferences
      }
      catch {
        // Not saved to the account; the browser keeps the choice.
      }
    }, 1000)
  })
})
