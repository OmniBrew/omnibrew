<script setup lang="ts">
/**
 * MDC block `::note`: an aside in a tinted box, titled "Note" in the info color.
 * Mapped from `note` in nuxt.config.ts (in place of Nuxt UI's ProseNote).
 */
const { t } = useI18n()
</script>

<template>
  <aside class="my-5 rounded-md border border-info/35 bg-info/7 px-4.5 pt-3.5 pb-4 text-default *:last:mb-0 [&_p]:my-2 [&>p:first-of-type]:mt-0">
    <p class="mb-2 flex items-center gap-2 eyebrow text-info">
      <UIcon name="i-lucide-info" class="size-4 shrink-0" />
      {{ t('shell.note') }}
    </p>
    <slot mdc-unwrap="p" />
  </aside>
</template>
