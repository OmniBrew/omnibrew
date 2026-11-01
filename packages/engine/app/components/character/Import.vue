<script setup lang="ts">
/**
 * Imports characters from a file (plan/24 §1.7): this site's exports, or the old site's,
 * which the game's migrator converts in the browser. Shows what the migrator reported
 * before saving; every import is saved as a new character, so nothing is overwritten.
 */
import type { Character } from '@omnibrew/engine/character'
import type { ImportReport } from '@omnibrew/engine/app/game-client'
import { importLegacy } from '#game-client'

const open = defineModel<boolean>('open', { default: false })
const emit = defineEmits<{ imported: [records: CharacterRecord[]] }>()

const { t } = useI18n()
const { $characterGame } = useNuxtApp()
const source = useCharacterSource()

interface Row {
  name: string
  character?: Character
  report?: ImportReport
  error?: string
}

const rows = ref<Row[]>([])
const reading = ref(false)
const saving = ref(false)
const fileError = ref<string | null>(null)

watch(open, (v) => {
  if (!v) {
    rows.value = []
    fileError.value = null
  }
})

const issueKinds = ['unknown', 'homebrew', 'renamed', 'dropped'] as const
const issues = (report: ImportReport | undefined, kind: string) => (Array.isArray(report?.[kind]) ? report[kind] : []) as Array<{ at: string, id?: string, message: string }>

async function read(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file) return
  reading.value = true
  fileError.value = null
  rows.value = []
  try {
    const items = parseImport(await file.text())
    const { rules, game } = await useRules()
    const legacy = items.some(i => i.kind === 'legacy') ? await importLegacy?.() : undefined
    const { characterSchema, upgradeCharacter } = await import('@omnibrew/engine/character')
    const schema = characterSchema($characterGame.character)
    rows.value = items.map((item): Row => {
      const name = String((item.character as { name?: unknown }).name ?? '') || t('characters.unnamed')
      try {
        if (item.kind === 'legacy') {
          if (!legacy) return { name, error: t('characters.import_no_migrator') }
          const { character, report } = legacy(item.character, { game, content: rules.content })
          return { name, character, report }
        }
        if (item.game && item.game !== $characterGame.id) return { name, error: t('characters.import_wrong_game', { game: item.game }) }
        const parsed = schema.safeParse(upgradeCharacter(item.character as Record<string, unknown>))
        if (!parsed.success) return { name, error: parsed.error.issues.slice(0, 3).map(i => `${i.path.join('.')}: ${i.message}`).join('; ') }
        return { name, character: parsed.data }
      }
      catch (e) {
        return { name, error: (e as Error).message }
      }
    })
  }
  catch (e) {
    fileError.value = t('characters.import_bad_file', { message: (e as Error).message })
  }
  finally {
    reading.value = false
  }
}

const ready = computed(() => rows.value.filter(r => r.character))

async function save() {
  saving.value = true
  const saved: CharacterRecord[] = []
  try {
    for (const row of ready.value) saved.push(await source.create(row.character!))
    emit('imported', saved)
    open.value = false
  }
  catch (e) {
    fileError.value = t('characters.save_failed', { message: (e as Error).message })
    if (saved.length) emit('imported', saved)
  }
  finally {
    saving.value = false
  }
}
</script>

<template>
  <UModal v-model:open="open" :title="t('characters.import_title')" :description="t('characters.import_text')" :ui="{ content: 'max-w-2xl' }">
    <template #body>
      <div class="flex flex-col gap-4">
        <label class="flex cursor-pointer flex-col items-center gap-2 rounded-md border border-dashed border-accented p-6 text-center hover:bg-elevated/50 focus-within:outline-2 focus-within:outline-primary">
          <UIcon :name="reading ? 'i-lucide-loader-circle' : 'i-lucide-file-json'" class="size-8 text-muted" :class="{ 'animate-spin': reading }" />
          <span class="font-label font-semibold text-highlighted">{{ t('characters.import_choose') }}</span>
          <span class="text-sm text-muted">{{ t('characters.import_formats') }}</span>
          <input type="file" accept=".json,application/json,text/plain" class="sr-only" @change="read">
        </label>
        <UAlert v-if="fileError" color="error" variant="subtle" icon="i-lucide-triangle-alert" :title="fileError" />
        <ul v-if="rows.length" class="flex flex-col gap-2">
          <li v-for="(row, i) in rows" :key="i" class="rounded-md border border-default bg-muted p-3 text-sm">
            <div class="flex items-center gap-2">
              <UIcon :name="row.error ? 'i-lucide-circle-x' : 'i-lucide-circle-check'" :class="row.error ? 'text-error' : 'text-success'" class="size-4 shrink-0" />
              <span class="font-semibold text-highlighted">{{ row.name }}</span>
              <span v-if="row.report" class="text-muted">{{ t('characters.import_from', { version: row.report.from }) }}</span>
            </div>
            <p v-if="row.error" class="mt-1 text-error">
              {{ row.error }}
            </p>
            <template v-for="kind in issueKinds" :key="kind">
              <details v-if="issues(row.report, kind).length" class="mt-2">
                <summary class="cursor-pointer text-muted">
                  {{ t(`characters.import_issues.${kind}`, { n: issues(row.report, kind).length }) }}
                </summary>
                <ul class="mt-1 list-disc ps-5 text-muted">
                  <li v-for="(issue, j) in issues(row.report, kind)" :key="j">
                    {{ issue.message }}
                  </li>
                </ul>
              </details>
            </template>
          </li>
        </ul>
      </div>
    </template>
    <template #footer>
      <div class="flex w-full justify-end gap-2">
        <UButton :label="t('characters.cancel')" color="neutral" variant="ghost" @click="open = false" />
        <UButton :label="t('characters.import_save', { n: ready.length }, ready.length)" :disabled="!ready.length" :loading="saving" @click="save" />
      </div>
    </template>
  </UModal>
</template>
