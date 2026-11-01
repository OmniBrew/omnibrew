<script setup lang="ts">
/**
 * Sheet color (B81, the `sheet-accents` board): "Match my class" on top, then the
 * game's accents in two columns, each with its 22 px icon and a color chip drawn in
 * its own palette (`data-accent` on the chip). Saved per character as `sheetColor`.
 */
import { actions } from '@omnibrew/engine/rules'

const { t, te } = useI18n()
const { game } = useAppConfig()
const ui = useSheetUi()
const { sheet, character, apply } = useSheet()
const open = ui.model('color')

const theme = computed(() => game.theme as SheetTheme)
const firstClass = computed(() => sheet.value.classes[0])
const matching = computed(() => !character.value.sheetColor || !theme.value.accents.includes(character.value.sheetColor))
const current = computed(() => sheetAccent(character.value, theme.value))

const label = (id: string) => sheet.value.content.get('classes', id)?.name ?? (te(`sheet_color.${id}`) ? t(`sheet_color.${id}`) : id)
const icon = (id: string) => (game.sheet.accentIcons as Record<string, string>)[id] ?? (game.sheet.classIcon && sheet.value.content.get('classes', id) ? game.sheet.classIcon.replace('{id}', id) : '')

const set = (id: string | null) => apply(s => actions.edit(s.character, (c) => {
  if (id) c.sheetColor = id
  else delete c.sheetColor
}))
</script>

<template>
  <UModal v-model:open="open" :title="t('sheet_color.title')">
    <template #body>
      <div class="flex flex-col gap-4">
        <USwitch
          :model-value="matching"
          :label="t('sheet_color.match_class')"
          :description="firstClass ? t('sheet_color.match_class_detail', { class: firstClass.data.name }) : undefined"
          @update:model-value="v => set(v ? null : (current ?? theme.defaultAccent))"
        />
        <div class="grid grid-cols-2 gap-2" role="radiogroup" :aria-label="t('sheet_color.title')">
          <button
            v-for="id in theme.accents"
            :key="id"
            type="button"
            role="radio"
            :aria-checked="current === id && !matching ? 'true' : 'false'"
            class="flex h-11 items-center gap-2 rounded-sm border px-2 text-start text-sm transition-colors focus-visible:outline-2 focus-visible:outline-primary"
            :class="current === id ? 'border-primary bg-primary/10 text-highlighted' : 'border-default hover:bg-elevated'"
            @click="set(id)"
          >
            <img v-if="icon(id)" :src="icon(id)" alt="" class="size-5.5 shrink-0">
            <span class="flex-1 truncate">{{ label(id) }}</span>
            <span :data-accent="id" class="size-4 shrink-0 rounded-xs bg-primary ring-1 ring-default" />
          </button>
        </div>
      </div>
    </template>
    <template #footer>
      <div class="flex w-full justify-between gap-2">
        <UButton :label="t('sheet_color.reset')" color="neutral" variant="ghost" :disabled="matching" @click="set(null)" />
        <UButton :label="t('sheet_color.done')" @click="ui.close()" />
      </div>
    </template>
  </UModal>
</template>
