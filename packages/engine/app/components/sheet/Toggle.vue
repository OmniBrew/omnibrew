<script setup lang="ts">
/** A card's toggle (a chip with a switch inside: "Sneak Attack 1d6") and its options. Turning it runs its resource effects. */
import { actions, type Rec } from '@omnibrew/engine/rules'

const props = defineProps<{ toggle: Rec, label: string }>()

const { t } = useI18n()
const { character, editable, apply } = useSheet()

const on = computed(() => Boolean(character.value.state.toggles[props.toggle.id]))
const options = computed(() => (props.toggle.options ?? []) as Rec[])
const selected = computed(() => actions.toggleSelection(character.value, props.toggle))

const set = (value: boolean) => apply(s => actions.setToggle(s, props.toggle, value))
const pick = (id: string) => apply(s => actions.setToggleSelection(s.character, props.toggle.id, id))
</script>

<template>
  <div class="flex flex-wrap items-center gap-2" :data-toggle="toggle.id">
    <label class="inline-flex h-7 items-center gap-2 rounded-sm px-2 font-label text-[0.8125rem] font-semibold ring-1 transition-colors" :class="on ? 'bg-primary/10 text-primary ring-primary/55' : 'text-default ring-accented'">
      <USwitch :model-value="on" :disabled="!editable" size="sm" :aria-label="toggle.label || label" @update:model-value="set" />
      {{ toggle.label || label }}
    </label>
    <USelect
      v-if="options.length > 1"
      :model-value="selected?.id"
      :items="options.map(o => ({ label: o.label ?? o.name ?? o.id, value: o.id }))"
      :disabled="!editable"
      size="sm"
      class="min-w-36"
      :aria-label="t('sheet.toggle.option', { name: toggle.label || label })"
      @update:model-value="v => pick(String(v))"
    />
  </div>
</template>
