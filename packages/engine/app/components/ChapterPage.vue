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
  /** Overline above the chapter title ("Player's Manual"). */
  headline?: string
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
      <RecordHeader :title="title" :headline="headline" :rule="false" />
    </slot>
    <UPageBody>
      <section v-for="s in sections" :id="s.id" :key="s.id" class="max-w-[45rem] scroll-mt-24 first:[&>h2]:mt-6">
        <h2 class="relative mt-11 flex flex-wrap items-center gap-x-2.5 border-t border-default pt-4.5 text-[1.3125rem]/7 font-bold text-highlighted before:absolute before:-top-0.5 before:left-0 before:h-[3px] before:w-8 before:bg-(--ui-tick) sm:text-2xl/8">
          {{ s.record!.title }}
          <ChangeBadge v-if="s.is_new" type="new" />
          <ChangeBadge v-else-if="s.is_change" type="change" />
        </h2>
        <ContentRenderer :value="s.record!" class="mt-4" />
      </section>
    </UPageBody>
    <template #right>
      <UPageAside>
        <p class="mb-2 eyebrow text-muted">
          {{ t('shell.on_this_page') }}
        </p>
        <ul class="border-l border-default text-[0.8125rem]/[1.125rem]">
          <li v-for="s in sections" :key="s.id">
            <a :href="`#${s.id}`" class="-ml-px block border-l-2 border-transparent py-1.25 pl-3 text-muted hover:border-primary hover:text-highlighted">
              {{ s.record!.title }}
              <UBadge v-if="s.is_new || s.is_change" :label="t(s.is_new ? 'new' : 'change')" :color="s.is_new ? 'info' : 'warning'" variant="subtle" size="xs" class="ml-1" />
            </a>
          </li>
        </ul>
      </UPageAside>
    </template>
  </UPage>
</template>
