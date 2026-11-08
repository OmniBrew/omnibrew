<script setup lang="ts">
/**
 * Bookmark or unbookmark one record (plan/26 §1.1). Rendered in the browser only (the
 * prerendered page is the same for everyone); the server and the first client render show
 * the same button, disabled, so nothing shifts. Uses only the bookmarks store: a signed-out
 * reader keeps bookmarks in this browser and never loads Amplify.
 */
const props = withDefaults(defineProps<{
  /** The record's collection (`powers`). */
  type: string
  recordId: string
  /** A record with no content file (a generated NPC) keeps its data on the bookmark. */
  data?: unknown
  size?: 'xs' | 'sm' | 'md'
}>(), { data: undefined, size: 'md' })

const { t } = useI18n()
const toast = useToast()
const bookmarks = useBookmarks()
const mounted = ref(false)
onMounted(() => {
  mounted.value = true
  bookmarks.load()
})

const on = computed(() => mounted.value && bookmarks.has(props.type, props.recordId))
const busy = computed(() => bookmarks.pending.has(`${props.type}/${props.recordId}`) || bookmarks.status === 'loading')

async function toggle() {
  try {
    await bookmarks.toggle(props.type, props.recordId, props.data)
  }
  catch {
    toast.add({ title: t('bookmarks.save_failed'), color: 'error', icon: 'i-lucide-circle-alert' })
  }
}
</script>

<template>
  <UButton
    :size="size"
    :variant="on ? 'soft' : 'outline'"
    :icon="on ? 'i-lucide-bookmark-check' : 'i-lucide-bookmark'"
    :label="on ? t('bookmarks.bookmarked') : t('buttons.add_bookmark')"
    :aria-pressed="on"
    :disabled="!mounted"
    :loading="mounted && busy"
    data-bookmark
    @click="toggle"
  />
</template>
