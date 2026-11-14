<script setup lang="ts">
/** One rolled reward: credits, consumables and items (linked to their pages), and the rolls that made it. */
import { lootText, type LootData, type LootResult } from '../../../../generators/loot'

const props = defineProps<{
  loot: LootResult
  data: LootData
  /** Its number on the page (1-based). */
  n: number
}>()
defineEmits<{ remove: [] }>()

const { t } = useI18n()
const { game } = useAppConfig() as unknown as { game: { routes: Record<string, string | false> } }
const showLog = ref(false)
const band = computed(() => props.data.rewards.find(r => r.id === props.loot.band)?.name ?? props.loot.band)
const KINDS = [
  { kind: 'weapons', title: 'weapon_title' },
  { kind: 'armor', title: 'armor_title' },
  { kind: 'mods', title: 'mod_title' },
  { kind: 'gear', title: 'gear_title' },
] as const
const groups = computed(() => KINDS.map(k => ({ ...k, items: props.loot.items[k.kind] })).filter(g => g.items.length))
const page = (collection: string, id?: string) => (id ? recordPath(game.routes, collection, { id }) : undefined)
</script>

<template>
  <UCard :ui="{ body: 'space-y-4' }" data-loot-reward>
    <template #header>
      <div class="flex items-start justify-between gap-3">
        <div class="min-w-0">
          <h3 class="font-semibold text-highlighted">
            {{ t('loot.reward_title', { n }) }}
          </h3>
          <p class="text-sm text-muted">
            {{ t('loot.band_title', { band }) }} · {{ loot.hoard ? t('loot.hoard') : t('loot.individual_title') }}
          </p>
        </div>
        <UButton color="neutral" variant="ghost" icon="i-lucide-x" :aria-label="t('loot.remove', { n })" @click="$emit('remove')" />
      </div>
    </template>

    <div>
      <p class="eyebrow text-muted">
        {{ t('loot.credits') }}
      </p>
      <p class="font-display text-2xl font-bold text-highlighted tabular-nums">
        {{ groupDigits(loot.credits, t('digit_separator')) }}
      </p>
    </div>

    <div v-if="loot.consumables.length">
      <p class="eyebrow text-muted">
        {{ t('loot.consumables') }}
      </p>
      <ul class="mt-1 space-y-0.5">
        <li v-for="c in loot.consumables" :key="c.id">
          <span class="font-mono tabular-nums">{{ c.count }}</span>{{ ' ' }}
          <NuxtLink v-if="page('gear', c.page)" :to="page('gear', c.page)" class="text-primary hover:underline">
            {{ c.name }}
          </NuxtLink>
          <span v-else>{{ c.name }}</span>
        </li>
      </ul>
    </div>

    <div v-for="g in groups" :key="g.kind">
      <p class="eyebrow text-muted">
        {{ t(g.title, 2) }}
      </p>
      <ul class="mt-1 space-y-1">
        <li v-for="(item, i) in g.items" :key="`${item.id}-${i}`" class="flex flex-wrap items-center gap-x-2 gap-y-1">
          <NuxtLink :to="page(g.kind, item.page)" class="text-primary hover:underline">
            {{ item.name }}
          </NuxtLink>
          <MeRarityBadge v-if="item.rarity" :rarity="item.rarity" />
        </li>
      </ul>
    </div>

    <template #footer>
      <UCollapsible v-model:open="showLog">
        <UButton variant="link" color="neutral" class="px-0" :trailing-icon="showLog ? 'i-lucide-chevron-up' : 'i-lucide-chevron-down'" :label="showLog ? t('loot.log_hide') : t('loot.log_show')" />
        <template #content>
          <ol class="mt-2 divide-y divide-default text-sm">
            <li v-for="(line, i) in loot.log" :key="i" class="py-1.5">
              <p class="text-default">
                {{ lootText(t, line.text) }}
              </p>
              <p v-if="lootText(t, line.result)" class="text-muted">
                {{ lootText(t, line.result) }}
              </p>
            </li>
          </ol>
        </template>
      </UCollapsible>
    </template>
  </UCard>
</template>
