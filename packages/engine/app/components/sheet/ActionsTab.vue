<script setup lang="ts">
/**
 * The Actions tab (the live MeCsActions): filter chips (All, Attacks, Actions, Bonus
 * Actions, Reactions, Other), the toggles, global notes, then each section's cards and
 * groups (rules/tabs.ts). Section headings get the 2 px primary tick.
 */
import { ACTION_SECTIONS, actionSections, sheetToggles, type ActionGroup, type ActionSection } from '@omnibrew/engine/rules'

const { t } = useI18n()
const { sheet } = useSheet()

const sections = computed(() => actionSections(sheet.value))
const toggles = computed(() => sheetToggles(sheet.value).filter(x => !sections.value.attacks.some(e => 'card' in e && e.card === x.card)))
const filter = ref<'all' | ActionSection | 'companions'>('all')
const { character } = useSheet()

const label = (s: ActionSection) => t(`sheet.actions.sections.${s}`)
const count = (s: ActionSection) => sections.value[s].reduce((a, e) => a + ('card' in e ? 1 : e.group.items.length), 0)
const shown = computed(() => (filter.value === 'companions' ? [] : ACTION_SECTIONS.filter(s => (filter.value === 'all' || filter.value === s) && sections.value[s].length)))
const title = (g: ActionGroup) => ('key' in g.title ? t(g.title.key, g.title.params ?? {}) : g.title.text)

const notes = computed(() => sheet.value.globalNotes)
const extraAttacks = computed(() => sheet.value.extraAttacks)
</script>

<template>
  <div class="flex flex-col gap-4">
    <div class="flex flex-wrap items-center gap-1.5">
      <button
        v-for="chip in ['all', ...ACTION_SECTIONS] as const"
        :key="chip"
        type="button"
        class="inline-flex h-7 items-center gap-1.5 rounded-sm px-2 font-label text-[0.8125rem] font-semibold ring-1 transition-colors max-sm:h-9"
        :class="filter === chip ? 'bg-primary/10 text-primary ring-primary/55' : 'text-default ring-accented hover:bg-elevated'"
        :aria-pressed="filter === chip"
        @click="filter = chip"
      >
        {{ chip === 'all' ? t('all_title') : label(chip) }}
        <span v-if="chip !== 'all' && count(chip)" class="font-mono text-xs text-muted">{{ count(chip) }}</span>
      </button>
      <!-- Companions (the live "Companion" chip): their stat blocks instead of the action list. -->
      <button
        type="button"
        class="inline-flex h-7 items-center gap-1.5 rounded-sm px-2 font-label text-[0.8125rem] font-semibold ring-1 transition-colors max-sm:h-9"
        :class="filter === 'companions' ? 'bg-primary/10 text-primary ring-primary/55' : 'text-default ring-accented hover:bg-elevated'"
        :aria-pressed="filter === 'companions'"
        data-chip="companions"
        @click="filter = 'companions'"
      >
        {{ t('sheet.companions.title') }}
        <span v-if="character.companions.length" class="font-mono text-xs text-muted">{{ character.companions.length }}</span>
      </button>
    </div>

    <SheetCompanions v-if="filter === 'companions'" />

    <div v-if="toggles.length && filter !== 'companions'" class="flex flex-wrap gap-2">
      <SheetToggle v-for="x in toggles" :key="x.toggle.id" :toggle="x.toggle" :label="x.card.name ?? ''" />
    </div>

    <ul v-if="notes.length && filter !== 'companions'" class="flex flex-col gap-1 rounded-sm border border-default bg-default p-3 text-sm">
      <li v-for="(n, i) in notes" :key="i">
        <MDC :value="n.text" tag="span" unwrap="p" class="sheet-prose" />
      </li>
    </ul>

    <section v-for="s in shown" :key="s" class="flex flex-col gap-2">
      <h3 class="section-tick font-label text-base font-semibold text-highlighted">
        {{ label(s) }}
        <span v-if="s === 'attacks' && extraAttacks" class="ms-2 font-sans text-xs font-normal text-muted">{{ t('sheet.actions.extra_attacks', { n: extraAttacks + 1 }) }}</span>
      </h3>
      <template v-for="(entry, i) in sections[s]" :key="i">
        <SheetActionCard v-if="'card' in entry" :card="entry.card" :power="entry.card.model === 'power'" />
        <details v-else class="group rounded-md border border-default bg-default" :open="entry.group.kind !== 'base'">
          <summary class="flex cursor-pointer list-none items-center gap-2 p-3">
            <UIcon name="i-lucide-chevron-right" class="size-4 text-muted transition-transform group-open:rotate-90" />
            <span class="font-label text-[0.9375rem] font-semibold text-highlighted">{{ title(entry.group) }}</span>
            <span v-if="entry.group.kind === 'base'" class="truncate text-sm text-muted italic">{{ entry.group.items.map(x => x.name).join(', ') }}</span>
          </summary>
          <div class="flex flex-col gap-2 border-t border-default p-2">
            <template v-if="entry.group.kind === 'base'">
              <details v-for="item in entry.group.items" :key="item.name" class="rounded-sm px-2 py-1">
                <summary class="cursor-pointer text-sm font-semibold text-highlighted">
                  {{ item.name }}
                </summary>
                <SheetProse v-if="item.id" :id="String(item.id)" collection="actions" class="py-1 text-sm" />
                <MDC v-else-if="item.shortDesc" :value="String(item.shortDesc)" class="sheet-prose py-1 text-sm" />
              </details>
            </template>
            <SheetActionCard v-for="(item, j) in entry.group.kind === 'base' ? [] : entry.group.items" :key="j" :card="item" :power="entry.group.kind === 'powers'" />
          </div>
        </details>
      </template>
    </section>
    <p v-if="!shown.length && filter !== 'companions'" class="text-sm text-muted">
      {{ t('sheet.actions.empty') }}
    </p>
  </div>
</template>
