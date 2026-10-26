<script setup lang="ts">
const path = useContentPath().value
const { t } = useI18n()
const { data: npc } = await useAsyncData(path, () => queryCollection('bestiary').path(path).first())
if (!npc.value) throw createError({ statusCode: 404, statusMessage: 'Creature not found', fatal: true })

useSeoMeta({ title: npc.value.name, description: t('meta.info', { name: npc.value.name }) })
</script>

<template>
  <UPage v-if="npc">
    <!-- The stat block carries the name (the page's h1); the head is its eyebrow and the way back. -->
    <header class="flex flex-wrap items-start gap-4 pt-7 pb-5">
      <div class="min-w-0 flex-1">
        <p class="eyebrow text-primary">
          {{ [t('bestiary_title', 2), npc.unit && t(`npc.unit_types.${npc.unit}`)].filter(Boolean).join(' · ') }}
        </p>
        <p v-if="npc.author" class="mt-1 text-sm text-muted italic">
          by {{ npc.author }}
        </p>
      </div>
      <UButton :label="t('bestiary_title', 2)" icon="i-lucide-arrow-left" to="/bestiary" variant="ghost" />
    </header>
    <UPageBody class="mt-0">
      <MeNpcStatBlock :npc="npc" title-tag="h1" />
    </UPageBody>
  </UPage>
</template>
