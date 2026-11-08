<script setup lang="ts">
/**
 * The character builder (the live /characters/builder?id=, plan/24 §1.3): Species ·
 * Class · Abilities · Background · Powers · Equipment · Details. Each step shows how
 * many of its choices still need a pick; picks no mechanic asks for any more (a
 * species or class changed) are listed with a remove button. Saves like the sheet.
 */
import { choiceView, choicesUnder, removeChoices } from '@omnibrew/engine/rules'

// Full width, as the live sheet: no reference sidebar.
definePageMeta({ layout: 'bare' })

const route = useRoute()
const router = useRouter()
const { t, te } = useI18n()
const store = useCharacterStore()

useSeoMeta({ title: () => `${store.character?.name || t('characters.unnamed')} · ${t('builder.title')}`, robots: 'noindex' })
useCharacterAutosave()

const id = computed(() => (typeof route.query.id === 'string' ? route.query.id : ''))
const holder = Symbol('builder')
watch(id, (value) => {
  if (value) void store.open(value, holder)
}, { immediate: true })
onBeforeUnmount(() => void store.release(holder))

const STEPS = ['species', 'class', 'abilities', 'background', 'powers', 'equipment', 'details'] as const
type Step = (typeof STEPS)[number]
const PREFIXES: Partial<Record<Step, string[]>> = { species: ['species/'], class: ['class/'], background: ['background/'] }

const step = computed<Step>({
  get: () => (STEPS.includes(route.query.step as Step) ? route.query.step as Step : 'species'),
  set: (v) => {
    void router.replace({ query: { ...route.query, step: v } })
    // A new step starts at the top, from the step buttons or the Back / Next buttons.
    window.scrollTo({ top: 0 })
  },
})
const index = computed(() => STEPS.indexOf(step.value))

const labels = { weapon: (w: string) => (te(`weapon_types.${w}`) ? t(`weapon_types.${w}`, 2) : w), ability: (a: string) => t(`abilities.${a}.title`) }
const missing = computed(() => {
  const sheet = store.sheet
  const out: Partial<Record<Step, number>> = {}
  if (!sheet) return out
  for (const [s, prefixes] of Object.entries(PREFIXES)) out[s as Step] = choicesUnder(sheet, prefixes!).map(p => choiceView(sheet, p, labels)).reduce((a, v) => a + (v.kind === 'hidden' ? 0 : v.missing), 0)
  if (!sheet.character.species) out.species = (out.species ?? 0) + 1
  if (!sheet.character.classes.length) out.class = (out.class ?? 0) + 1
  return out
})
const stale = computed(() => store.sheet?.unusedChoices.filter(c => !c.path.startsWith('reputation/')) ?? [])
// Homebrew copies the character no longer uses (plan/26 §1.4), removable like stale picks.
const staleCopies = computed(() => (store.character ? unusedCopies(store.character) : []))
const copyName = (id: string) => String(store.character?.homebrew?.[id]?.data.name ?? id)
function removeStaleCopies() {
  if (!store.character) return
  store.replace(staleCopies.value.reduce((c, id) => removeCopy(c, id), store.character))
}
</script>

