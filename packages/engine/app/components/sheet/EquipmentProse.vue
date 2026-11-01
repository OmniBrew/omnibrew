<script setup lang="ts">
/** An owned item's prose: its record's (custom items have none) and the player's notes. */
const props = defineProps<{ uuid: string }>()
const { sheet } = useSheet()

const entry = computed(() => sheet.value.character.equipment.find(e => e.uuid === props.uuid))
const collection = computed(() => {
  const kind = entry.value?.kind
  return kind ? (sheet.value.game.def.sources ? Object.entries(sheet.value.game.def.sources).find(([, s]) => s.itemKind === kind)?.[0] : undefined) : undefined
})
</script>

<template>
  <div v-if="entry">
    <SheetProse v-if="collection && !entry.custom" :id="entry.id" :collection="collection" />
    <p v-if="entry.notes" class="mt-2 whitespace-pre-line text-muted">
      {{ entry.notes }}
    </p>
  </div>
</template>
