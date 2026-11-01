<script setup lang="ts">
/** The sheet's dialogs and side panels; one at a time (useSheetUi). Each mounts only while open. */
const ui = useSheetUi()
const { editable } = useSheet()
</script>

<template>
  <SheetRollDialog v-if="ui.panel === 'roll-dialog'" />
  <SheetRollLog v-if="ui.panel === 'log'" />
  <SheetDiceTray v-if="ui.panel === 'dice'" />
  <SheetMobileMenu v-if="ui.panel === 'menu'" />
  <template v-if="editable">
    <SheetRestMenu v-if="ui.panel === 'rest'" />
    <SheetConditions v-if="ui.panel === 'conditions'" />
    <SheetSettings v-if="ui.panel === 'settings'" />
    <SheetColorPicker v-if="ui.panel === 'color'" />
    <SheetEquipmentManager v-if="ui.panel === 'equipment'" />
    <SheetPowerManager v-if="ui.panel === 'powers'" />
  </template>
</template>
