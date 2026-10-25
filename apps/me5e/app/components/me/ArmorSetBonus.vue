<script setup lang="ts">
/** The bonuses of an armor set (a `setBonuses` record): "(2 of 4): …" per threshold. */
const props = defineProps<{ set: string }>()
const { t } = useI18n()

// The 24 sets are small; every armor row on a page shares one query.
const { data: sets } = useAsyncData('me:set-bonuses', () => queryCollection('setBonuses').all(), { default: () => [] })
const bonus = computed(() => sets.value.find(s => recordId(s) === props.set))
</script>

<template>
  <section v-if="bonus" class="text-sm">
    <h4 class="font-display text-xs font-semibold uppercase tracking-wider text-muted">
      {{ t('set_bonus') }}
    </h4>
    <ul class="mt-1 space-y-1">
      <li v-for="b in bonus.bonuses" :key="b.threshold">
        <span class="font-semibold">{{ t('set_bonus_range', { min: b.threshold, max: bonus.max }) }}</span>
        {{ ' ' }}<MDC :value="b.text" tag="span" unwrap="p" />
      </li>
    </ul>
  </section>
</template>
