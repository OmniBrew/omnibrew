<script setup lang="ts">
const { t } = useI18n()
useSeoMeta({ title: t('assets_title'), description: t('meta.assets') })

// Each asset's title and description are assetspage.items.<id> messages.
const items = [
  { id: 'pdf', to: '/print/pdf' },
  { id: 'power_cards', href: 'https://drive.google.com/drive/folders/1kGqRyRax980-B7MJ0C85SmijLPMI_FXv?usp=sharing' },
  { id: 'character_sheet', href: 'https://drive.google.com/drive/folders/1RsYfHzmvv-md8_dIrQU65LpWzTr0kpCR?usp=sharing' },
  { id: 'missions', href: 'https://drive.google.com/drive/u/0/folders/1B6KHBiOIWvtOzhqdxXryzZ3WMVAjpWMt' },
  { id: 'everything_else', href: 'https://drive.google.com/drive/u/0/folders/10S3R_Tfi4bJ9X2b6-4OI65m9F8fx6i0P' },
]
</script>

<template>
  <UPage>
    <RecordHeader :title="t('assets_title')" />
    <UPageBody>
      <UAlert color="info" variant="subtle" icon="i-lucide-info" :description="t('assetspage.file_use_note')" />
      <div class="mt-8 grid gap-6 md:grid-cols-2 xl:grid-cols-3">
        <UCard v-for="item in items" :key="item.id" variant="outline">
          <h2 class="font-display text-xl font-bold text-highlighted">
            {{ t(`assetspage.items.${item.id}.title`) }}
          </h2>
          <p class="mt-2 text-sm">
            {{ t(`assetspage.items.${item.id}.description`) }}
          </p>
          <template #footer>
            <UButton
              :to="item.to"
              :href="item.href"
              :target="item.href ? '_blank' : undefined"
              variant="ghost"
              :label="t('buttons.view')"
              :trailing-icon="item.href ? 'i-lucide-external-link' : 'i-lucide-chevron-right'"
              class="-ms-2.5"
            />
          </template>
        </UCard>
      </div>
    </UPageBody>
  </UPage>
</template>