<template>
  <UContainer class="py-4 sm:py-6">
    <div v-if="!id || store.state === 'missing'" class="py-16">
      <UEmpty icon="i-lucide-user-round-x" :title="t('sheet.missing_title')" :description="t('sheet.missing_text')" :actions="[{ label: t('characters.title'), to: '/characters', variant: 'outline' }]" />
    </div>
    <UAlert v-else-if="store.state === 'error'" color="error" variant="subtle" icon="i-lucide-triangle-alert" :title="t('sheet.load_failed')" :description="String((store.error as Error)?.message ?? store.error)" />
    <div v-else-if="store.state !== 'ready' || !store.sheet" class="flex justify-center py-24" aria-busy="true">
      <UIcon name="i-lucide-loader-circle" class="size-8 animate-spin text-muted" />
    </div>
    <UAlert v-else-if="!store.editable" color="neutral" variant="subtle" icon="i-lucide-lock" :title="t('builder.not_yours')" :actions="[{ label: t('builder.view_sheet'), to: { path: '/characters/sheet', query: { id } } }]" />
    <template v-else>
      <header class="mb-4 flex flex-wrap items-center gap-3">
        <div class="min-w-0 flex-1">
          <p class="eyebrow text-primary">
            {{ t('builder.title') }}
          </p>
          <h1 class="truncate font-display text-2xl font-bold text-highlighted sm:text-3xl">
            {{ store.character?.name || t('characters.unnamed') }}
          </h1>
          <SheetSaveState />
        </div>
        <UButton :to="{ path: '/characters/sheet', query: { id } }" :label="t('builder.view_sheet')" icon="i-lucide-scroll-text" variant="outline" />
      </header>
      <SheetConflict />

      <nav :aria-label="t('builder.steps')" class="mb-4">
        <ol class="grid grid-cols-4 gap-1 sm:grid-cols-7">
          <li v-for="(s, i) in STEPS" :key="s">
            <button
              type="button"
              class="relative flex h-11 w-full items-center justify-center gap-1.5 rounded-sm border px-1 font-label text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-primary"
              :class="step === s ? 'border-primary bg-primary/10 text-highlighted' : 'border-default text-muted hover:bg-elevated'"
              :aria-current="step === s ? 'step' : undefined"
              @click="step = s"
            >
              <span class="font-mono text-xs text-dimmed max-sm:hidden">{{ i + 1 }}</span>
              <span class="truncate">{{ t(`builder.step.${s}`) }}</span>
              <UBadge v-if="missing[s]" :label="String(missing[s])" color="warning" variant="solid" size="sm" class="absolute -top-2 -end-1" :aria-label="t('builder.missing', { n: missing[s] })" />
            </button>
          </li>
        </ol>
      </nav>

      <UAlert v-if="stale.length" color="warning" variant="subtle" icon="i-lucide-trash-2" :title="t('builder.stale_title', { n: stale.length })" class="mb-4">
        <template #description>
          <p>{{ t('builder.stale_text') }}</p>
          <ul class="mt-1 font-mono text-xs">
            <li v-for="c in stale" :key="c.path">
              {{ c.path }}
            </li>
          </ul>
        </template>
        <template #actions>
          <UButton :label="t('builder.stale_remove')" color="warning" variant="outline" size="sm" @click="store.replace(removeChoices(store.character!, stale.map(c => c.path)))" />
        </template>
      </UAlert>
      <UAlert v-if="store.goneHomebrew.length" color="neutral" variant="subtle" icon="i-lucide-flask-conical-off" :title="t('homebrew.gone_title', { n: store.goneHomebrew.length })" :description="t('homebrew.gone_text', { names: store.goneHomebrew.map(copyName).join(', ') })" class="mb-4" />
      <UAlert v-if="staleCopies.length" color="neutral" variant="subtle" icon="i-lucide-flask-conical" :title="t('homebrew.stale_copies', { n: staleCopies.length })" class="mb-4">
        <template #description>
          <p>{{ t('homebrew.stale_copies_text') }}</p>
          <ul class="mt-1 text-xs">
            <li v-for="copyId in staleCopies" :key="copyId">
              {{ copyName(copyId) }}
            </li>
          </ul>
        </template>
        <template #actions>
          <UButton :label="t('builder.stale_remove')" color="neutral" variant="outline" size="sm" @click="removeStaleCopies" />
        </template>
      </UAlert>

      <section class="rounded-md border border-default bg-muted p-3 sm:p-4">
        <BuilderSpecies v-if="step === 'species'" />
        <BuilderClasses v-else-if="step === 'class'" />
        <BuilderAbilities v-else-if="step === 'abilities'" />
        <BuilderBackground v-else-if="step === 'background'" />
        <SheetPowerPicker v-else-if="step === 'powers'" />
        <SheetGearTab v-else-if="step === 'equipment'" />
        <BuilderDetails v-else />
      </section>

      <div class="mt-4 flex justify-between gap-2">
        <UButton v-if="index > 0" :label="t(`builder.step.${STEPS[index - 1]}`)" icon="i-lucide-arrow-left" color="neutral" variant="ghost" @click="step = STEPS[index - 1]!" />
        <span v-else />
        <UButton v-if="index < STEPS.length - 1" :label="t(`builder.step.${STEPS[index + 1]}`)" trailing-icon="i-lucide-arrow-right" @click="step = STEPS[index + 1]!" />
        <UButton v-else :to="{ path: '/characters/sheet', query: { id } }" :label="t('builder.done')" trailing-icon="i-lucide-check" />
      </div>
      <SheetOverlays />
    </template>
  </UContainer>
</template>
