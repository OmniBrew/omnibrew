<script setup lang="ts">
/**
 * One choice in the builder: chips to pick records, skills, tools or weapon types (up to
 * the number wanted), or ability chips for an ability increase (+1 per click, up to the
 * choice's max). Missing picks show as a warning count.
 */
import type { ChoiceValue } from '@omnibrew/engine/character'
import { setChoice, toggleAsi, type ChoiceView } from '@omnibrew/engine/rules'

const props = defineProps<{ view: ChoiceView }>()
const { t, te } = useI18n()
const { sheet, store } = useSheet()

const key = (v: ChoiceValue) => (typeof v === 'string' ? v : JSON.stringify(v))
const pickedKeys = computed(() => new Set(props.view.picked.map(key)))
const source = computed(() => {
  // "species/asari/traits/biotic-heritage" → the trait or record that offers it.
  const parts = props.view.point.mechanic.source?.split('/') ?? []
  for (let i = parts.length - 1; i > 0; i--) {
    const record = sheet.value.content.get(parts[i - 1] === 'class' ? 'classes' : parts[i - 1] === 'species' ? 'species' : parts[i - 1] === 'background' ? 'backgrounds' : parts[i - 1]!, parts[i]!)
      ?? sheet.value.content.get('class-features', parts[i]!) ?? sheet.value.content.get('traits', parts[i]!)
    if (record?.name) return String(record.name)
  }
  return ''
})
const title = computed(() => {
  const v = props.view
  if (v.label) return v.label
  return te(`builder.choice.${v.point.key}`) ? t(`builder.choice.${v.point.key}`, { n: v.needed }, v.needed) : t('builder.choice.model', { n: v.needed }, v.needed)
})

function set(values: ChoiceValue[]) {
  store.replace(setChoice(store.character!, props.view.point.path, values))
}
function toggle(value: ChoiceValue) {
  const k = key(value)
  if (pickedKeys.value.has(k)) return set(props.view.picked.filter(v => key(v) !== k))
  if (props.view.needed === 1) return set([value])
  if (props.view.picked.length < props.view.needed) set([...props.view.picked, value])
}

const amount = (a: string) => props.view.picked.find((v): v is { ability: string, amount: number } => typeof v === 'object' && 'ability' in v && v.ability === a)?.amount ?? 0
const many = computed(() => props.view.items.length > 24)
const search = ref('')
const shown = computed(() => (many.value && search.value ? props.view.items.filter(i => i.label.toLowerCase().includes(search.value.toLowerCase()) || pickedKeys.value.has(key(i.value))) : props.view.items))
</script>

<template>
  <fieldset class="rounded-md border border-default bg-default p-3" :data-choice="view.point.path">
    <legend class="sr-only">
      {{ title }}
    </legend>
    <div class="mb-2 flex flex-wrap items-center gap-2">
      <span class="font-label text-sm font-semibold text-highlighted">{{ title }}</span>
      <span v-if="source" class="text-xs text-muted">{{ source }}</span>
      <UBadge v-if="view.missing" :label="t('builder.missing', { n: view.missing })" color="warning" variant="soft" size="sm" />
      <UIcon v-else name="i-lucide-circle-check" class="size-4 text-success" />
    </div>

    <div v-if="view.kind === 'asi'" class="flex flex-wrap gap-1.5">
      <button
        v-for="a in view.abilities"
        :key="a"
        type="button"
        class="inline-flex h-8 items-center gap-1.5 rounded-sm px-2 font-label text-[0.8125rem] font-semibold ring-1 transition-colors max-sm:h-10"
        :class="amount(a) ? 'bg-primary/10 text-primary ring-primary/55' : 'text-default ring-accented hover:bg-elevated'"
        :aria-pressed="amount(a) > 0"
        @click="set(toggleAsi(view, a))"
      >
        <span v-if="amount(a)" class="font-mono">+{{ amount(a) }}</span>{{ t(`abilities.${a}.title`) }}
      </button>
    </div>

    <template v-else>
      <UInput v-if="many" v-model="search" icon="i-lucide-search" :placeholder="t('search')" size="sm" class="mb-2 w-full sm:w-64" />
      <div class="flex max-h-72 flex-wrap gap-1.5 overflow-y-auto p-0.5">
        <button
          v-for="item in shown"
          :key="key(item.value)"
          type="button"
          class="inline-flex h-8 items-center rounded-sm px-2 text-start font-label text-[0.8125rem] font-semibold ring-1 transition-colors disabled:opacity-45 max-sm:h-10"
          :class="pickedKeys.has(key(item.value)) ? 'bg-primary/10 text-primary ring-primary/55' : 'text-default ring-accented hover:bg-elevated'"
          :aria-pressed="pickedKeys.has(key(item.value))"
          :disabled="item.disabled && !pickedKeys.has(key(item.value))"
          @click="toggle(item.value)"
        >
          {{ item.label }}
        </button>
        <p v-if="!view.items.length" class="text-sm text-muted">
          {{ t('builder.no_options') }}
        </p>
      </div>
    </template>
  </fieldset>
</template>
