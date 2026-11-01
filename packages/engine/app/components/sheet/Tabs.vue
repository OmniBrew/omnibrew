<script setup lang="ts">
/**
 * The sheet's tabs. Underline tabs on wide screens; under 640 px a 3-column grid of
 * 44 px cells (design notes "Phone patterns"), the active cell with a 10% primary wash
 * and a 2 px bar. Nothing scrolls sideways.
 */
const { t } = useI18n()
const tabs = computed(() => [
  { id: 'actions', label: t('sheet.tabs.actions') },
  { id: 'powers', label: t('power_title', 2) },
  { id: 'gear', label: t('sheet.tabs.gear') },
  { id: 'features', label: t('sheet.tabs.features') },
  { id: 'details', label: t('sheet.tabs.details') },
  { id: 'notes', label: t('notes_title') },
])

const KEY = 'omnibrew:sheet-tab'
const active = ref('actions')
onMounted(() => {
  try {
    const saved = sessionStorage.getItem(KEY)
    if (saved && tabs.value.some(x => x.id === saved)) active.value = saved
  }
  catch {
    // Storage blocked: start on Actions.
  }
})
watch(active, (v) => {
  try {
    sessionStorage.setItem(KEY, v)
  }
  catch {
    // Storage blocked.
  }
})

function keydown(e: KeyboardEvent, index: number) {
  const next = e.key === 'ArrowRight' ? index + 1 : e.key === 'ArrowLeft' ? index - 1 : null
  if (next === null) return
  e.preventDefault()
  const tab = tabs.value[(next + tabs.value.length) % tabs.value.length]!
  active.value = tab.id
  nextTick(() => document.getElementById(`sheet-tab-${tab.id}`)?.focus())
}
</script>

<template>
  <section class="min-w-0 rounded-md border border-default bg-muted">
    <div role="tablist" :aria-label="t('sheet.tabs.label')" class="grid grid-cols-3 border-b border-default sm:flex sm:gap-1 sm:px-2">
      <button
        v-for="(tab, i) in tabs"
        :id="`sheet-tab-${tab.id}`"
        :key="tab.id"
        role="tab"
        type="button"
        :aria-selected="active === tab.id"
        :aria-controls="`sheet-panel-${tab.id}`"
        :tabindex="active === tab.id ? 0 : -1"
        class="relative h-11 font-label text-sm font-semibold tracking-[0.02em] transition-colors focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary max-sm:border-default max-sm:not-nth-[3n]:border-e max-sm:nth-[-n+3]:border-b sm:h-12 sm:px-3"
        :class="active === tab.id ? 'text-highlighted max-sm:bg-primary/10' : 'text-muted hover:text-default'"
        @click="active = tab.id"
        @keydown="keydown($event, i)"
      >
        {{ tab.label }}
        <span v-if="active === tab.id" class="absolute inset-x-0 bottom-0 h-0.5 bg-primary sm:inset-x-2" />
      </button>
    </div>
    <div :id="`sheet-panel-${active}`" role="tabpanel" :aria-labelledby="`sheet-tab-${active}`" class="p-3 sm:p-4">
      <SheetActionsTab v-if="active === 'actions'" />
      <SheetPowersTab v-else-if="active === 'powers'" />
      <SheetGearTab v-else-if="active === 'gear'" />
      <SheetFeaturesTab v-else-if="active === 'features'" />
      <SheetDetailsTab v-else-if="active === 'details'" />
      <SheetNotesTab v-else />
    </div>
  </section>
</template>
