<script setup lang="ts">
/**
 * The roll dialog (B62): an attack's per-attack questions ("Is the target marked?")
 * with what a yes adds, and advantage or disadvantage. The hit and damage rolled
 * include the answers (rules `withAnswers`).
 */
import { withAnswers } from '@omnibrew/engine/rules'

const { t } = useI18n()
const ui = useSheetUi()
const { sheet } = useSheet()
const rolls = useSheetRolls()

const pending = computed(() => ui.arg as PendingAttack)
const open = ui.model('roll-dialog')
const options = computed(() => sheet.value.card(pending.value.card).options ?? [])
const answers = ref<boolean[]>(options.value.map(() => false))
const mode = ref<RollMode>(pending.value.mode)

const card = computed(() => withAnswers(pending.value.card, answers.value))
const resolved = computed(() => sheet.value.card(card.value))

function roll() {
  rolls.rollAttack(pending.value.label, resolved.value, mode.value, critDie(card.value))
  ui.close()
}
</script>

<template>
  <UModal v-model:open="open" :title="pending.label" :description="t('sheet.roll.dialog_text')">
    <template #body>
      <div class="flex flex-col gap-4">
        <fieldset v-if="options.length" class="flex flex-col gap-2">
          <legend class="eyebrow mb-1 text-muted">
            {{ t('sheet.roll.questions') }}
          </legend>
          <UCheckbox
            v-for="(o, i) in options"
            :key="i"
            v-model="answers[i]"
            :label="o.ask"
            :description="[o.hit ? t('sheet.roll.adds_hit', { n: signed(o.hit) }) : '', o.dc ? t('sheet.roll.adds_dc', { n: signed(o.dc) }) : '', o.damage ? t('sheet.roll.adds_damage', { damage: o.damage }) : ''].filter(Boolean).join(' · ')"
          />
        </fieldset>
        <fieldset>
          <legend class="eyebrow mb-1 text-muted">
            {{ t('sheet.roll.mode') }}
          </legend>
          <URadioGroup
            v-model="mode"
            orientation="horizontal"
            :items="[{ label: t('sheet.roll.normal'), value: null }, { label: t('sheet.roll.advantage'), value: 'advantage' }, { label: t('sheet.roll.disadvantage'), value: 'disadvantage' }]"
          />
        </fieldset>
        <p class="flex flex-wrap items-center gap-3 text-sm">
          <span v-if="resolved.hit">{{ t('sheet.roll.to_hit') }} <span class="font-mono font-semibold text-highlighted">{{ signed(resolved.hit.bonus) }}</span></span>
          <span v-if="resolved.dc">{{ t('sheet.dc', { dc: resolved.dc.target }) }}</span>
          <span v-for="(d, i) in resolved.damages ?? []" :key="i" class="font-mono text-highlighted">{{ Object.values(d.types).map(v => damageNotation(v)).join(' + ') }}</span>
        </p>
      </div>
    </template>
    <template #footer>
      <div class="flex w-full justify-end gap-2">
        <UButton :label="t('characters.cancel')" color="neutral" variant="ghost" @click="ui.close()" />
        <UButton :label="resolved.hit ? t('sheet.roll.roll_attack') : t('sheet.roll.roll_damage')" icon="i-lucide-dices" @click="resolved.hit ? roll() : (rolls.damage(pending.label, resolved.damages ?? [], { addCritDie: critDie(card) }), ui.close())" />
      </div>
    </template>
  </UModal>
</template>
