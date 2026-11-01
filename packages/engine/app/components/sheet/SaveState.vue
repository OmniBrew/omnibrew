<script setup lang="ts">
/** Where the open character stands: saved, saving, waiting, failed (with retry), or kept in this browser. */
const { t } = useI18n()
const store = useCharacterStore()

const view = computed(() => {
  if (!store.editable) return null
  switch (store.saveState) {
    case 'saving': return { icon: 'i-lucide-loader-circle', spin: true, text: t('sheet.save.saving'), color: 'text-muted' }
    case 'pending': return { icon: 'i-lucide-cloud', text: t('sheet.save.pending'), color: 'text-muted' }
    case 'error': return { icon: 'i-lucide-cloud-off', text: t('sheet.save.error'), color: 'text-error', retry: true }
    case 'conflict': return { icon: 'i-lucide-git-compare', text: t('sheet.save.conflict'), color: 'text-warning' }
    default: return store.record?.local
      ? { icon: 'i-lucide-hard-drive', text: t('sheet.save.local'), color: 'text-muted' }
      : { icon: 'i-lucide-cloud-check', text: t('sheet.save.saved'), color: 'text-success' }
  }
})
</script>

<template>
  <p v-if="view" class="flex items-center gap-1 text-xs" :class="view.color" role="status" aria-live="polite">
    <UIcon :name="view.icon" class="size-3.5" :class="{ 'animate-spin': view.spin }" />
    <span>{{ view.text }}</span>
    <button v-if="view.retry" type="button" class="underline hover:no-underline" @click="store.flush()">
      {{ t('sheet.save.retry') }}
    </button>
  </p>
</template>
