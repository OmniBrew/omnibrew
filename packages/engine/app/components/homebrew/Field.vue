<script setup lang="ts">
/**
 * One field of a homebrew form (plan/26 §1.3), from the game's form data: reads its value at
 * `field.path` in `record` and emits the whole record with the new value (empty values are
 * dropped). Errors from `validateRecord` show under it.
 */
import type { FieldDef } from '@omnibrew/engine/schemas'
import { getPath, setPath } from '../../utils/homebrew'

const props = defineProps<{ field: FieldDef, record: Record<string, unknown>, errors?: string[] }>()
const emit = defineEmits<{ update: [record: Record<string, unknown>] }>()

const { t, te } = useI18n()
const options = useHomebrewOptions()
const value = computed(() => getPath(props.record, props.field.path))
const set = (v: unknown) => emit('update', setPath(props.record, props.field.path, v))
const input = computed(() => props.field.input)
const error = computed(() => props.errors?.length ? props.errors.join(' · ') : undefined)
const label = computed(() => t(props.field.label) + (props.field.required ? ' *' : ''))

const items = computed(() => {
  const i = input.value
  if (i.kind === 'enum') return options.enumItems(i.enum, i.labels)
  if (i.kind === 'choice') return i.options.map(v => ({ value: v, label: options.valueLabel(v, i.labels) }))
  if (i.kind === 'record') return options.recordItems(i.collection)
  return []
})
const multiple = computed(() => 'multiple' in input.value && Boolean(input.value.multiple))
const listValue = computed(() => (Array.isArray(value.value) ? value.value as Array<string | number> : []))
const num = (v: unknown) => (v === null || v === undefined || v === '' ? undefined : Number(v))
</script>

<template>
  <UFormField :label="label" :help="field.help && te(field.help) ? t(field.help) : undefined" :error="error" :name="field.path" :data-field="field.path">
    <UInput v-if="input.kind === 'text' && !input.long" :model-value="String(value ?? '')" :placeholder="input.placeholder" class="w-full" @update:model-value="v => set(String(v))" />
    <UTextarea v-else-if="input.kind === 'text'" :model-value="String(value ?? '')" :rows="3" autoresize class="w-full" @update:model-value="v => set(String(v))" />
    <HomebrewMarkdown v-else-if="input.kind === 'markdown'" :model-value="String(value ?? '')" @update:model-value="set" />
    <UInputNumber
      v-else-if="input.kind === 'number'"
      :model-value="(value as number | undefined) ?? null"
      :min="input.min"
      :max="input.max"
      :step="input.step ?? 1"
      class="w-40"
      @update:model-value="v => set(num(v))"
    />
    <USwitch v-else-if="input.kind === 'boolean'" :model-value="Boolean(value)" @update:model-value="v => set(v ? true : undefined)" />
    <USelectMenu
      v-else-if="(input.kind === 'enum' || input.kind === 'choice' || input.kind === 'record') && multiple"
      :model-value="listValue"
      :items="items"
      value-key="value"
      multiple
      class="w-full"
      @update:model-value="v => set(v)"
    />
    <USelectMenu
      v-else-if="input.kind === 'enum' || input.kind === 'choice' || input.kind === 'record'"
      :model-value="(value as string | number | undefined)"
      :items="items"
      value-key="value"
      :placeholder="t('homebrew.none')"
      class="w-full"
      @update:model-value="v => set(v)"
    >
      <template v-if="!field.required && value !== undefined" #trailing>
        <UButton size="xs" color="neutral" variant="link" icon="i-lucide-x" :aria-label="t('homebrew.clear')" @click.stop="set(undefined)" />
      </template>
    </USelectMenu>
    <HomebrewFormula v-else-if="input.kind === 'formula'" :model-value="value" @update:model-value="set" />
    <HomebrewDamageList v-else-if="input.kind === 'damage-list'" :model-value="value" :max="input.max" @update:model-value="set" />
    <HomebrewProperties v-else-if="input.kind === 'properties'" :model-value="value" :collection="input.collection" @update:model-value="set" />
    <HomebrewResource v-else-if="input.kind === 'resource'" :model-value="value" @update:model-value="set" />
    <HomebrewAttack v-else-if="input.kind === 'attack'" :model-value="value" :record="record" @update:model-value="set" />
    <HomebrewSave v-else-if="input.kind === 'save'" :model-value="value" @update:model-value="set" />
  </UFormField>
</template>
