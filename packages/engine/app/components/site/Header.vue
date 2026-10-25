<script setup lang="ts">
import type { NavigationMenuItem } from '@nuxt/ui'
import type { NavItem } from '../../types/site'

const { game } = useAppConfig()
const { t } = useI18n()
const links = computed<NavigationMenuItem[]>(() => (game.headerLinks as NavItem[]).map(l => ({ label: t(l.label, l.count ?? 1), to: l.to })))
</script>

<template>
  <UHeader :to="'/'" :title="t(game.brand.title)" mode="slideover">
    <template #title>
      <img v-if="game.brand.logo" :src="game.brand.logo" alt="" class="size-7">
      <span class="hidden font-display text-xl font-semibold text-highlighted sm:inline">{{ t(game.brand.title) }}</span>
    </template>

    <UNavigationMenu :items="links" variant="link" />

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
