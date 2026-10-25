<script setup lang="ts">
/**
 * The site's sidebar navigation, from the game's `navigation` app config.
 * Items with `chapters` list that navigation file's chapters as children.
 */
import type { NavigationMenuItem } from '@nuxt/ui'
import type { NavItem } from '../../types/site'

const { game } = useAppConfig()
const { t } = useI18n()
const route = useRoute()

const nav = game.navigation as NavItem[]
const chapterSets = [...new Set(collect(nav).map(i => i.chapters).filter((c): c is string => !!c))]
const chapters = Object.fromEntries(await Promise.all(chapterSets.map(async name => [name, (await useChapters(name)).data] as const)))

function collect(items: NavItem[]): NavItem[] {
  return items.flatMap(i => [i, ...collect(i.children ?? [])])
}

function isActive(to?: string) {
  return !!to && (route.path === to || route.path.startsWith(`${to}/`))
}

function toMenuItem(item: NavItem): NavigationMenuItem {
  const label = t(item.label, item.count ?? 1)
  if (item.chapters) {
    const children = (chapters[item.chapters]?.value ?? []).map(c => ({ label: t(c.title ?? c.id), to: `${item.to}/${c.id}` }))
    return { label, icon: item.icon, children, defaultOpen: isActive(item.to) }
  }
  if (item.children) {
    const children = item.children.map(toMenuItem)
    return { label, icon: item.icon, children, defaultOpen: item.children.some(c => isActive(c.to)) }
  }
  return { label, icon: item.icon, to: item.to }
}

// One group per heading: the heading as a label item, then its items.
const groups = computed<NavigationMenuItem[][]>(() => nav.map(item => item.heading
  ? [{ label: t(item.label), type: 'label' as const }, ...(item.children ?? []).map(toMenuItem)]
  : [toMenuItem(item)]))
</script>

<template>
  <UNavigationMenu :items="groups" orientation="vertical" highlight class="data-[orientation=vertical]:w-full" />
</template>
