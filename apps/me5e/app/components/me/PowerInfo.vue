<script setup lang="ts">
/**
 * An ME5e power: the engine's power info plus primes/detonates, the classes
 * that learn it, and its advancement options.
 */
interface Advancement { id: string, name: string, text: string }
const props = defineProps<{
  power: { level?: number, tags?: string[], casting?: unknown[], classes?: string[], advancements?: Advancement[], body?: unknown }
  hideAdvancements?: boolean
}>()
const { t } = useI18n()
const advancements = computed(() => (props.hideAdvancements ? [] : props.power.advancements ?? []))
</script>

<template>
  <PowerInfo :power="power">
    <template #stats="{ casting }">
      <StatItem :label="t('primes_detonates_title')">
        <MePrimesDetonates :casting="casting" />
      </StatItem>
      <StatItem v-if="power.classes?.length" :label="t('class_title', 2)">
        <span class="flex flex-wrap gap-1">
          <NuxtLink v-for="k in power.classes" :key="k" :to="`/classes/${k}`" :title="k">
            <img :src="`/images/classes/${k}.svg`" :alt="k" class="size-7">
          </NuxtLink>
        </span>
      </StatItem>
    </template>

    <section v-if="advancements.length" class="mt-10">
      <div class="section-rule" />
      <h2 class="mt-4.5 mb-4 text-[1.3125rem]/7 font-bold text-highlighted sm:text-2xl/8">
        {{ t('advancement_options_title') }}
      </h2>
      <div class="grid gap-4 md:grid-cols-2">
        <UCard v-for="a in advancements" :key="a.id" :ui="{ header: 'px-4 py-3 sm:px-4', body: 'p-4 sm:p-4' }">
          <template #header>
            <h3 class="text-[1.1875rem]/[1.625rem] font-semibold text-highlighted">
              {{ a.name }}
            </h3>
          </template>
          <MDC :value="a.text" tag="div" class="text-[0.9375rem]/[1.65] text-default *:first:mt-0 *:last:mb-0" />
        </UCard>
      </div>
    </section>
  </PowerInfo>
</template>
