<script setup lang="ts">
/**
 * The loot generator's raw tables (content `loot-rewards` and `loot-tables`): credits for
 * one creature by band, each band's hoard, then equipment tables A to H.
 */
import { hoardRowText, lootText, rangeText, tableRowText, type LootData } from '../../../../generators/loot'

const props = defineProps<{ data: LootData }>()

const { t } = useI18n()
const text = (msg: Parameters<typeof lootText>[1]) => lootText(t, msg)
const credits = (list: number[]) => `${groupDigits(Math.min(...list), t('digit_separator'))}-${groupDigits(Math.max(...list), t('digit_separator'))}`
const tables = computed(() => Object.values(props.data.tables).sort((a, b) => a.id.localeCompare(b.id)))
</script>

<template>
  <div class="grid gap-8 lg:grid-cols-2">
    <div class="min-w-0 space-y-8">
      <section>
        <h3 class="font-display text-xl font-bold text-highlighted">
          {{ t('loot.individual_title') }}
        </h3>
        <div class="section-rule mt-2 mb-3" />
        <table class="w-full text-sm">
          <thead>
            <tr>
              <th scope="col" class="eyebrow py-1.5 pe-3 text-start text-muted">
                {{ t('loot.headers.cr') }}
              </th>
              <th scope="col" class="eyebrow py-1.5 text-start text-muted">
                {{ t('loot.headers.reward') }}
              </th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="band in data.rewards" :key="band.id" class="border-t border-default">
              <td class="py-1.5 pe-3 font-mono whitespace-nowrap">
                {{ band.name }}
              </td>
              <td class="py-1.5">
                {{ t('loot.log.credits', { n: credits(band.individual) }) }}
              </td>
            </tr>
          </tbody>
        </table>
      </section>

      <section>
        <h3 class="font-display text-xl font-bold text-highlighted">
          {{ t('loot.hoard_title') }}
        </h3>
        <div class="section-rule mt-2 mb-3" />
        <div class="space-y-6">
          <div v-for="band in data.rewards" :key="band.id">
            <h4 class="font-semibold text-highlighted">
              {{ t('loot.band_title', { band: band.name }) }}
            </h4>
            <dl class="mt-1 grid grid-cols-[auto_1fr] gap-x-3 text-sm">
              <dt class="text-muted">
                {{ t('loot.credits') }}
              </dt>
              <dd class="font-mono">
                {{ groupDigits(band.hoard.credits, t('digit_separator')) }}
              </dd>
              <dt class="text-muted">
                {{ t('loot.additional_credits') }}
              </dt>
              <dd class="font-mono">
                {{ credits(band.hoard.additionalCredits) }}
              </dd>
            </dl>
            <table class="mt-2 w-full text-sm">
              <thead>
                <tr>
                  <th scope="col" class="eyebrow w-20 py-1.5 pe-3 text-start text-muted">
                    {{ t('loot.headers.d100') }}
                  </th>
                  <th scope="col" class="eyebrow py-1.5 text-start text-muted">
                    {{ t('loot.headers.hoard_roll') }}
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="row in band.hoard.rolls" :key="row.min" class="border-t border-default">
                  <td class="py-1.5 pe-3 font-mono whitespace-nowrap">
                    {{ rangeText(row) }}
                  </td>
                  <td class="py-1.5">
                    {{ text(hoardRowText(data, row)) }}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </div>

    <section class="min-w-0">
      <h3 class="font-display text-xl font-bold text-highlighted">
        {{ t('loot.equipment_title') }}
      </h3>
      <div class="section-rule mt-2 mb-3" />
      <div class="space-y-6">
        <div v-for="table in tables" :key="table.id">
          <h4 class="font-semibold text-highlighted">
            {{ table.name }}
          </h4>
          <table class="mt-1 w-full text-sm">
            <thead>
              <tr>
                <th scope="col" class="eyebrow w-20 py-1.5 pe-3 text-start text-muted">
                  {{ t('loot.headers.d100') }}
                </th>
                <th scope="col" class="eyebrow py-1.5 text-start text-muted">
                  {{ t('loot.headers.result') }}
                </th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="row in table.rows" :key="row.min" class="border-t border-default">
                <td class="py-1.5 pe-3 font-mono whitespace-nowrap">
                  {{ rangeText(row) }}
                </td>
                <td class="py-1.5">
                  {{ text(tableRowText(data, row)) }}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </section>
  </div>
</template>
