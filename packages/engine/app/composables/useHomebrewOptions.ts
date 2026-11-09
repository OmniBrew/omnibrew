import type { Rules } from '@omnibrew/engine/rules'
import type { Game } from '@omnibrew/engine/schemas'

/**
 * The rules the homebrew pages work with (plan/26 §1.3): the game, content plus the
 * player's collection (so a feat can grant a homebrew power they use). Loaded once by the
 * page with `useHomebrewRules().load()`; the form fields read their options from it.
 */
export const useHomebrewRules = defineStore('homebrewRules', () => {
  const loaded = shallowRef<LoadedRules | null>(null)
  const error = ref<unknown>(null)
  const library = useHomebrewLibrary()

  async function load() {
    try {
      loaded.value ??= await useRules()
    }
    catch (e) {
      error.value = e
    }
    return loaded.value
  }

  const game = computed<Game | null>(() => loaded.value?.game ?? null)
  const itemKinds = computed(() => Object.fromEntries(Object.entries(game.value?.def.sources ?? {}).map(([c, s]) => [c, s.itemKind])))
  /** Content plus the player's collection. */
  const records = computed(() => (loaded.value ? mergeHomebrew(loaded.value.records, library.collection, itemKinds.value) : null))
  const rules = computed<Rules | null>(() => (loaded.value && records.value ? (records.value === loaded.value.records ? loaded.value.rules : loaded.value.withRecords(records.value)) : null))

  return { loaded, error, load, game, itemKinds, records, rules }
})

/** Options for homebrew form fields: enum values and records, with their names. */
export function useHomebrewOptions() {
  const { t, te } = useI18n()
  const hb = useHomebrewRules()

  const humanize = (v: string) => v.replaceAll(/[_-]/g, ' ').replace(/^\w/, c => c.toUpperCase())
  function valueLabel(v: string | number, pattern?: string) {
    if (!pattern) return humanize(String(v))
    const key = pattern.replace('{v}', String(v))
    return te(key) ? t(key) : humanize(String(v))
  }
  const enumItems = (name: string, pattern?: string) =>
    (hb.game?.enums.values[name] ?? []).map(v => ({ value: v, label: valueLabel(v, pattern) }))
  const recordItems = (collection: string) =>
    (hb.rules?.content.list(collection) ?? [])
      .map(r => ({ value: String(r.id), label: String(r.name ?? r.id) + (r.homebrew ? ` (${t('homebrew.badge')})` : '') }))
      .sort((a, b) => a.label.localeCompare(b.label))
  const recordName = (collection: string, id: string) => String(hb.rules?.content.get(collection, id)?.name ?? id)

  return { valueLabel, enumItems, recordItems, recordName }
}
