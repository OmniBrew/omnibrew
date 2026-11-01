<script setup lang="ts">
/** The Details tab: background and the characteristics the builder's Details step fills in (read here; edited in the builder). */
import { CHARACTERISTICS } from '@omnibrew/engine/character'

const { t } = useI18n()
const { sheet, character, store, editable } = useSheet()

const xp = computed(() => character.value.experience)
const filled = computed(() => CHARACTERISTICS.map(k => ({ key: k, value: character.value.details.characteristics[k] ?? '' })).filter(c => c.value.trim()))
</script>

<template>
  <div class="flex flex-col gap-4 text-sm">
    <dl class="grid grid-cols-2 gap-3 sm:grid-cols-4">
      <StatItem :label="t('background_title', 1)">
        {{ sheet.background?.name ?? t('none') }}
      </StatItem>
      <StatItem :label="t('species_title', 1)">
        {{ sheet.species?.name ?? t('none') }}
      </StatItem>
      <StatItem :label="t('level_title', 1)">
        <span class="font-mono">{{ sheet.level }}</span>
      </StatItem>
      <StatItem :label="xp.useMilestone ? t('sheet.details.milestone') : t('xp_title')">
        <span class="font-mono">{{ xp.useMilestone ? xp.milestone : xp.points }}</span>
      </StatItem>
    </dl>
    <dl v-if="filled.length" class="grid gap-3 sm:grid-cols-2">
      <div v-for="c in filled" :key="c.key" :class="{ 'sm:col-span-2': ['appearance', 'backstory', 'personality_traits'].includes(c.key) }">
        <dt class="eyebrow text-muted">
          {{ t(`character.${c.key}`) }}
        </dt>
        <dd class="mt-1 whitespace-pre-line text-highlighted">
          {{ c.value }}
        </dd>
      </div>
    </dl>
    <p v-else class="text-muted">
      {{ t('sheet.details.empty') }}
    </p>
    <UButton v-if="editable" :to="{ path: '/characters/builder', query: { id: store.id, step: 'details' } }" :label="t('sheet.details.edit')" icon="i-lucide-pencil" variant="outline" size="sm" class="self-start" />
  </div>
</template>
