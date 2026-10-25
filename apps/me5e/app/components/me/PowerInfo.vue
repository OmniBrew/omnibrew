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
            <img :src="`/images/classes/${k}.svg`" :alt="k" class="size-8">
          </NuxtLink>
        </span>
      </StatItem>
    </template>

    <section v-if="advancements.length" class="mt-6">
      <h3 class="mb-3 font-display text-lg font-semibold text-highlighted">
        {{ t('advancement_options_title') }}
      </h3>
      <div class="grid gap-3 md:grid-cols-2">
        <UCard v-for="a in advancements" :key="a.id" variant="outline" :ui="{ body: 'p-4 sm:p-4' }">
          <p class="font-semibold text-highlighted">
            {{ a.name }}
          </p>
          <MDC :value="a.text" tag="div" class="mt-1 text-sm" />
        </UCard>
      </div>
    </section>
  </PowerInfo>
</template>
