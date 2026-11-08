<script setup lang="ts">
/** A record's prose on the sheet, from its collection's prose file (fetched on first use), with a link to its page (`link`, on by default). */
const props = withDefaults(defineProps<{ collection: string, id: string, link?: boolean }>(), { link: true })
const { t } = useI18n()
const { game } = useAppConfig()

const body = ref<string | null>(null)
const failed = ref(false)

watch(() => [props.collection, props.id], async () => {
  body.value = null
  failed.value = false
  try {
    body.value = (await useProse(props.collection))[props.id] ?? ''
  }
  catch {
    failed.value = true
  }
}, { immediate: true })

const { sheet } = useSheet()
const page = computed(() => {
  if (!props.link) return null
  const record = sheet.value.content.get(props.collection, props.id)
  if (!record) return null
  const path = recordPath(game.routes, props.collection, record)
  return path && !path.includes('//') && !path.endsWith('/') ? path : null
})
</script>

<template>
  <div>
    <USkeleton v-if="body === null && !failed" class="h-12 w-full" />
    <p v-else-if="failed" class="text-error">
      {{ t('sheet.prose_failed') }}
    </p>
    <MDC v-else-if="body" :value="body" class="sheet-prose" />
    <NuxtLink v-if="page" :to="page" target="_blank" class="mt-2 inline-flex items-center gap-1 text-xs text-primary hover:underline">
      {{ t('buttons.view_details') }}<UIcon name="i-lucide-external-link" class="size-3" />
    </NuxtLink>
  </div>
</template>
