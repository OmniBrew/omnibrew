<script setup lang="ts">
/**
 * The site header: logo and name (a brand tick on the bottom border under the logo),
 * the top-level links with a primary bar under the active one, then search, units,
 * color mode and the account. Under 900 px the links fold into the drawer.
 */
import type { NavigationMenuItem } from '@nuxt/ui'
import type { NavItem } from '../../types/site'

const { game } = useAppConfig()
const { t } = useI18n()
const links = computed<NavigationMenuItem[]>(() => (game.headerLinks as NavItem[]).map(l => ({ label: t(l.label, l.count ?? 1), to: l.to })))
</script>

<template>
  <UHeader mode="slideover" toggle-side="left" :ui="{ left: 'self-stretch gap-7 max-[899px]:gap-2', right: 'gap-1' }">
    <template #left>
      <NuxtLink
        to="/"
        class="relative flex h-full shrink-0 items-center gap-2.5 after:absolute after:-bottom-px after:left-0 after:h-0.5 after:w-7 after:bg-(--ui-tick)"
      >
        <img v-if="game.brand.logo" :src="game.brand.logo" alt="" class="size-7.5">
        <span class="font-display text-base font-bold whitespace-nowrap text-highlighted">
          <span :class="game.brand.shortTitle ? 'hidden sm:inline' : ''">{{ t(game.brand.title) }}</span>
          <span v-if="game.brand.shortTitle" class="sm:hidden">{{ t(game.brand.shortTitle) }}</span>
        </span>
      </NuxtLink>
      <UNavigationMenu
        :items="links"
        variant="link"
        highlight
        class="hidden self-stretch min-[900px]:flex"
        :ui="{
          list: 'h-full items-stretch gap-5',
          item: 'flex py-0',
          link: 'px-0 text-sm after:inset-x-0 after:-bottom-px after:h-0.5 after:rounded-none',
        }"
      />
    </template>

    <template #right>
      <SiteSearchButton />
      <SiteUnitsToggle />
      <UColorModeButton />
      <SiteAccountButton />
    </template>

    <template #body>
      <SiteNavigation />
    </template>
  </UHeader>
</template>
