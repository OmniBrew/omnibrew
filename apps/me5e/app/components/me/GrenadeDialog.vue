<script setup lang="ts">
/**
 * A grenade named in a stat block: `<MeGrenadeDialog id="frag-grenade" mark="iii" />`
 * reads "frag grenade III". Clicking it shows that mark's rules (the grenade's
 * `subsets` entry `<id>-<mark>`), or the whole grenade when there is no mark,
 * with a link to its page.
 */
const props = defineProps<{
  id: string
  /** Lower-case roman numeral (`marks.*` message). */
  mark?: string
}>()

const { t } = useI18n()
const open = ref(false)
const { data: grenade } = useAsyncData(`me:gear:${props.id}`, () => queryCollection('gear').path(`/gear/${props.id}`).first())

const subset = computed(() => (props.mark ? grenade.value?.subsets?.find(s => s.id === `${props.id}-${props.mark}`) : undefined))
const name = computed(() => (grenade.value?.name ?? props.id.replace(/-/g, ' ')).toLowerCase())
const text = computed(() => (props.mark ? t('grenade_name_w_mark', { name: name.value, mark: t(`marks.${props.mark}`) }) : name.value))
</script>

<template>
  <UModal v-model:open="open" :title="subset?.name ?? grenade?.name ?? text">
    <button type="button" class="cursor-pointer font-medium italic text-primary hover:underline">
      {{ text }}
    </button>
    <template #body>
      <div v-if="grenade" class="space-y-3 text-sm">
        <ItemSubtitle
          v-if="subset"
          :text="gearSubtitle(t, { ...grenade, rarity: subset.rarity })"
          :cost="subset.cost"
          :text-class="rarityClass(subset.rarity)"
        />
        <MDC v-if="subset?.html" :value="subset.html" tag="div" />
        <MeGearInfo v-else :gear="grenade" summary />
      </div>
      <UIcon v-else name="i-lucide-loader-circle" class="size-6 animate-spin text-muted" />
    </template>
    <template #footer>
      <UButton :to="`/gear/${id}`" variant="link" :label="t('buttons.view_details')" trailing-icon="i-lucide-arrow-right" @click="open = false" />
    </template>
  </UModal>
</template>
