<script setup lang="ts">
/** The Background step: pick a background (or the game's custom one), read it, and make its choices. */
import { actions } from '@omnibrew/engine/rules'

const { t } = useI18n()
const { sheet, character, apply } = useSheet()

const backgrounds = computed(() => sheet.value.content.list('backgrounds').slice().sort((a, b) => String(a.name).localeCompare(String(b.name))))
const set = (id: string) => apply(s => actions.edit(s.character, (c) => {
  c.background = id || null
}))
</script>

<template>
  <div class="flex flex-col gap-4">
    <USelect
      :model-value="character.background ?? NONE"
      :items="[{ label: t('builder.background.choose'), value: NONE }, ...backgrounds.map(b => ({ label: b.name, value: b.id }))]"
      class="w-full sm:w-80"
      :aria-label="t('background_title', 1)"
      @update:model-value="v => set(fromSelect(v))"
    />
    <template v-if="sheet.background">
      <SheetProse :id="sheet.background.id" collection="backgrounds" class="text-sm" />
      <BuilderChoices :prefixes="['background/']" />
    </template>
  </div>
</template>
