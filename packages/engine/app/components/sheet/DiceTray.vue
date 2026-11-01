<script setup lang="ts">
/** The dice tray (the live speed dial and custom roll): one die of each size, a count, and any notation (`2d6+3`). */
const { t } = useI18n()
const ui = useSheetUi()
const rolls = useSheetRolls()
const open = ui.model('dice')

const count = ref(1)
const text = ref('')
const valid = computed(() => isNotation(text.value))
const DICE = [4, 6, 8, 10, 12, 20, 100]

function custom() {
  if (!valid.value) return
  rolls.custom(text.value.trim())
}
</script>

<template>
  <UModal v-model:open="open" :title="t('sheet.dice.title')">
    <template #body>
      <div class="flex flex-col gap-4">
        <div class="flex items-center gap-2">
          <span class="eyebrow text-muted">{{ t('sheet.dice.count') }}</span>
          <UInputNumber v-model="count" :min="1" :max="20" class="w-28" />
        </div>
        <div class="grid grid-cols-4 gap-2 sm:grid-cols-7">
          <UButton v-for="d in DICE" :key="d" :label="`d${d}`" color="neutral" variant="outline" class="h-11 justify-center font-mono" @click="rolls.custom(`${count}d${d}`, `${count}d${d}`)" />
        </div>
        <form class="flex gap-2" @submit.prevent="custom">
          <UInput v-model="text" :placeholder="t('sheet.dice.placeholder')" :aria-label="t('sheet.dice.custom')" class="flex-1" :color="text && !valid ? 'error' : undefined" :ui="{ base: 'font-mono' }" />
          <UButton type="submit" :label="t('sheet.dice.roll')" :disabled="!valid" />
        </form>
        <UButton :label="t('sheet.log.title')" icon="i-lucide-scroll-text" color="neutral" variant="ghost" class="self-start" @click="ui.open('log')" />
      </div>
    </template>
  </UModal>
</template>
