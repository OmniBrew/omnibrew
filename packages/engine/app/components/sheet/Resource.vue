<script setup lang="ts">
/**
 * A card's resource tracker (the live MeCsActionResource): uses spent, as checkboxes
 * (`checkbox`) or a counter, with when it resets. A game's display types (ME heat,
 * consumables, barrier) render the component the game registers
 * (`#game-client` `sheet.resources`); unknown types fall back to the counter.
 */
import { actions, type Rec, type SheetCard } from '@omnibrew/engine/rules'
import { sheet as gameSheet } from '#game-client'

const props = defineProps<{ resource: Rec, card?: SheetCard }>()

const { t } = useI18n()
const { sheet, character, editable, apply } = useSheet()

const item = computed<Rec>(() => ({ displayType: 'checkbox', reset: 'long', resetTo: 0, increment: 1, ...props.resource, max: { type: 'flat', value: 1, min: 1, ...(props.resource.max ?? {}) } }))
const id = computed(() => String(props.resource.id ?? ''))
const count = computed(() => Math.floor(Number(character.value.state.resources[id.value]) || 0))
const max = computed(() => sheet.value.formula(item.value.max))

const set = (value: number) => apply(s => actions.setResource(s.character, id.value, Math.max(0, Math.min(value, max.value))))
const add = () => count.value + item.value.increment <= max.value && set(count.value + item.value.increment)
const remove = () => count.value > 0 && set(count.value - 1)
const reset = () => set(item.value.resetTo === 'max' ? max.value : 0)

const gameComponent = computed(() => gameSheet.resources[item.value.displayType] ?? null)
const resetText = computed(() => (item.value.label as string | undefined) ?? (['short', 'long'].includes(item.value.reset) ? t(`sheet.resource.per_${item.value.reset}`) : ''))
</script>

<template>
  <div v-if="id" class="flex items-center gap-1.5" :data-resource="id">
    <component :is="gameComponent" v-if="gameComponent" :id="id" :resource="item" :card="card" :current="count" :max="max" :editable="editable" @set="set" @add="add" @remove="remove" @reset="reset" />
    <template v-else-if="item.displayType === 'checkbox' && max <= 8">
      <UCheckbox
        v-for="n in max"
        :key="n"
        :model-value="count >= n"
        :disabled="!editable"
        :aria-label="t('sheet.resource.use_n', { n, max })"
        @update:model-value="set(count >= n ? n - 1 : n)"
      />
    </template>
    <template v-else>
      <UButton icon="i-lucide-minus" size="xs" color="neutral" variant="outline" :disabled="!editable || count <= 0" :aria-label="t('sheet.resource.less')" @click="remove" />
      <span class="min-w-10 text-center font-mono text-sm tabular-nums text-highlighted">{{ count }}/{{ max }}</span>
      <UButton icon="i-lucide-plus" size="xs" color="neutral" variant="outline" :disabled="!editable || count >= max" :aria-label="t('sheet.resource.more')" @click="add" />
    </template>
    <UButton v-if="item.reset === 'manual' && editable && !gameComponent" icon="i-lucide-rotate-ccw" size="xs" color="neutral" variant="ghost" :aria-label="t('sheet.resource.reset')" @click="reset" />
    <span v-if="resetText" class="text-xs text-muted">{{ resetText }}</span>
  </div>
</template>
