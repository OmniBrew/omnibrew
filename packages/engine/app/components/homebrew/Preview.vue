<script setup lang="ts">
/**
 * The record on a sample character (plan/26 §1.3): the game's samples (`#game-client`), the
 * draft placed on one as a player would (equipped, learned, taken as a feat), and "What
 * changes": the sample's sheet with and without it, line by line. Recomputed as the player
 * types (a sheet takes 1–7 ms); a draft the rules can't compute keeps the last result.
 */
import { homebrew as gameHomebrew } from '#game-client'
import { placeRecord, sampleCharacter, sheetSummary, type PreviewSample } from '@omnibrew/engine/rules'
import { diffSummaries, mergeHomebrew } from '../../utils/homebrew'

type Rec = Record<string, unknown>
const props = defineProps<{ collection: string, record: Rec }>()
const { t, te } = useI18n()
const hb = useHomebrewRules()

const PREVIEW_ID = '00000000-0000-4000-8000-00000000beef'
const samples = computed<PreviewSample[]>(() => gameHomebrew?.samples ?? [])
const fits = (s: PreviewSample) => s.defaultFor?.includes(props.collection) && (!s.powerTypes || !props.record.powerType || s.powerTypes.includes(String(props.record.powerType)))
const sampleId = ref<string | null>(null)
watch(() => [props.collection, props.record.powerType], () => {
  const current = samples.value.find(s => s.id === sampleId.value)
  if (!current || !fits(current)) sampleId.value = (samples.value.find(fits) ?? samples.value[0])?.id ?? null
}, { immediate: true })
const sample = computed(() => samples.value.find(s => s.id === sampleId.value) ?? null)
const level = ref(5)
const klass = ref<string | null>(null)
watch(sample, (s) => {
  if (!s) return
  level.value = s.level
  klass.value = s.class
}, { immediate: true })

const classes = computed(() => (hb.rules?.content.list('classes') ?? []).map(c => ({ value: String(c.id), label: String(c.name) })))
const sampleItems = computed(() => samples.value.map(s => ({ value: s.id, label: t(s.label) })))

interface Result { changes: ReturnType<typeof diffSummaries>, placed: boolean }
const result = shallowRef<Result | null>(null)
const failed = ref(false)
watchEffect(() => {
  const loaded = hb.loaded
  const s = sample.value
  if (!loaded || !s || !hb.records) return
  try {
    const itemKind = hb.itemKinds[props.collection]
    const draft = { ...props.record, id: PREVIEW_ID }
    const records = mergeHomebrew(hb.records, [{ id: PREVIEW_ID, kind: props.collection, data: draft }], hb.itemKinds)
    const rules = loaded.withRecords(records)
    const base = sampleCharacter(s, rules.content, loaded.game.def, level.value, klass.value ?? s.class)
    const record = { ...draft, ...(itemKind ? { kind: itemKind } : {}) }
    const placed = placeRecord(base, props.collection, record, rules.content) ?? gameHomebrew?.place?.(base, props.collection, record, rules.content) ?? null
    const before = sheetSummary(rules.sheet(base))
    const after = placed ? sheetSummary(rules.sheet(placed)) : before
    result.value = { changes: diffSummaries(before, after), placed: Boolean(placed) }
    failed.value = false
  }
  catch {
    // A draft the rules can't compute yet: keep the last result.
    failed.value = true
  }
})

const tr = (key: string, fallback: string) => (te(key) ? t(key) : fallback)
function label(key: string): string {
  const [kind, a = '', ...rest] = key.split('.')
  const name = [a, ...rest].join('.')
  switch (kind) {
    case 'ac': return t('ac_title')
    case 'hp': return t('hit_points_title')
    case 'initiative': return t('sheet.initiative')
    case 'pool': return tr(`sheet.vitals.${a.replaceAll('-', '_')}`, a)
    case 'ability': return tr(`abilities.${a}.title`, a)
    case 'save': return t('homebrew.summary.save', { ability: tr(`abilities.${a}.title`, a) })
    case 'skill': return String(hb.rules?.content.get('skills', a)?.name ?? a)
    case 'speed': return tr(`speeds.${a}.title`, a)
    case 'sense': return tr(`senses.${a.replaceAll('-', '_')}_title`, a)
    case 'defense': return tr(`homebrew.summary.defense.${a}`, a)
    case 'special': return tr(`homebrew.summary.special.${a}`, a)
    case 'attack': return t('homebrew.summary.attack', { name })
    case 'power': return t('homebrew.summary.power', { name })
    case 'card': return rest.join('.') || a
    default: return key
  }
}
</script>

<template>
  <div class="flex flex-col gap-3" data-preview>
    <div class="grid gap-2 sm:grid-cols-3">
      <UFormField :label="t('homebrew.preview.sample')">
        <USelect :model-value="sampleId ?? undefined" :items="sampleItems" class="w-full" @update:model-value="v => (sampleId = v as string)" />
      </UFormField>
      <UFormField :label="t('class_title', 1)">
        <USelect :model-value="klass ?? undefined" :items="classes" class="w-full" @update:model-value="v => (klass = v as string)" />
      </UFormField>
      <UFormField :label="t('homebrew.preview.level')">
        <UInputNumber v-model="level" :min="1" :max="20" class="w-full" />
      </UFormField>
    </div>
    <div v-if="!hb.loaded" class="flex justify-center py-6">
      <UIcon name="i-lucide-loader-circle" class="size-5 animate-spin text-dimmed" />
    </div>
    <template v-else-if="result">
      <p v-if="failed" class="text-sm text-warning">
        {{ t('homebrew.preview.stale') }}
      </p>
      <p v-if="!result.placed" class="text-sm text-muted">
        {{ t('homebrew.preview.not_placed') }}
      </p>
      <h3 class="eyebrow text-muted">
        {{ t('homebrew.preview.changes') }}
      </h3>
      <p v-if="!result.changes.length" class="text-sm text-muted">
        {{ t('homebrew.preview.no_changes') }}
      </p>
      <ul v-else class="divide-y divide-default rounded-md border border-default bg-default text-sm">
        <li v-for="c in result.changes" :key="c.key" class="flex flex-wrap items-baseline gap-x-3 gap-y-0.5 px-3 py-2" :data-change="c.key">
          <span class="min-w-32 font-semibold text-highlighted">{{ label(c.key) }}</span>
          <span class="font-mono">
            <template v-if="c.before !== null && c.after !== null"><span class="text-muted">{{ c.before }}</span> → <span class="text-highlighted">{{ c.after }}</span></template>
            <template v-else-if="c.after !== null"><span class="text-success">{{ t('homebrew.preview.added') }}</span> <span class="text-highlighted">{{ c.after }}</span></template>
            <template v-else><span class="text-error">{{ t('homebrew.preview.removed') }}</span> <span class="text-muted">{{ c.before }}</span></template>
          </span>
        </li>
      </ul>
    </template>
  </div>
</template>
