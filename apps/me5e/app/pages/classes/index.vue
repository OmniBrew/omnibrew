<script setup lang="ts">
const { t } = useI18n()
useSeoMeta({ title: t('class_title', 2), description: t('meta.classes') })

const { data: classes } = await useAsyncData('classes', () =>
  queryCollection('classes')
    .select('path', 'stem', 'name', 'snippet', 'author', 'hitDie', 'primaryAbility', 'profs')
    .order('name', 'ASC')
    .all(), { default: () => [] })

// The core classes, then the homebrew ones ("Expanded Class Options"), as on the live site.
const groups = computed(() => [
  { key: 'core', title: undefined, items: classes.value.filter(c => !c.author) },
  { key: 'expanded', title: t('expanded_class_options_title'), items: classes.value.filter(c => c.author) },
].filter(g => g.items.length))
</script>

<template>
  <UPage>
    <RecordHeader :title="t('class_title', 2)" />
    <UPageBody>
      <section v-for="group in groups" :key="group.key" class="mb-10">
        <h2 v-if="group.title" class="mb-4 font-display text-2xl font-semibold text-highlighted">
          {{ group.title }}
        </h2>
        <div class="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
          <KlassCard v-for="c in group.items" :key="c.path" :klass="c" :image="`/images/classes/${recordId(c)}.svg`" />
        </div>
      </section>
    </UPageBody>
  </UPage>
</template>
