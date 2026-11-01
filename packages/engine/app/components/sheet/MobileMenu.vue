<script setup lang="ts">
/** The phone sheet's menu: what the desktop's character menu and side buttons do. */
const { t } = useI18n()
const ui = useSheetUi()
const { store, editable } = useSheet()
const open = ui.model('menu')

const items = computed(() => [
  ...(editable.value
    ? [
        { label: t('sheet.menu.edit'), icon: 'i-lucide-pencil', to: { path: '/characters/builder', query: { id: store.id } } },
        { label: t('sheet.rest.short'), icon: 'i-lucide-coffee', onClick: () => ui.open('rest', 'short') },
        { label: t('sheet.rest.long'), icon: 'i-lucide-bed', onClick: () => ui.open('rest', 'long') },
        { label: t('conditions_title'), icon: 'i-lucide-activity', onClick: () => ui.open('conditions') },
        { label: t('sheet_color.title'), icon: 'i-lucide-palette', onClick: () => ui.open('color') },
      ]
    : []),
  { label: t('sheet.log.title'), icon: 'i-lucide-scroll-text', onClick: () => ui.open('log') },
  { label: t('characters.title'), icon: 'i-lucide-users', to: '/characters' },
])
</script>

<template>
  <UDrawer v-model:open="open" :title="t('sheet.menu.title')">
    <template #body>
      <div class="grid grid-cols-2 gap-2">
        <UButton v-for="item in items" :key="item.label" :label="item.label" :icon="item.icon" :to="item.to" color="neutral" variant="outline" class="h-12" @click="item.onClick?.()" />
      </div>
    </template>
  </UDrawer>
</template>
