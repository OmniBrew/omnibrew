<script setup lang="ts">
/**
 * The character sheet (the live /characters/sheet?id=, plan/24): the owner plays it,
 * anyone else with the link sees it view-only (and can roll). Laid out as the live
 * sheet: identity and vitals beside abilities, saves, senses and skills; then the tabs
 * beside the side column (the game's panels, rests, proficiencies). Phones stack it in
 * the same order and keep the Roll / Menu / Settings bar.
 */
// Full width, as the live sheet: no reference sidebar.
definePageMeta({ layout: 'bare' })

const route = useRoute()
const { t } = useI18n()
const store = useCharacterStore()
const rolls = useRollStore()
const ui = useSheetUi()

useSeoMeta({ title: () => store.character?.name || t('sheet.title'), robots: 'noindex' })
useSheetAccent(() => store.character)
useCharacterAutosave()
useDiscordPosting()

const id = computed(() => (typeof route.query.id === 'string' ? route.query.id : ''))

const holder = Symbol('sheet')
watch(id, async (value) => {
  ui.close()
  if (!value) return
  await store.open(value, holder)
  rolls.use(value)
}, { immediate: true })

onBeforeUnmount(() => {
  ui.close()
  void store.release(holder)
})
</script>

<template>
  <UContainer class="py-4 pb-24 sm:py-6 lg:pb-8">
    <div v-if="!id || store.state === 'missing'" class="py-16">
      <UEmpty icon="i-lucide-user-round-x" :title="t('sheet.missing_title')" :description="t('sheet.missing_text')" :actions="[{ label: t('characters.title'), to: '/characters', variant: 'outline' }]" />
    </div>
    <div v-else-if="store.state === 'error'" class="py-16">
      <UAlert color="error" variant="subtle" icon="i-lucide-triangle-alert" :title="t('sheet.load_failed')" :description="String((store.error as Error)?.message ?? store.error)" />
    </div>
    <div v-else-if="store.state !== 'ready' || !store.sheet" class="flex justify-center py-24" aria-busy="true">
      <UIcon name="i-lucide-loader-circle" class="size-8 animate-spin text-muted" />
    </div>
    <template v-else>
      <h1 class="sr-only">
        {{ store.character?.name || t('characters.unnamed') }}
      </h1>
      <UAlert v-if="!store.editable" icon="i-lucide-eye" color="neutral" variant="subtle" :title="t('sheet.view_only')" class="mb-3" />
      <SheetConflict />

      <div class="grid gap-3 lg:grid-cols-[22rem_minmax(0,1fr)]">
        <div class="flex min-w-0 flex-col gap-3">
          <SheetHeader />
          <SheetVitals />
          <SheetDefenses />
        </div>
        <div class="flex min-w-0 flex-col gap-3">
          <SheetAbilities />
          <div class="grid gap-3 md:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
            <SheetSaves />
            <SheetSenses />
          </div>
          <SheetSkills />
        </div>
      </div>

      <div class="mt-3 grid gap-3 lg:grid-cols-[minmax(0,1fr)_19rem]">
        <SheetTabs />
        <SheetSide />
      </div>

      <SheetMobileBar />
      <SheetOverlays />
    </template>
  </UContainer>
</template>
