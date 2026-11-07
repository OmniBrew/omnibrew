<script setup lang="ts">
/**
 * The Background step: backgrounds as cards (skills, choices, starting credits), one
 * click to pick (or the game's custom one); then the picked background's text and
 * the choices it offers.
 */
import { actions, type Rec } from '@omnibrew/engine/rules'

const { t, n } = useI18n()
const { sheet, character, apply } = useSheet()

const backgrounds = computed(() => sheet.value.content.list('backgrounds').slice().sort((a, b) => String(a.name).localeCompare(String(b.name))))
const set = (id: string | null) => apply(s => actions.edit(s.character, (c) => {
  c.background = id || null
}))

// The cards show until a background is picked; "Change background" brings them back.
const choosing = ref(!character.value.background)
function pick(b: Rec) {
  if (character.value.background !== b.id) set(b.id)
  choosing.value = false
}

// A mechanic with `options` (or a `*-choice` type) asks the player to pick.
const isChoice = (m: Record<string, unknown>) => Boolean(m.options) || String(m.type).endsWith('-choice')
const skills = (b: Rec) => mechanicsOfType(b.mechanics, 'skill').filter(m => !isChoice(m) && m.value).map(m => sheet.value.content.get('skills', String(m.value))?.name ?? String(m.value))
const choices = (b: Rec) => ((b.mechanics ?? []) as Array<Record<string, unknown>>).filter(isChoice).length
</script>

<template>
  <div class="flex flex-col gap-4">
    <template v-if="choosing || !sheet.background">
      <div v-if="sheet.background" class="flex justify-end">
        <UButton :label="t('builder.keep', { name: sheet.background.name })" color="neutral" variant="outline" @click="choosing = false" />
      </div>
      <ul class="grid gap-2 sm:grid-cols-2 lg:grid-cols-3" role="listbox" :aria-label="t('background_title', 1)">
        <li v-for="b in backgrounds" :key="b.id">
          <button
            type="button"
            role="option"
            :aria-selected="character.background === b.id"
            class="flex h-full w-full flex-col gap-0.5 rounded-md border p-3 text-start transition-colors focus-visible:outline-2 focus-visible:outline-primary"
            :class="character.background === b.id ? 'border-primary bg-primary/10' : 'border-default bg-default hover:border-primary hover:bg-elevated'"
            @click="pick(b)"
          >
            <span class="flex flex-wrap items-center gap-2">
              <span class="font-label text-base font-semibold text-highlighted">{{ b.name }}</span>
              <UBadge v-if="character.background === b.id" :label="t('builder.selected')" size="sm" variant="soft" />
            </span>
            <span v-if="skills(b).length" class="text-xs font-semibold text-default">{{ skills(b).join(', ') }}</span>
            <span class="text-xs text-muted">
              <template v-if="choices(b)">{{ t('builder.background.choices', choices(b)) }}</template>
              <template v-if="choices(b) && b.startingCredits"> · </template>
              <template v-if="b.startingCredits">{{ t('starting_credits') }}: {{ n(Number(b.startingCredits)) }}</template>
            </span>
          </button>
        </li>
      </ul>
    </template>

    <template v-else>
      <div class="flex flex-wrap items-center gap-3 rounded-md border border-default bg-default p-3">
        <h2 class="min-w-0 flex-1 font-display text-xl font-bold text-highlighted">
          {{ sheet.background.name }}
        </h2>
        <UButton :label="t('builder.background.change')" icon="i-lucide-repeat" color="neutral" variant="outline" @click="choosing = true" />
      </div>
      <SheetProse :id="sheet.background.id" collection="backgrounds" class="text-sm" />
      <BuilderChoices :prefixes="['background/']" />
    </template>
  </div>
</template>
