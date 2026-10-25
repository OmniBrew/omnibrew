<script setup lang="ts">
/**
 * MDC inline component for conditions: `:condition{id="primed" sub="necrotic"}`.
 * `id` is a conditions record; `sub` a variant (a prime's damage type); `label` replaces the text.
 * Clicking it shows the condition's rules, with a link to its page.
 */
const props = defineProps<{
  id: string
  sub?: string
  label?: string
}>()

const { t } = useI18n()
const { game } = useAppConfig()
const open = ref(false)
const text = computed(() => props.label || (props.sub ? `${props.id}: ${props.sub}` : props.id))
const page = recordPath(game.routes, 'conditions', { id: props.id })

// Loaded when first opened, so pages don't carry every condition they mention.
const { data: condition, execute } = useAsyncData(`condition:${props.id}`, () =>
  queryCollection('conditions').path(`/conditions/${props.id}`).first(), { immediate: false, server: false })
watch(open, (isOpen) => {
  if (isOpen && !condition.value) execute()
})
</script>

<template>
  <UModal v-model:open="open" :title="condition?.name ?? text">
    <button type="button" class="cursor-pointer font-medium text-primary hover:underline">
      {{ text }}
    </button>
    <template #body>
      <ConditionInfo v-if="condition" :condition="condition" />
      <UIcon v-else name="i-lucide-loader-circle" class="size-6 animate-spin text-muted" />
    </template>
    <template v-if="page" #footer>
      <UButton :to="page" variant="link" :label="t('buttons.view_details')" trailing-icon="i-lucide-arrow-right" @click="open = false" />
    </template>
  </UModal>
</template>
