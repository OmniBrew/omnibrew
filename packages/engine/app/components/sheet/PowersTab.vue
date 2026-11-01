<script setup lang="ts">
/**
 * The Powers tab (the live MeCsPowersByLevel): points and slots left, a level filter,
 * and the powers by level. Leveled powers list once per level they upcast to; Cast
 * spends a slot of that level or its level in points.
 */
import { actions } from '@omnibrew/engine/rules'

const { t } = useI18n()
const { sheet, editable, apply } = useSheet()
const ui = useSheetUi()

const pc = computed(() => sheet.value.powercasting)
const points = computed(() => Object.entries(pc.value.points).filter(([, p]) => p.max > 0))
const slots = computed(() => Object.entries(pc.value.slots).filter(([, s]) => s.max > 0).map(([l, s]) => ({ level: Number(l), ...s })))

const level = ref<'all' | number>('all')
const levels = computed(() => [...new Set(sheet.value.powers.map(p => p.level))].sort((a, b) => a - b))
const byLevel = computed(() => levels.value
  .filter(l => level.value === 'all' || l === level.value)
  .map(l => ({ level: l, powers: sheet.value.powers.filter(p => p.level === l && (l === 0 || level.value !== 'all' || !p.upcast)) }))
  .filter(g => g.powers.length))

const spendPoints = (pool: string, n: number) => apply(s => actions.spendPoints(s, pool, n))
/** Clicking slot box `n` marks slots up to it used, or frees it when it already is. */
const clickSlot = (level: number, used: number, n: number) => apply(s => actions.spendSlots(s, level, used >= n ? n - 1 - used : n - used))
const levelName = (l: number) => (l === 0 ? t('sheet.powers.cantrips') : t('level_nth', { nth: t(`ordinal_numbers[${l}]`) }))
const poolName = (id: string) => t(`sheet.powers.pool.${id.replace(':', '_')}`)
const hasCasting = computed(() => sheet.value.classes.some(k => (pc.value.byClass[k.id]?.maxPowerLevel ?? -1) >= 0 || (pc.value.byClass[k.id]?.numCantrips ?? 0) > 0))
</script>

<template>
  <div class="flex flex-col gap-4">
    <div v-if="points.length || slots.length" class="flex flex-wrap gap-3">
      <div v-for="[id, p] in points" :key="id" class="flex items-center gap-2 rounded-sm border border-default bg-default px-3 py-2" :data-sheet="`points.${id}`">
        <span class="eyebrow text-muted">{{ poolName(id) }}</span>
        <UButton icon="i-lucide-minus" size="xs" color="neutral" variant="outline" :disabled="!editable || p.used >= p.max" :aria-label="t('sheet.powers.spend_point')" @click="spendPoints(id, 1)" />
        <span class="font-mono text-sm tabular-nums text-highlighted">{{ p.max - p.used }}/{{ p.max }}</span>
        <UButton icon="i-lucide-plus" size="xs" color="neutral" variant="outline" :disabled="!editable || p.used <= 0" :aria-label="t('sheet.powers.regain_point')" @click="spendPoints(id, -1)" />
        <span v-if="p.limit" class="text-xs text-muted">{{ t('sheet.powers.limit', { n: p.limit }) }}</span>
      </div>
      <div v-for="s in slots" :key="s.level" class="flex items-center gap-2 rounded-sm border border-default bg-default px-3 py-2" :data-sheet="`slots.${s.level}`">
        <span class="eyebrow text-muted">{{ levelName(s.level) }}</span>
        <UCheckbox
          v-for="n in s.max"
          :key="n"
          :model-value="s.used >= n"
          :disabled="!editable"
          :aria-label="t('sheet.powers.slot_n', { n, level: levelName(s.level) })"
          @update:model-value="clickSlot(s.level, s.used, n)"
        />
      </div>
    </div>

    <div class="flex flex-wrap items-center gap-1.5">
      <button
        v-for="l in ['all', ...levels] as const"
        :key="l"
        type="button"
        class="inline-flex h-7 items-center rounded-sm px-2 font-label text-[0.8125rem] font-semibold ring-1 transition-colors max-sm:h-9"
        :class="level === l ? 'bg-primary/10 text-primary ring-primary/55' : 'text-default ring-accented hover:bg-elevated'"
        :aria-pressed="level === l"
        @click="level = l"
      >
        {{ l === 'all' ? t('all_title') : l === 0 ? t('sheet.powers.cantrips') : t(`ordinal_numbers[${l}]`) }}
      </button>
      <UButton v-if="editable && hasCasting" :label="t('sheet.powers.manage')" icon="i-lucide-book-plus" size="sm" variant="outline" class="ms-auto" @click="ui.open('powers')" />
    </div>

    <section v-for="g in byLevel" :key="g.level" class="flex flex-col gap-2">
      <h3 class="section-tick font-label text-base font-semibold text-highlighted">
        {{ levelName(g.level) }}
      </h3>
      <SheetActionCard v-for="p in g.powers" :key="`${p.id}-${p.level}`" :card="p" power />
    </section>
    <UEmpty v-if="!byLevel.length" icon="i-lucide-sparkles" :title="t('sheet.powers.none')" :description="hasCasting ? t('sheet.powers.none_text') : ''" :actions="editable && hasCasting ? [{ label: t('sheet.powers.manage'), onClick: () => ui.open('powers') }] : []" />
  </div>
</template>
