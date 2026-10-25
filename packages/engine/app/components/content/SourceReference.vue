<script setup lang="ts">
/**
 * MDC block component crediting the work a text is adapted from:
 *
 *   ::source-reference{pages="2-3" source="races" :additional='[{"source":"wiki","pages":"Asari"}]'}
 *   ::
 *
 * Sources are listed in the app config (`game.sources`).
 */
interface Credit { source: string, pages?: string }

const props = withDefaults(defineProps<{
  pages?: string
  source?: string
  additional?: Credit[]
}>(), { source: 'srd', pages: undefined, additional: () => [] })

const { game } = useAppConfig()
const sources = game.sources as Record<string, { title: string, url: string, pageInUrl?: boolean } | undefined>
const credits = computed(() => [{ source: props.source, pages: props.pages }, ...props.additional]
  .map(c => ({ ...c, info: sources[c.source] }))
  .filter(c => c.info))
</script>

<template>
  <p class="text-right text-sm text-muted">
    text adapted from
    <template v-for="(c, i) in credits" :key="c.source">
      <span v-if="i"> &amp; </span>
      <a :href="c.info!.pageInUrl ? `${c.info!.url}${c.pages ?? ''}` : c.info!.url" target="_blank" rel="noopener"><em>{{ c.info!.title }}</em></a>
      <span v-if="!c.info!.pageInUrl && c.pages">, p. {{ c.pages }}</span>
    </template>
  </p>
</template>
