<script setup lang="ts">
/**
 * What the first sign-in brought over from the game's older backend (plan/28 §1), on the
 * profile page: counts, characters that couldn't come across (their original can be
 * downloaded and imported later), and homebrew made private until it's fixed.
 */
import { downloadJson } from '../../composables/downloadJson'

const props = defineProps<{ report: Record<string, unknown> }>()
const { t } = useI18n()
const toast = useToast()

interface Failed { id: string, name: string | null, message: string }
const section = <T,>(key: string) => (props.report[key] ?? {}) as T
const characters = computed(() => section<{ migrated?: number, existing?: number, failed?: Failed[] }>('characters'))
const bookmarks = computed(() => section<{ migrated?: number }>('bookmarks'))
const homebrew = computed(() => section<{ claimed?: number, converted?: number, private?: Array<{ id: string, title: string }> }>('homebrew'))
const raised = computed(() => (typeof props.report.maxCharacters === 'number' ? props.report.maxCharacters : null))
const downloading = ref<string | null>(null)

async function download(c: Failed) {
  downloading.value = c.id
  try {
    const data = await useUserData()
    const old = await data?.legacy.character(c.id, true)
    if (!old?.original) throw new Error('not found')
    downloadJson(`${c.name ?? c.id}.json`, old.original)
  }
  catch {
    toast.add({ title: t('migration.download_failed'), color: 'error' })
  }
  finally {
    downloading.value = null
  }
}
</script>

<template>
  <section id="migration" aria-labelledby="profile-migration" data-migration-report>
    <h2 id="profile-migration" class="eyebrow mb-1 text-muted">
      {{ t('migration.title') }}
    </h2>
    <p class="mb-3 text-sm">
      {{ t('migration.summary', { characters: characters.migrated ?? 0, bookmarks: bookmarks.migrated ?? 0, homebrew: (homebrew.claimed ?? 0) + (homebrew.converted ?? 0) }) }}
    </p>
    <p v-if="raised" class="mb-3 text-sm text-muted">
      {{ t('migration.limit_raised', { n: raised }) }}
    </p>
    <div v-if="characters.failed?.length" class="mb-3">
      <p class="mb-2 text-sm">
        {{ t('migration.failed_characters', { n: characters.failed.length }, characters.failed.length) }}
      </p>
      <ul class="flex flex-col gap-2">
        <li v-for="c in characters.failed" :key="c.id" class="flex flex-wrap items-center gap-2 text-sm">
          <span class="font-medium">{{ c.name ?? t('migration.unnamed') }}</span>
          <UButton size="xs" variant="outline" icon="i-lucide-download" :label="t('migration.download')" :loading="downloading === c.id" @click="download(c)" />
        </li>
      </ul>
    </div>
    <div v-if="homebrew.private?.length">
      <p class="mb-2 text-sm">
        {{ t('migration.private_homebrew', { n: homebrew.private.length }, homebrew.private.length) }}
      </p>
      <ul class="flex flex-col gap-1">
        <li v-for="h in homebrew.private" :key="h.id" class="text-sm">
          <ULink :to="`/homebrew/edit?id=${h.id}`" class="text-primary underline">
            {{ h.title }}
          </ULink>
        </li>
      </ul>
    </div>
  </section>
</template>
