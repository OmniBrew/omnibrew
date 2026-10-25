<script setup lang="ts">
/** The search palette (⌘K / Ctrl+K, or the header button). Enter opens a result; "All results" opens /search. */
import type { CommandPaletteGroup, CommandPaletteItem } from '@nuxt/ui'
import type { SearchGroup } from '../../types/site'

const { game } = useAppConfig()
const { t } = useI18n()
const { open, ready, load, search } = useSiteSearch()
const term = ref('')

defineShortcuts({ meta_k: () => (open.value = !open.value) })
watch(open, (isOpen) => {
  if (isOpen) load()
})

const groupInfo = new Map((game.search as SearchGroup[]).map(g => [g.id, g]))
const groups = computed<CommandPaletteGroup<CommandPaletteItem>[]>(() => {
  if (!ready.value || !term.value.trim()) return []
  const hits = search(term.value).filter(h => h.doc.to).slice(0, 30)
  const out: CommandPaletteGroup<CommandPaletteItem>[] = [...groupInfo.values()].map(g => ({
    id: g.id,
    label: t(g.label, 2),
    ignoreFilter: true,
    items: hits.filter(h => h.doc.group === g.id).map(h => ({
      label: h.doc.title,
      suffix: h.doc.parent,
      icon: g.icon,
      to: h.doc.to,
      onSelect: () => (open.value = false),
    })),
  })).filter(g => g.items!.length)
  out.push({
    id: 'all',
    ignoreFilter: true,
    items: [{ label: t('shell.all_results'), icon: 'i-lucide-list', to: { path: '/search', query: { q: term.value } }, onSelect: () => (open.value = false) }],
  })
  return out
})
</script>

<template>
  <UModal v-model:open="open" :title="t('search')" :description="t('shell.search_description')" :ui="{ content: 'max-w-2xl' }">
    <template #content>
      <UCommandPalette
        v-model:search-term="term"
        :groups="groups"
        :loading="open && !ready"
        :placeholder="t('shell.search_placeholder')"
        close
        class="h-[min(70vh,32rem)]"
        @update:open="open = $event"
      >
        <template #empty>
          <p class="py-6 text-center text-sm text-muted">
            {{ term.trim() ? t('buttons.no_results') : t('buttons.enter_search') }}
          </p>
        </template>
      </UCommandPalette>
    </template>
  </UModal>
</template>
