<script setup lang="ts">
/** Opens the search palette: an input-shaped button with its shortcut, an icon under 900 px. */
const { open } = useSiteSearch()
const { t } = useI18n()
</script>

<template>
  <UButton
    color="neutral"
    variant="outline"
    icon="i-lucide-search"
    :aria-label="t('search')"
    class="font-sans font-normal tracking-normal text-muted max-[899px]:ring-0 min-[900px]:w-64"
    :ui="{ leadingIcon: 'text-dimmed' }"
    @click="open = true"
  >
    <span class="hidden min-[900px]:inline">{{ t('shell.search_button') }}</span>
    <span class="ms-auto hidden gap-0.5 min-[900px]:flex">
      <UKbd value="meta" />
      <UKbd value="K" />
    </span>
  </UButton>
</template>
