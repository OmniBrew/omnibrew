<script setup lang="ts">
/** Marks a species or item from the Andromeda galaxy, as the live site's small outlined chip did. */
const { t } = useI18n()
</script>

<template>
  <UBadge :label="t('galaxies.andromeda')" color="primary" variant="outline" size="xs" />
</template>
