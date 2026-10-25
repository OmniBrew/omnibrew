<script setup lang="ts">
/**
 * One chapter of a navigation file (the manual, the guides): every section's
 * record from `collection`, in the file's order, each with an anchor, and a
 * "jump to" list beside them. The #header slot replaces the chapter title.
 */
import type { Chapter } from '../types/site'

const props = defineProps<{
  /** Navigation file (`manual` → content/navigation/manual.yml). */
  navigation: string
  /** Collection holding the sections' records. */
  collection: string
  /** Chapter id. */
  id: string
}>()

const { t } = useI18n()
const { data: chapters } = await useChapters(props.navigation)
const chapter = computed(() => chapters.value.find(c => c.id === props.id))
if (!chapter.value) throw createError({ statusCode: 404, statusMessage: 'Chapter not found', fatal: true })

const sectionIds = chapterSections(chapter.value)
const { data: records } = await useAsyncData(`chapter:${props.collection}:${props.id}`, () =>
  queryRecords(props.collection).where('stem', 'IN', sectionIds.map(id => `${props.collection}/${id}`)).all(), { default: () => [] })

// Sections in the navigation file's order, with their badges.
const flat = (nodes: Chapter[]): Chapter[] => nodes.flatMap(n => (n.sections?.length ? flat(n.sections) : [n]))
const sections = computed(() => flat(chapter.value?.sections ?? []).map(s => ({
  ...s,
  record: records.value.find(r => recordId(r) === s.id),
})).filter(s => s.record))

const title = computed(() => t(chapter.value?.title ?? props.id))
</script>

<template>
  <UPage>
    <slot name="header" :title="title">
      <RecordHeader :title="title" />
    </slot>
    <UPageBody>
      <section v-for="s in sections" :id="s.id" :key="s.id" class="scroll-mt-24">
        <h2 class="mt-10 border-b border-default pb-2 font-display text-2xl font-bold text-highlighted first:mt-0">
          {{ s.record!.title }}
          <ChangeBadge v-if="s.is_new" type="new" />
          <ChangeBadge v-else-if="s.is_change" type="change" />
        </h2>
        <ContentRenderer :value="s.record!" class="mt-4" />
      </section>
    </UPageBody>
    <template #right>
      <UPageAside>
        <p class="mb-2 font-display text-sm font-semibold uppercase tracking-wider text-muted">
          {{ t('buttons.go_to') }}
        </p>
        <ul class="space-y-1 border-l border-default text-sm">
          <li v-for="s in sections" :key="s.id">
            <a :href="`#${s.id}`" class="-ml-px block border-l border-transparent py-0.5 pl-3 text-muted hover:border-primary hover:text-highlighted">
              {{ s.record!.title }}
              <UBadge v-if="s.is_new || s.is_change" :label="t(s.is_new ? 'new' : 'change')" :color="s.is_new ? 'info' : 'warning'" variant="subtle" size="xs" class="ml-1" />
            </a>
          </li>
        </ul>
      </UPageAside>
    </template>
  </UPage>
</template>
