<script setup lang="ts">
/**
 * An ME5e power: the engine's power info plus primes/detonates, the classes
 * that learn it, and its advancement options.
 */
interface Advancement { id: string, name: string, text: string }
const props = defineProps<{
  power: { name?: string, level?: number, tags?: string[], casting?: unknown[], classes?: string[], advancements?: Advancement[], body?: unknown }
  hideAdvancements?: boolean
}>()
const { t } = useI18n()
const advancements = computed(() => (props.hideAdvancements ? [] : props.power.advancements ?? []))
/** The damage type a casting primes (`primes: false` turns it off). */
const primes = (casting: unknown) => ((casting as { primes?: string | false }).primes || undefined)
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

    <template #aside="{ casting }">
      <div v-if="primes(casting) || (casting as { detonates?: boolean }).detonates" class="flex flex-col gap-4">
        <aside v-if="primes(casting)" class="rounded-md border border-info/35 bg-info/7 px-4 pt-3 pb-3.5 text-sm" data-power-primer>
          <p class="mb-1.5 flex items-center gap-2 eyebrow text-info">
            <UIcon name="i-lucide-info" class="size-4 shrink-0" />
            {{ t('power_primer_title') }}
          </p>
          <i18n-t keypath="power_primer_text" tag="p" scope="global">
            <template #name>
              {{ power.name }}
            </template>
            <template #type>
              {{ t(`damage_types.${primes(casting)}`) }}
            </template>
            <template #link>
              <NuxtLink to="/manual/powercasting#primers-and-detonators" class="text-primary underline-offset-2 hover:underline">{{ t('power_primers_link') }}</NuxtLink>
            </template>
          </i18n-t>
        </aside>
        <aside v-if="(casting as { detonates?: boolean }).detonates" class="rounded-md border border-info/35 bg-info/7 px-4 pt-3 pb-3.5 text-sm" data-power-detonator>
          <p class="mb-1.5 flex items-center gap-2 eyebrow text-info">
            <UIcon name="i-lucide-info" class="size-4 shrink-0" />
            {{ t('power_detonator_title') }}
          </p>
          <i18n-t keypath="power_detonator_text" tag="p" scope="global">
            <template #name>
              {{ power.name }}
            </template>
            <template #link>
              <NuxtLink to="/manual/powercasting#primers-and-detonators" class="text-primary underline-offset-2 hover:underline">{{ t('power_primers_link') }}</NuxtLink>
            </template>
          </i18n-t>
        </aside>
      </div>
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
