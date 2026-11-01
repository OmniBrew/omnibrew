<script setup lang="ts">
/** The player's notes (plain text, saved with the character like any change). */
const { t } = useI18n()
const { character, editable, store } = useSheet()

const notes = computed({
  get: () => character.value.details.notes,
  set: (value: string) => {
    const c = character.value
    store.replace({ ...c, details: { ...c.details, notes: value } })
  },
})
</script>

<template>
  <div>
    <UTextarea v-if="editable" v-model="notes" :rows="12" autoresize :placeholder="t('sheet.notes.placeholder')" :aria-label="t('notes_title')" class="w-full" />
    <p v-else-if="notes" class="whitespace-pre-line text-sm">
      {{ notes }}
    </p>
    <p v-else class="text-sm text-muted">
      {{ t('sheet.notes.empty') }}
    </p>
  </div>
</template>
