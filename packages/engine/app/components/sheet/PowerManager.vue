<script setup lang="ts">
/** The sheet's power manager: the power picker in a side panel. */
const { t } = useI18n()
const ui = useSheetUi()
const open = ui.model('powers')
</script>

<template>
  <USlideover v-model:open="open" :title="t('sheet.powers.manage')" :ui="{ content: 'max-w-xl' }">
    <template #body>
      <SheetPowerPicker />
    </template>
  </USlideover>
</template>
