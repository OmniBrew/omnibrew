/**
 * Reader preferences kept in the browser (localStorage), so the prerendered
 * pages stay the same for everyone and adjust after they load. Color mode is
 * kept by Nuxt UI's color-mode module.
 */
export type UnitSystem = 'imperial' | 'metric'

const KEY = 'omnibrew:preferences'

export const usePreferences = defineStore('preferences', () => {
  const { game } = useAppConfig()
  const units = ref<UnitSystem>(game.units.default as UnitSystem)

  /** Reads the saved preferences. Called once the page has hydrated (plugins/preferences.client.ts). */
  function restore() {
    try {
      const saved = JSON.parse(localStorage.getItem(KEY) ?? '{}') as { units?: UnitSystem }
      if (saved.units === 'imperial' || saved.units === 'metric') units.value = saved.units
    }
    catch {
      // Storage blocked or corrupt: keep the defaults.
    }
  }

  function save() {
    try {
      localStorage.setItem(KEY, JSON.stringify({ units: units.value }))
    }
    catch {
      // Storage blocked: the choice lasts until the page closes.
    }
  }

  function toggleUnits() {
    units.value = units.value === 'metric' ? 'imperial' : 'metric'
    save()
  }

  return { units, restore, toggleUnits }
})
