<script setup lang="ts">
/**
 * The loot generator (the live /generators/loot): credits for one creature, or a hoard
 * that rolls on the equipment tables, by challenge rating band. The tables are content
 * (`loot-rewards`, `loot-tables`), read from the rules bundle; rewards stay on the page.
 * Client-only (routeRules), prerendered as an empty shell.
 */
import { lootData, rollLoot, type LootData, type LootResult } from '../../../generators/loot'
import { cryptoRandom } from '../../../generators/random'

const { t } = useI18n()
useSeoMeta({ title: t('loot_generator_title'), description: t('loot.meta') })

const status = ref<'loading' | 'ready' | 'error'>('loading')
const data = shallowRef<LootData>()
async function load() {
  status.value = 'loading'
  try {
    const { records } = await useRules()
    data.value = lootData(records)
    band.value = data.value.rewards[0]?.id
    status.value = 'ready'
  }
  catch {
    status.value = 'error'
  }
}
onMounted(() => void load())

const band = ref<string>()
const hoard = ref(false)
const showTables = ref(false)
const bandItems = computed(() => (data.value?.rewards ?? []).map(r => ({ label: r.name, value: r.id })))

let next = 0
const rewards = ref<{ key: number, loot: LootResult }[]>([])
function generate() {
  if (!data.value || !band.value) return
  rewards.value = [...rewards.value, { key: next++, loot: rollLoot(data.value, { band: band.value, hoard: hoard.value }, cryptoRandom()) }]
}
const remove = (key: number) => {
  rewards.value = rewards.value.filter(r => r.key !== key)
}
</script>

<template>
  <UPage>
    <RecordHeader :title="t('loot_generator_title')" :headline="t('generators_title')" />
    <UPageBody>
      <div class="flex flex-wrap items-start justify-between gap-3">
        <p class="max-w-prose">
          {{ t('loot.intro') }}
        </p>
        <UButton icon="i-lucide-table" variant="outline" :label="t('loot.raw_tables')" :disabled="status !== 'ready'" @click="showTables = true" />
      </div>

      <UAlert
        v-if="status === 'error'"
        color="error"
        variant="subtle"
        icon="i-lucide-circle-alert"
        :title="t('loot.load_failed')"
        :actions="[{ label: t('loot.retry'), onClick: () => load() }]"
        class="mt-6"
      />

      <UCard variant="subtle" class="mt-6">
        <h2 class="eyebrow mb-3 text-muted">
          {{ t('loot.options_title') }}
        </h2>
        <div class="flex flex-wrap items-end gap-4">
          <UFormField :label="t('loot.band')" class="w-full sm:w-56">
            <USelect v-model="band" :items="bandItems" :disabled="status !== 'ready'" class="w-full" />
          </UFormField>
          <USwitch v-model="hoard" :label="t('loot.hoard')" class="sm:pb-2" />
          <UButton
            icon="i-lucide-dices"
            :label="t('loot.generate')"
            :loading="status === 'loading'"
            :disabled="status !== 'ready' || !band"
            class="w-full justify-center sm:ms-auto sm:w-auto"
            data-generate
            @click="generate"
          />
        </div>
      </UCard>

      <section class="mt-8" aria-live="polite">
        <p v-if="!rewards.length && status === 'ready'" class="rounded-md border border-dashed border-default p-8 text-center text-muted">
          {{ t('loot.empty') }}
        </p>
        <template v-else-if="data">
          <div class="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            <MeGeneratorsLootReward v-for="(r, i) in rewards" :key="r.key" :loot="r.loot" :data="data" :n="i + 1" @remove="remove(r.key)" />
          </div>
          <div class="mt-6 flex justify-center">
            <UButton color="neutral" variant="outline" icon="i-lucide-trash-2" :label="t('loot.clear')" @click="rewards = []" />
          </div>
        </template>
      </section>

      <UModal v-model:open="showTables" :title="t('loot.raw_tables_title')" fullscreen>
        <template #body>
          <MeGeneratorsLootTables v-if="data" :data="data" />
        </template>
      </UModal>
    </UPageBody>
  </UPage>
</template>
