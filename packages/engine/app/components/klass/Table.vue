<script setup lang="ts" generic="S extends { stem?: string, name?: string, author?: string }, T extends ClassFeatureLike">
/**
 * A class's table: one row per character level with the proficiency bonus,
 * the features gained and the columns the mechanics of the class's features
 * bring (cantrips, powers known, power slots by power level under one heading,
 * any `progressionColumn`; a game adds its own with `mechanicColumns`).
 * Clicking a level with features opens them, the class's and every subclass's,
 * in a dialog.
 */
import type { ClassFeatureLike, ClassProgression, ClassTableRow, MechanicColumns } from '../../utils/progression'
import { commaList } from '../../utils/powers'

const props = defineProps<{
  progression: ClassProgression
  /** Character progression rows (level, proficiency bonus). */
  levels: { level?: number, profBonus?: number }[]
  /** The class's features, subclass features included. */
  features: T[]
  subclasses: S[]
  /** The class's id. */
  klass: string
  /** The Features column's name for a subclass level ("Subclass Feature"). */
  subclassLabel: string
  /** The game's mechanic columns, merged into the core power system's (`CORE_MECHANIC_COLUMNS`). */
  mechanicColumns?: MechanicColumns[]
}>()

const { t, te } = useI18n()
const columns = computed(() => classTableColumns(props.features, mergeMechanicColumns(CORE_MECHANIC_COLUMNS, props.mechanicColumns)))
const header = computed(() => classTableHeader(columns.value))
const rows = computed(() => classTableRows(props.levels, columns.value, props.features, props.progression, {
  abi: t('ability_score_increase_title'),
  subclass: props.subclassLabel,
}))

const ordinal = (n: number) => t(`ordinal_numbers[${n}]`)
const label = (cell: { key: string, label: string, text?: string }) => {
  if (cell.key === 'level') return t(cell.label, 1)
  return te(cell.label) ? t(cell.label) : cell.text ?? cell.label
}

const root = useTemplateRef<HTMLElement>('root')
const selected = ref<ClassTableRow>()
// The dialog is teleported out of the page, so it takes the class accent color along.
const accent = ref<string>()
const open = ref(false)
function select(row: ClassTableRow) {
  if (!row.features.length) return
  accent.value = root.value ? getComputedStyle(root.value).getPropertyValue('--klass-accent') || undefined : undefined
  selected.value = row
  open.value = true
}
</script>

<template>
  <div ref="root">
    <div class="overflow-x-auto">
      <table class="w-full text-sm">
        <thead>
          <tr class="border-b border-default">
            <th
              v-for="cell in header.top"
              :key="cell.key"
              scope="col"
              :colspan="cell.colspan"
              :rowspan="cell.rowspan"
              class="px-2 py-2 font-display text-xs font-semibold uppercase tracking-wider text-muted"
              :class="[cell.key === 'features' ? 'min-w-48 text-left' : 'text-center', cell.key === 'level' ? 'sticky left-0 z-10 bg-default' : '', cell.group ? 'border-b border-default' : '']"
            >
              {{ label(cell) }}
            </th>
          </tr>
          <tr v-if="header.sub.length" class="border-b border-default">
            <th
              v-for="c in header.sub"
              :key="c.key"
              scope="col"
              class="px-2 py-2 text-center font-display text-xs font-semibold uppercase tracking-wider text-muted"
            >
              {{ ordinal(c.sub ?? 0) }}
            </th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="row in rows"
            :id="`level-${row.level}`"
            :key="row.level"
            class="group border-b border-default/60"
            :class="row.features.length ? 'cursor-pointer hover:bg-elevated' : ''"
            @click="select(row)"
          >
            <td
              v-for="c in columns"
              :key="c.key"
              class="px-2 py-2"
              :class="[
                c.kind === 'features' ? 'text-left' : 'text-center tabular-nums',
                c.kind === 'level' ? 'sticky left-0 z-10 bg-default' : '',
                c.kind === 'level' && row.features.length ? 'group-hover:bg-elevated' : '',
              ]"
            >
              <template v-if="c.kind === 'level'">
                <button
                  v-if="row.features.length"
                  type="button"
                  aria-haspopup="dialog"
                  class="font-semibold text-highlighted hover:text-primary"
                  @click.stop="select(row)"
                >
                  {{ ordinal(row.level) }}
                </button>
                <span v-else class="font-semibold text-highlighted">{{ ordinal(row.level) }}</span>
              </template>
              <template v-else-if="c.kind === 'profBonus'">
                +{{ row.profBonus }}
              </template>
              <template v-else-if="c.kind === 'features'">
                {{ row.features.length ? commaList(t, row.features) : '-' }}
              </template>
              <template v-else>
                {{ row.cells[c.key] }}
              </template>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <UModal v-model:open="open" :title="selected ? t('level_nth', { nth: ordinal(selected.level) }) : ''" :ui="{ content: 'sm:max-w-4xl' }">
      <template #body>
        <div v-if="selected" :style="accent ? { '--klass-accent': accent } : undefined">
          <KlassFeatureList :features="features" :level="selected.level" :abi="progression.abi" :klass="klass" :anchors="false" />
          <template v-if="progression.subclass.includes(selected.level)">
            <!-- The Features column lists the subclass label last: more than it means class features too. -->
            <hr v-if="selected.features.length > 1" class="my-6 border-t-2 border-[color:var(--klass-accent,var(--ui-primary))]">
            <KlassSubclasses :subclasses="subclasses" :features="features" :level="selected.level" :anchors="false" />
          </template>
        </div>
      </template>
    </UModal>
  </div>
</template>
