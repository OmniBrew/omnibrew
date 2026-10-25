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
    <UNavigationMenu :items="links" variant="link" class="flex-wrap justify-center" />
  </UFooter>
</template>
