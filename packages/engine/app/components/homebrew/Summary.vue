<script setup lang="ts">
/**
 * A homebrew record shown read-only (plan/26 §1.3): its fields in the kind's form order
 * with their values in words, its effects by name, and its description through `<MDC>`.
 * Built from the same form data as the editor, so it never needs Nuxt Content in the
 * browser (the reference components query it).
 */
import type { FieldDef, HomebrewKindDef } from '@omnibrew/engine/schemas'
import { escapeTags, fieldShown, getPath } from '../../utils/homebrew'

type Rec = Record<string, unknown>
const props = defineProps<{ kind: HomebrewKindDef, record: Rec }>()
// Others' text: escaped before anything renders it.
const record = computed(() => escapeTags(props.record))
const { t } = useI18n()
const options = useHomebrewOptions()
const hb = useHomebrewRules()
const { distance } = useUnits()

function formula(v: unknown): string {
  const f = v as { type?: string, value?: unknown, multiplier?: number } | undefined
  if (!f?.type) return ''
  if (f.type === 'flat') return String(f.value ?? 0)
  if (f.type === 'mod') return t('homebrew.formula.mod_of', { ability: options.valueLabel(String(f.value), 'abilities.{v}.title') })
  if (f.type === 'level') return f.multiplier && f.multiplier !== 1 ? `${t('homebrew.formula.level')} × ${f.multiplier}` : t('homebrew.formula.level')
  return t(`homebrew.formula.${f.type}`)
}
function damage(list: unknown): string {
  return (Array.isArray(list) ? list as Rec[] : []).map((d) => {
    const bonus = (d.bonus as Rec | undefined)?.value
    return `${d.dieCount ? `${d.dieCount}d${d.dieType}` : ''}${bonus ? `${d.dieCount ? ' + ' : ''}${bonus}` : ''} ${d.type ? options.valueLabel(String(d.type), 'damage_types.{v}') : ''}`.trim()
  }).join(', ')
}
function text(field: FieldDef, record: Rec): string {
  const v = getPath(record, field.path)
  const i = field.input
  if (v === undefined || v === null || v === '') return ''
  switch (i.kind) {
    case 'boolean': return v ? t('homebrew.yes') : ''
    case 'enum': return ([] as unknown[]).concat(v).map(x => options.valueLabel(String(x), i.labels)).join(', ')
    case 'choice': return ([] as unknown[]).concat(v).map(x => options.valueLabel(x as string, i.labels)).join(', ')
    case 'record': return ([] as unknown[]).concat(v).map(x => options.recordName(i.collection, String(x))).join(', ')
    case 'formula': return formula(v)
    case 'damage-list': return damage(v)
    case 'properties': return (v as Array<{ id: string, value?: unknown }>).map(p => `${options.recordName(i.collection, p.id)}${p.value !== undefined ? ` ${p.value}` : ''}`).join(', ')
    case 'resource': return t('homebrew.uses_per', { n: (v as { max?: { value?: unknown } }).max?.value ?? 0, reset: t(`homebrew.reset.${(v as { reset?: string }).reset ?? 'long'}`) })
    case 'attack': return t(`homebrew.attack_type.${(v as { type?: string }).type ?? 'none'}`)
    case 'save': return options.valueLabel(String((v as { save?: string }).save ?? ''), 'abilities.{v}.title')
    case 'number': return field.path.endsWith('range.short') || field.path.endsWith('range.long') || field.path.endsWith('aoe.size') || field.path.endsWith('distance') ? distance(Number(v)) : String(v)
    case 'markdown': case 'effects': case 'upcasts': case 'advancements': return ''
    default: return String(v)
  }
}
const stats = computed(() => props.kind.groups.flatMap(g => g.fields)
  .filter(f => fieldShown(f, record.value) && f.path !== 'name')
  .map(f => ({ label: t(f.label), value: text(f, record.value) }))
  .filter(s => s.value))

const effects = computed(() => (Array.isArray(record.value.mechanics) ? record.value.mechanics as Rec[] : []).map((m) => {
  const tpl = hb.game?.def.homebrew?.effects.find(e => e.type === m.type)
  if (!tpl) return { name: t('homebrew.advanced_effect'), detail: String(m.type) }
  return { name: t(tpl.label), detail: tpl.fields.filter(f => fieldShown(f, m)).map(f => text(f, m)).filter(Boolean).join(' · ') }
}))
const advancements = computed(() => (Array.isArray(record.value.advancements) ? record.value.advancements as Array<{ id: string, name: string, text: string }> : []))
const body = computed(() => (typeof record.value.body === 'string' ? record.value.body : ''))
</script>

<template>
  <div class="flex flex-col gap-5">
    <img v-if="typeof record.image === 'string' && record.image" :src="record.image" alt="" class="max-h-40 self-start rounded-sm bg-muted object-contain p-2">
    <p v-if="typeof record.flavor === 'string' && record.flavor" class="text-muted italic">
      {{ record.flavor }}
    </p>
    <dl class="grid gap-x-6 gap-y-2 sm:grid-cols-2">
      <div v-for="s in stats" :key="s.label" class="flex flex-col">
        <dt class="eyebrow text-muted">
          {{ s.label }}
        </dt>
        <dd class="text-highlighted">
          {{ s.value }}
        </dd>
      </div>
    </dl>
    <section v-if="effects.length">
      <h2 class="eyebrow mb-2 text-muted">
        {{ t('homebrew.fields.effects') }}
      </h2>
      <ul class="flex flex-col gap-1 text-sm">
        <li v-for="(e, i) in effects" :key="i">
          <span class="font-semibold text-highlighted">{{ e.name }}</span><template v-if="e.detail">: {{ e.detail }}</template>
        </li>
      </ul>
    </section>
    <MDC v-if="body.trim()" :value="body" class="prose-record max-w-[45rem]" />
    <section v-if="advancements.length" class="flex flex-col gap-2">
      <h2 class="eyebrow text-muted">
        {{ t('homebrew.fields.advancements') }}
      </h2>
      <UCard v-for="a in advancements" :key="a.id">
        <p class="font-semibold text-highlighted">
          {{ a.name }}
        </p>
        <MDC :value="a.text" class="mt-1 text-sm" />
      </UCard>
    </section>
  </div>
</template>
