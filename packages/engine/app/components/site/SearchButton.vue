<script setup lang="ts">
const { open } = useSiteSearch()
const { t } = useI18n()
</script>

<template>
  <UButton
    color="neutral"
    variant="ghost"
    icon="i-lucide-search"
    :aria-label="t('search')"
    @click="open = true"
  >
    <span class="hidden lg:inline">{{ t('search') }}</span>
    <UKbd value="meta" class="hidden lg:inline-flex" />
    <UKbd value="K" class="hidden lg:inline-flex" />
  </UButton>
</template>
