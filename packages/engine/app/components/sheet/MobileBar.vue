<script setup lang="ts">
/** The phone sheet's bottom bar (design notes): Roll (dice tray), Menu (log, rests, conditions), Settings. */
const { t } = useI18n()
const { editable } = useSheet()
const ui = useSheetUi()
</script>

<template>
  <nav class="fixed inset-x-0 bottom-0 z-30 grid grid-cols-3 border-t border-default bg-default/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden" :aria-label="t('sheet.menu.title')">
    <button type="button" class="flex h-14 flex-col items-center justify-center gap-0.5 font-label text-xs font-semibold text-default hover:text-primary" @click="ui.open('dice')">
      <UIcon name="i-lucide-dices" class="size-5" />{{ t('sheet.mobile.roll') }}
    </button>
    <button type="button" class="flex h-14 flex-col items-center justify-center gap-0.5 font-label text-xs font-semibold text-default hover:text-primary" @click="ui.open('menu')">
      <UIcon name="i-lucide-layout-grid" class="size-5" />{{ t('sheet.mobile.menu') }}
    </button>
    <button type="button" class="flex h-14 flex-col items-center justify-center gap-0.5 font-label text-xs font-semibold text-default hover:text-primary disabled:opacity-45" :disabled="!editable" @click="ui.open('settings')">
      <UIcon name="i-lucide-sliders-horizontal" class="size-5" />{{ t('sheet.mobile.settings') }}
    </button>
  </nav>
</template>
