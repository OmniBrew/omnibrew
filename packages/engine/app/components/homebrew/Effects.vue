<script setup lang="ts">
/**
 * A record's effects (`mechanics`) as forms (plan/26 §1.3, decision 4): "Add effect" lists the
 * game's effect templates in plain words, grouped; each effect is a small form. An effect
 * whose type has no template (a record based on official content) is kept, shown as
 * "Advanced effect (kept as is)", and can be removed.
 */
import type { DropdownMenuItem } from '@nuxt/ui'
import type { EffectTemplate } from '@omnibrew/engine/schemas'
import { newEffect } from '../../utils/homebrew'

type Mech = Record<string, unknown> & { type?: string }
const props = defineProps<{ modelValue: unknown, errors?: Record<string, string[]> }>()
const emit = defineEmits<{ 'update:modelValue': [value: Mech[] | undefined] }>()
const { t, te } = useI18n()
const hb = useHomebrewRules()

const list = computed<Mech[]>(() => (Array.isArray(props.modelValue) ? props.modelValue as Mech[] : []))
const templates = computed<EffectTemplate[]>(() => hb.game?.def.homebrew?.effects ?? [])
const templateOf = (type?: string) => templates.value.find(e => e.type === type)

const menu = computed<DropdownMenuItem[][]>(() => {
  const groups = new Map<string, EffectTemplate[]>()
  for (const e of templates.value) groups.set(e.group, [...groups.get(e.group) ?? [], e])
  return [...groups.entries()].map(([group, items]) => [
    { label: t(group), type: 'label' as const },
    ...items.map(e => ({ label: t(e.label), onSelect: () => emit('update:modelValue', [...list.value, newEffect(e)]) })),
  ])
})

const update = (i: number, m: Record<string, unknown>) => emit('update:modelValue', list.value.map((x, j) => (j === i ? m : x)))
function remove(i: number) {
  const next = list.value.filter((_, j) => j !== i)
  emit('update:modelValue', next.length ? next : undefined)
}
// Errors are keyed by dot paths (`mechanics.2.value`); those on the effect itself or a field it has no input for show under it.
const errorsAt = (i: number, path: string) => props.errors?.[`mechanics.${i}.${path}`]
const effectErrors = (i: number) => {
  const shown = new Set((templateOf(list.value[i]?.type)?.fields ?? []).map(f => `mechanics.${i}.${f.path}`))
  return Object.entries(props.errors ?? {}).filter(([p]) => (p === `mechanics.${i}` || p.startsWith(`mechanics.${i}.`)) && !shown.has(p)).flatMap(([, m]) => m)
}
</script>

<template>
  <div class="flex flex-col gap-3">
    <p v-if="!list.length" class="text-sm text-muted">
      {{ t('homebrew.effects_empty') }}
    </p>
    <div v-for="(m, i) in list" :key="i" class="rounded-md border border-default bg-muted p-3" data-effect>
      <div class="mb-2 flex items-start gap-2">
        <div class="min-w-0 flex-1">
          <p class="font-label font-semibold text-highlighted">
            {{ templateOf(m.type) ? t(templateOf(m.type)!.label) : t('homebrew.advanced_effect') }}
          </p>
          <p v-if="templateOf(m.type)?.help && te(templateOf(m.type)!.help!)" class="text-sm text-muted">
            {{ t(templateOf(m.type)!.help!) }}
          </p>
          <p v-else-if="!templateOf(m.type)" class="font-mono text-xs text-muted">
            {{ m.type }}
          </p>
        </div>
        <UButton size="sm" color="neutral" variant="ghost" icon="i-lucide-trash-2" :aria-label="t('homebrew.remove')" @click="remove(i)" />
      </div>
      <div v-if="templateOf(m.type)?.fields.length" class="grid gap-3 sm:grid-cols-2">
        <HomebrewField
          v-for="fl in templateOf(m.type)!.fields.filter(x => fieldShown(x, m))"
          :key="fl.path"
          :field="fl"
          :record="m"
          :errors="errorsAt(i, fl.path)"
          :class="fl.input.kind === 'damage-list' || ('long' in fl.input && fl.input.long) ? 'sm:col-span-2' : ''"
          @update="r => update(i, r)"
        />
      </div>
      <p v-for="(e, n) in effectErrors(i)" :key="n" class="mt-2 text-sm text-error">
        {{ e }}
      </p>
    </div>
    <UDropdownMenu :items="menu" :content="{ align: 'start' }" :ui="{ content: 'max-h-80' }">
      <UButton variant="outline" icon="i-lucide-plus" :label="t('homebrew.add_effect')" class="self-start" />
    </UDropdownMenu>
  </div>
</template>
