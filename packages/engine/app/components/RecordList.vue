<script setup lang="ts" generic="T">
/**
 * A list page's table: text search, multi-select filters, sortable columns and
 * rows that expand to show the record. The page supplies the columns, filters
 * and the cell and row slots:
 *
 *   <RecordList :items="powers" :columns="columns" :filters="filters" :row-key="p => p.path">
 *     <template #cell-name="{ item }">…</template>
 *     <template #expanded="{ item }"><PowerInfo :power="item" /></template>
 *   </RecordList>
 */
import type { RecordColumn, RecordFilter } from '../utils/lists'

const props = withDefaults(defineProps<{
  items: T[]
  columns: RecordColumn<T>[]
  filters?: RecordFilter<T>[]
  rowKey: (item: T) => string
  /** Text the search box matches; defaults to the record's name. */
  searchText?: (item: T) => string
  /** Column sorted by at first. */
  defaultSort?: string
  defaultDesc?: boolean
  /** Rows expand to the #expanded slot. */
  expandable?: boolean
}>(), {
  filters: () => [],
  searchText: (item: T) => String((item as { name?: unknown }).name ?? ''),
  defaultSort: undefined,
  defaultDesc: false,
  expandable: true,
})

defineSlots<{
  [cell: `cell-${string}`]: (props: { item: T }) => unknown
  expanded?: (props: { item: T }) => unknown
}>()

const { t } = useI18n()
const search = ref('')
const selected = ref<Record<string, string[]>>({})
const sortKey = ref(props.defaultSort ?? props.columns.find(c => c.sort)?.key)
const desc = ref(props.defaultDesc)
const open = ref(new Set<string>())

const tieBreak = (item: T) => props.searchText(item)
const rows = computed(() => {
  const filtered = filterRecords(props.items, search.value, props.searchText, props.filters, selected.value)
  const column = props.columns.find(c => c.key === sortKey.value)
  return column?.sort ? sortRecords(filtered, column.sort, desc.value, tieBreak) : filtered
})

function sortBy(column: RecordColumn<T>) {
  if (!column.sort) return
  if (sortKey.value === column.key) desc.value = !desc.value
  else {
    sortKey.value = column.key
    desc.value = false
  }
}

function toggle(key: string) {
  const next = new Set(open.value)
  if (next.has(key)) next.delete(key)
  else next.add(key)
  open.value = next
}

const sortIcon = (column: RecordColumn<T>) => sortKey.value !== column.key
  ? 'i-lucide-chevrons-up-down'
  : desc.value ? 'i-lucide-arrow-down' : 'i-lucide-arrow-up'
</script>

<template>
  <div>
    <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <UInput
        v-model="search"
        icon="i-lucide-search"
        :placeholder="t('search')"
        class="sm:col-span-2"
        :ui="{ trailing: 'pe-1' }"
      >
        <template v-if="search" #trailing>
          <UButton color="neutral" variant="link" size="sm" icon="i-lucide-x" :aria-label="t('buttons.close')" @click="search = ''" />
        </template>
      </UInput>
      <USelectMenu
        v-for="f in filters"
        :key="f.key"
        v-model="selected[f.key]"
        :items="f.options"
        value-key="value"
        label-key="label"
        multiple
        :placeholder="f.label"
        :search-input="f.options.length > 10 ? { placeholder: t('search') } : false"
        clear
        class="w-full"
      />
    </div>

    <p class="mt-4 text-xs text-muted">
      {{ rows.length }} / {{ items.length }}
    </p>

    <table class="mt-1 w-full text-sm">
      <thead>
        <tr class="border-b border-default text-left">
          <th
            v-for="c in columns"
            :key="c.key"
            scope="col"
            class="px-2 py-2 font-display text-xs font-semibold uppercase tracking-wider text-muted"
            :class="c.class"
            :aria-sort="sortKey === c.key ? (desc ? 'descending' : 'ascending') : undefined"
          >
            <button v-if="c.sort" type="button" class="inline-flex items-center gap-1 uppercase hover:text-highlighted" @click="sortBy(c)">
              {{ c.label }}
              <UIcon :name="sortIcon(c)" class="size-3.5" />
            </button>
            <span v-else>{{ c.label }}</span>
          </th>
          <th v-if="expandable" class="w-8" />
        </tr>
      </thead>
      <tbody>
        <template v-for="item in rows" :key="rowKey(item)">
          <tr
            class="border-b border-default/60 transition-colors"
            :class="expandable ? 'cursor-pointer hover:bg-elevated/60' : ''"
            @click="expandable && toggle(rowKey(item))"
          >
            <td v-for="c in columns" :key="c.key" class="px-2 py-2 align-middle" :class="c.class">
              <slot :name="`cell-${c.key}`" :item="item">
                {{ (item as Record<string, unknown>)[c.key] }}
              </slot>
            </td>
            <td v-if="expandable" class="px-1 text-right">
              <UButton
                color="neutral"
                variant="ghost"
                size="xs"
                icon="i-lucide-chevron-down"
                :aria-label="t('buttons.view_details')"
                :aria-expanded="open.has(rowKey(item))"
                :ui="{ leadingIcon: ['transition-transform', open.has(rowKey(item)) ? 'rotate-180' : ''] }"
                @click.stop="toggle(rowKey(item))"
              />
            </td>
          </tr>
          <tr v-if="expandable && open.has(rowKey(item))" class="border-b border-default bg-muted/40">
            <td :colspan="columns.length + 1" class="px-4 py-4">
              <slot name="expanded" :item="item" />
            </td>
          </tr>
        </template>
      </tbody>
    </table>
    <p v-if="!rows.length" class="py-8 text-center text-muted">
      {{ t('buttons.no_results') }}
    </p>
  </div>
</template>
