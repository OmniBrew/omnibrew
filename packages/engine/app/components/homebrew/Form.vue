<script setup lang="ts">
/**
 * A homebrew record's form (plan/26 §1.3): the kind's tabs from the game's form data, then
 * Preview. Fields write through `setPath`; effects, upcasts and advancements have their own
 * inputs. Errors (`validateRecord`, by field path) show under their fields, and a tab with
 * errors is marked. On wide screens the preview sits beside the form.
 */
import type { FieldDef, HomebrewKindDef } from '@omnibrew/engine/schemas'
import { fieldShown, getPath, setPath } from '../../utils/homebrew'

type Rec = Record<string, unknown>
const props = defineProps<{ kind: HomebrewKindDef, record: Rec, errors: Record<string, string[]>, readonly?: boolean }>()
const emit = defineEmits<{ update: [record: Rec] }>()
const { t } = useI18n()

const tab = ref('0')
const tabs = computed(() => [
  ...props.kind.groups.map((g, i) => ({ label: t(g.title), value: String(i), badge: groupErrors(i) ? String(groupErrors(i)) : undefined })),
  { label: t('homebrew.tabs.preview'), value: 'preview', class: 'xl:hidden' },
])
const group = computed(() => (tab.value === 'preview' ? null : props.kind.groups[Number(tab.value)] ?? null))
const errorsOf = (field: FieldDef) => Object.entries(props.errors).filter(([p]) => p === field.path || (field.input.kind !== 'effects' && field.input.kind !== 'upcasts' && p.startsWith(`${field.path}.`))).flatMap(([, m]) => m)
const groupErrors = (i: number) => props.kind.groups[i]!.fields.reduce((n, f) => n + errorsOf(f).length + (f.input.kind === 'effects' ? Object.keys(props.errors).filter(p => p.startsWith('mechanics')).length : 0), 0)
/** Errors on paths no field shows (a key from a record this one is based on). */
const otherErrors = computed(() => {
  const paths = props.kind.groups.flatMap(g => g.fields.map(f => f.path))
  return Object.entries(props.errors).filter(([p]) => !paths.some(f => p === f || p.startsWith(`${f}.`) || (f === 'casting' && p.startsWith('casting')) || (f === 'mechanics' && p.startsWith('mechanics')))).flatMap(([p, m]) => m.map(x => `${p || t('homebrew.record')}: ${x}`))
})
const wide = (f: FieldDef) => ['markdown', 'effects', 'upcasts', 'advancements', 'damage-list', 'properties'].includes(f.input.kind) || ('long' in f.input && Boolean(f.input.long)) || ('multiple' in f.input && Boolean(f.input.multiple))
const set = (path: string, value: unknown) => emit('update', setPath(props.record, path, value))
</script>

<template>
  <div class="grid gap-6 xl:grid-cols-[minmax(0,1fr)_24rem]">
    <div class="flex min-w-0 flex-col gap-4">
      <UTabs v-model="tab" :items="tabs" :content="false" class="max-sm:[&_[role=tablist]]:grid max-sm:[&_[role=tablist]]:grid-cols-3" />
      <fieldset v-if="group" :disabled="readonly" class="grid gap-4 sm:grid-cols-2">
        <legend class="sr-only">
          {{ t(group.title) }}
        </legend>
        <template v-for="f in group.fields.filter(x => fieldShown(x, record))" :key="`${f.path}-${f.when?.is.join()}`">
          <UFormField v-if="f.input.kind === 'effects'" :label="t(f.label)" :help="f.help ? t(f.help) : undefined" class="sm:col-span-2">
            <HomebrewEffects :model-value="getPath(record, f.path)" :errors="errors" @update:model-value="v => set(f.path, v)" />
          </UFormField>
          <UFormField v-else-if="f.input.kind === 'upcasts'" :label="t(f.label)" :help="f.help ? t(f.help) : undefined" class="sm:col-span-2">
            <HomebrewUpcasts :record="record" @update="r => emit('update', r)" />
          </UFormField>
          <UFormField v-else-if="f.input.kind === 'advancements'" :label="t(f.label)" :help="f.help ? t(f.help) : undefined" :error="errorsOf(f).join(' · ') || undefined" class="sm:col-span-2">
            <HomebrewAdvancements :model-value="getPath(record, f.path)" @update:model-value="v => set(f.path, v)" />
          </UFormField>
          <HomebrewField v-else :field="f" :record="record" :errors="errorsOf(f)" :class="wide(f) ? 'sm:col-span-2' : ''" @update="r => emit('update', r)" />
        </template>
      </fieldset>
      <HomebrewPreview v-else :collection="kind.collection" :record="record" />
      <UAlert v-if="otherErrors.length" color="error" variant="subtle" icon="i-lucide-circle-alert" :title="t('homebrew.other_errors')">
        <template #description>
          <ul class="list-disc ps-4">
            <li v-for="(e, i) in otherErrors" :key="i">
              {{ e }}
            </li>
          </ul>
        </template>
      </UAlert>
    </div>
    <aside class="hidden xl:block" :aria-label="t('homebrew.tabs.preview')">
      <div class="sticky top-20 rounded-md border border-default bg-muted p-4">
        <h2 class="mb-3 font-label font-semibold text-highlighted">
          {{ t('homebrew.tabs.preview') }}
        </h2>
        <HomebrewPreview :collection="kind.collection" :record="record" />
      </div>
    </aside>
  </div>
</template>
