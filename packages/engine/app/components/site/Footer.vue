<script setup lang="ts">
import type { NavItem } from '../../types/site'

const { game } = useAppConfig()
const { t } = useI18n()
const links = computed(() => (game.footerLinks as NavItem[]).map(l => ({ label: t(l.label, l.count ?? 1), to: l.to })))
</script>

<template>
  <UFooter>
    <template #left>
      <p class="text-sm text-muted">
        {{ t(game.brand.title) }}
      </p>
    </template>
    <nav class="flex flex-wrap justify-center gap-x-5 gap-y-2 text-sm">
      <ULink v-for="l in links" :key="l.to" :to="l.to" class="text-muted hover:text-highlighted" active-class="text-highlighted">
        {{ l.label }}
      </ULink>
    </nav>
  </UFooter>
</template>
