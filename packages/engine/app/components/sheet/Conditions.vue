<script setup lang="ts">
/** The conditions dialog (the live MeCsConditions): a switch per condition (immunities noted), and a level for exhaustion and the game's graded conditions. */
import { actions } from '@omnibrew/engine/rules'

const { t } = useI18n()
const { game } = useAppConfig()
const ui = useSheetUi()
const { sheet, character, apply } = useSheet()
const open = ui.model('conditions')

const gradients = computed(() => actions.gradientConditions(sheet.value))
const immune = computed(() => new Set(sheet.value.defenses['condition-immunity'].map(d => d.id)))
const toggleable = computed(() => sheet.value.content.list(game.sheet.conditions).filter(c => !gradients.value.some(g => g.id === c.id)).sort((a, b) => a.name.localeCompare(b.name)))
const setGradient = (id: string, v: unknown) => apply(s => actions.setGradient(s, id, Number(v)))
const setCondition = (id: string, on: boolean) => apply(s => actions.setCondition(s.character, id, on))
const name = (id: string) => sheet.value.content.get(game.sheet.conditions, id)?.name ?? id
</script>

<template>
  <UModal v-model:open="open" :title="t('conditions_title')">
    <template #body>
      <div class="flex flex-col gap-4">
        <div v-for="g in gradients" :key="g.id" class="flex flex-col gap-1">
          <span class="flex items-center justify-between text-sm"><span class="font-semibold text-highlighted">{{ name(g.id) }}</span><span class="font-mono">{{ g.value }} / {{ g.max }}</span></span>
          <USlider :model-value="g.value" :min="0" :max="g.max" :step="1" :aria-label="name(g.id)" @update:model-value="v => setGradient(g.id, v)" />
        </div>
        <ul class="grid gap-2 sm:grid-cols-2">
          <li v-for="c in toggleable" :key="c.id">
            <USwitch
              :model-value="character.state.conditions.includes(c.id)"
              :label="c.name"
              :description="immune.has(c.id) ? t('sheet.conditions.immune') : undefined"
              @update:model-value="v => setCondition(c.id, !!v)"
            />
          </li>
        </ul>
      </div>
    </template>
  </UModal>
</template>
