<script setup lang="ts">
/** The Details step (the live MeCbDescription): name, image link, and the characteristics. */
import { CHARACTERISTICS, type Character } from '@omnibrew/engine/character'
import { actions } from '@omnibrew/engine/rules'

const { t } = useI18n()
const { character, apply } = useSheet()
const change = (fn: (c: Character) => void) => apply(s => actions.edit(s.character, fn))
const LONG = ['personality_traits', 'ideal', 'bond', 'flaw', 'appearance', 'backstory']

function setImage(v: string) {
  const url = v.trim()
  change((c) => {
    if (url && /^https:\/\//.test(url)) c.image = url
    else delete c.image
  })
}
</script>

<template>
  <div class="grid gap-4 sm:grid-cols-2">
    <UFormField :label="t('character.name')" required>
      <UInput :model-value="character.name" class="w-full" @update:model-value="v => change(c => (c.name = String(v)))" />
    </UFormField>
    <UFormField :label="t('builder.details.image')" :hint="t('builder.details.image_hint')">
      <UInput :model-value="character.image ?? ''" type="url" placeholder="https://" class="w-full" @change="(e: Event) => setImage((e.target as HTMLInputElement).value)" />
    </UFormField>
    <UFormField v-for="key in CHARACTERISTICS" :key="key" :label="t(`character.${key}`)" :class="{ 'sm:col-span-2': LONG.includes(key) }">
      <UTextarea v-if="LONG.includes(key)" :model-value="character.details.characteristics[key] ?? ''" :rows="key === 'backstory' ? 6 : 2" autoresize class="w-full" @update:model-value="v => change(c => (c.details.characteristics[key] = String(v)))" />
      <UInput v-else :model-value="character.details.characteristics[key] ?? ''" class="w-full" @update:model-value="v => change(c => (c.details.characteristics[key] = String(v)))" />
    </UFormField>
  </div>
</template>
