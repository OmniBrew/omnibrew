<script setup lang="ts">
/**
 * A reputation benefit: its name with the Paragon and/or Renegade emblem of
 * the side it needs, its prerequisite and reputation threshold, and its text.
 */
const props = defineProps<{
  benefit: { stem: string, name?: string | null, threshold?: number | null, prereq?: BenefitPrereq | null, body?: unknown }
}>()

const { t } = useI18n()
const side = computed(() => benefitSide(props.benefit.prereq))
const emblems = computed(() => (side.value === 'balanced' ? ['paragon', 'renegade'] : [side.value]))
</script>

<template>
  <UCard :id="recordId(benefit)" variant="outline" class="h-full scroll-mt-24" :ui="{ body: 'p-4 sm:p-4' }">
    <div class="flex items-start gap-3">
      <div class="flex shrink-0 -space-x-2">
        <img v-for="e in emblems" :key="e" :src="`/images/misc/${e}.png`" :alt="t(`benefits.${e}`)" class="size-10 rounded-full">
      </div>
      <div class="min-w-0">
        <h3 class="font-display text-xl font-semibold text-highlighted">
          {{ benefit.name }}
        </h3>
        <p class="text-xs uppercase tracking-wider" :class="side === 'renegade' ? 'text-secondary' : side === 'paragon' ? 'text-primary' : 'text-muted'">
          {{ t(`benefits.${side}`) }}
        </p>
      </div>
    </div>
    <dl class="mt-3 space-y-0.5 text-sm">
      <div>
        <dt class="inline font-semibold">
          {{ t('benefits.threshold') }}:
        </dt>
        <dd class="inline">
          {{ benefit.threshold }}
        </dd>
      </div>
      <div>
        <dt class="inline font-semibold">
          {{ t('prerequisite_title') }}:
        </dt>
        <dd class="inline">
          {{ benefitPrereqText(t, benefit.prereq) }}
        </dd>
      </div>
    </dl>
    <ContentRenderer v-if="benefit.body" :value="benefit" class="mt-3 text-sm" />
  </UCard>
</template>
