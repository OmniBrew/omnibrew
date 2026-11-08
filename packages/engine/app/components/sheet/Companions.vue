<script setup lang="ts">
/**
 * The Actions tab's companions (the live MeCsCompanion; plan/26 §1.6): one stat block
 * per companion, Add Companion for the owner, and the class features that grant one
 * (the `companion` mechanic) with their text.
 */
import { newCompanion, type CompanionExtension } from '@omnibrew/engine/character'
import { companions as play, type Rec } from '@omnibrew/engine/rules'

const { t } = useI18n()
const { sheet, character, editable, apply } = useSheet()
const ext = computed<CompanionExtension>(() => sheet.value.game.def.character?.companion ?? {})
const editing = ref<string | null>(null)

const features = computed(() => {
  const seen = new Set<string>()
  return sheet.value.ofType('companion').flatMap((m: Rec) => {
    const provider = m.provider as { model: string, id: string } | undefined
    if (!provider || seen.has(`${provider.model}/${provider.id}`)) return []
    seen.add(`${provider.model}/${provider.id}`)
    const record = sheet.value.content.get(provider.model, provider.id)
    return record ? [{ collection: provider.model, id: provider.id, name: String(record.name ?? provider.id) }] : []
  })
})

function add() {
  const c = newCompanion(ext.value)
  c.name = t('sheet.companions.new_name')
  apply(s => play.addCompanion(s.character, c))
  editing.value = c.uuid
}
</script>

<template>
  <div class="flex flex-col gap-3">
    <details v-if="features.length" class="rounded-md border border-default bg-default">
      <summary class="cursor-pointer p-3 font-label text-sm font-semibold text-highlighted">
        {{ t('sheet.companions.features', { n: features.length }) }}
      </summary>
      <div class="flex flex-col gap-3 border-t border-default p-3">
        <div v-for="f in features" :key="`${f.collection}/${f.id}`">
          <p class="font-semibold text-highlighted">
            {{ f.name }}
          </p>
          <SheetProse :id="f.id" :collection="f.collection" class="text-sm" />
        </div>
      </div>
    </details>

    <p v-if="!character.companions.length" class="text-sm text-muted">
      {{ t(editable ? 'sheet.companions.empty' : 'sheet.companions.empty_view') }}
    </p>
    <SheetCompanionBlock
      v-for="raw in character.companions"
      :key="String((raw as { uuid?: unknown }).uuid)"
      :raw="raw"
      @edit="editing = String((raw as { uuid?: unknown }).uuid)"
    />
    <UButton v-if="editable" variant="outline" icon="i-lucide-plus" :label="t('sheet.companions.add')" class="self-start" @click="add" />
    <SheetCompanionEditor v-if="editing" :uuid="editing" @close="editing = null" />
  </div>
</template>
