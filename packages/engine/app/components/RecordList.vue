<script setup lang="ts" generic="T">
/**
 * A list page's table: text search, multi-select filters, sortable columns and
 * rows that expand to show the record. The page supplies the columns, filters
 * and the cell and row slots:
 *
 *   <RecordList :items="powers" :columns="columns" :filters="filters" :row-key="p => p.path">
 *     <template #cell-name="{ item }">…</template>
 *     <template #phone="{ item }">…</template>
 *     <template #expanded="{ item }"><PowerInfo :power="item" /></template>
 *   </RecordList>
 *
 * Under 640 px the table becomes list rows: the `phone` slot (an icon, the bold
 * name and a muted line with the key stats; the name cell by default) and a chevron.
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
  phone?: (props: { item: T }) => unknown
  expanded?: (props: { item: T }) => unknown
  /** Beside the count above the table (a legend). */
  meta?: () => unknown
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
const align = (c: RecordColumn<T>) => (c.numeric ? 'text-right' : 'text-left')
</script>

<template>
  <div>
    <div class="flex flex-col gap-2 lg:flex-row lg:gap-3">
      <UInput
        v-model="search"
        icon="i-lucide-search"
        :placeholder="t('search')"
        class="lg:flex-[1.7]"
        :ui="{ trailing: 'pe-1' }"
      >
        <template v-if="search" #trailing>
          <UButton color="neutral" variant="link" size="sm" icon="i-lucide-x" :aria-label="t('buttons.close')" @click="search = ''" />
        </template>
      </UInput>
      <div v-if="filters.length" class="grid gap-2 lg:contents" :style="{ gridTemplateColumns: `repeat(${filters.length}, minmax(0, 1fr))` }">
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
          class="w-full min-w-0 lg:flex-1"
        />
      </div>
    </div>

    <div class="mt-3 mb-2 flex flex-wrap items-center justify-between gap-2 text-[0.8125rem] text-muted">
      <p>{{ t('shell.count_of', { n: rows.length, total: items.length }) }}</p>
      <slot name="meta" />
    </div>

    <!-- Phones: list rows -->
    <ul class="overflow-hidden rounded-md border border-default sm:hidden">
      <li v-for="item in rows" :key="rowKey(item)" class="border-b border-default last:border-b-0">
        <div
          class="flex min-h-15 items-center gap-3 px-3 py-2.5"
          :class="[expandable ? 'cursor-pointer' : '', open.has(rowKey(item)) ? 'bg-muted' : '']"
          @click="expandable && toggle(rowKey(item))"
        >
          <div class="min-w-0 flex-1">
            <slot name="phone" :item="item">
              <slot name="cell-name" :item="item">
                <span class="font-semibold text-highlighted">{{ (item as Record<string, unknown>).name }}</span>
              </slot>
            </slot>
          </div>
          <UButton
            v-if="expandable"
            color="neutral"
            variant="ghost"
            size="sm"
            :icon="open.has(rowKey(item)) ? 'i-lucide-chevron-up' : 'i-lucide-chevron-right'"
            :aria-label="t('buttons.view_details')"
            :aria-expanded="open.has(rowKey(item))"
            class="text-dimmed"
            :class="open.has(rowKey(item)) ? 'text-primary' : ''"
            @click.stop="toggle(rowKey(item))"
          />
        </div>
        <div v-if="expandable && open.has(rowKey(item))" class="bg-muted px-3 pb-4 text-sm">
          <slot name="expanded" :item="item" />
        </div>
      </li>
    </ul>

    <!-- Wider screens: the table -->
    <div class="hidden overflow-hidden rounded-md border border-default sm:block">
      <table class="w-full border-collapse text-sm">
        <thead>
          <tr class="border-b border-accented bg-muted">
            <th
              v-for="c in columns"
              :key="c.key"
              scope="col"
              class="px-3 py-2.5 font-label text-[11.5px]/4 font-semibold tracking-[0.1em] whitespace-nowrap uppercase"
              :class="[c.class, align(c), sortKey === c.key ? 'text-highlighted' : 'text-muted']"
              :aria-sort="sortKey === c.key ? (desc ? 'descending' : 'ascending') : undefined"
            >
              <button v-if="c.sort" type="button" class="inline-flex items-center gap-1 uppercase hover:text-highlighted" @click="sortBy(c)">
                {{ c.label }}
                <UIcon :name="sortIcon(c)" class="size-3" :class="sortKey === c.key ? 'text-primary' : 'text-dimmed'" />
              </button>
              <span v-else>{{ c.label }}</span>
            </th>
            <th v-if="expandable" class="w-9" />
          </tr>
        </thead>
        <tbody>
          <template v-for="item in rows" :key="rowKey(item)">
            <tr
              class="border-b border-default transition-colors last:border-b-0"
              :class="[
                expandable ? 'cursor-pointer' : '',
                open.has(rowKey(item)) ? 'bg-muted' : expandable ? 'hover:bg-elevated/55' : '',
              ]"
              @click="expandable && toggle(rowKey(item))"
            >
              <td
                v-for="c in columns"
                :key="c.key"
                class="px-3 py-2.5 align-middle"
                :class="[c.class, align(c), c.numeric ? 'font-mono whitespace-nowrap tabular-nums' : '']"
              >
                <slot :name="`cell-${c.key}`" :item="item">
                  {{ (item as Record<string, unknown>)[c.key] }}
                </slot>
              </td>
              <td v-if="expandable" class="pe-2 text-right">
                <UButton
                  color="neutral"
                  variant="ghost"
                  size="xs"
                  icon="i-lucide-chevron-down"
                  :aria-label="t('buttons.view_details')"
                  :aria-expanded="open.has(rowKey(item))"
                  :class="open.has(rowKey(item)) ? 'text-primary' : 'text-dimmed'"
                  :ui="{ leadingIcon: ['transition-transform', open.has(rowKey(item)) ? 'rotate-180' : ''] }"
                  @click.stop="toggle(rowKey(item))"
                />
              </td>
            </tr>
            <tr v-if="expandable && open.has(rowKey(item))" class="border-b border-default bg-muted last:border-b-0">
              <td :colspan="columns.length + 1" class="px-4 pt-1 pb-5">
                <slot name="expanded" :item="item" />
              </td>
            </tr>
          </template>
        </tbody>
      </table>
    </div>
    <p v-if="!rows.length" class="py-8 text-center text-muted">
      {{ t('buttons.no_results') }}
    </p>
  </div>
</template>
