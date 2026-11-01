<script setup lang="ts">
/** Defenses (resistances, immunities, vulnerabilities, special defenses) beside the active conditions, which open the conditions dialog. */
import { actions } from '@omnibrew/engine/rules'

const { t, te } = useI18n()
const { game } = useAppConfig()
const { sheet, character, editable } = useSheet()
const ui = useSheetUi()

const name = (collection: string, id: string) => sheet.value.content.get(collection, id)?.name ?? id
const damageName = (id: string) => (te(`damage_types.${id}`) ? t(`damage_types.${id}`) : id)

const defenses = computed(() => {
  const d = sheet.value.defenses
  const list = (kind: keyof typeof d, label: (id: string) => string) => d[kind].map(e => ({ kind, text: e.label ?? label(e.id), note: e.note }))
  return [
    ...list('resistance', damageName),
    ...list('immunity', damageName),
    ...list('vulnerability', damageName),
    ...list('condition-immunity', id => name(game.sheet.conditions, id)),
    ...sheet.value.specialDefenses.map(s => ({ kind: 'special', text: t(`sheet.defenses.special.${s.id}`), note: s.note })),
  ]
})

const conditions = computed(() => [
  ...character.value.state.conditions.map(id => name(game.sheet.conditions, id)),
  ...actions.gradientConditions(sheet.value).filter(g => g.value > 0).map(g => `${name(game.sheet.conditions, g.id)} ${g.value}`),
])
</script>

<template>
  <div class="grid grid-cols-2 overflow-hidden rounded-md border border-default bg-muted">
    <section class="min-w-0 border-e border-default p-3">
      <h2 class="eyebrow text-muted">
        {{ t('sheet.defenses.title') }}
      </h2>
      <ul v-if="defenses.length" class="mt-1 flex flex-col gap-0.5 text-sm" data-sheet="defenses">
        <li v-for="(d, i) in defenses" :key="i" :title="d.note">
          <span class="text-highlighted">{{ d.text }}</span> <span class="text-xs text-muted">{{ t(`sheet.defenses.kind.${d.kind}`) }}</span>
        </li>
      </ul>
      <p v-else class="mt-1 text-sm text-muted">
        {{ t('none') }}
      </p>
    </section>
    <section class="min-w-0 p-3">
      <div class="flex items-center justify-between gap-2">
        <h2 class="eyebrow text-muted">
          {{ t('conditions_title') }}
        </h2>
        <UButton v-if="editable" icon="i-lucide-pencil" size="xs" color="neutral" variant="ghost" :aria-label="t('sheet.conditions.edit')" @click="ui.open('conditions')" />
      </div>
      <ul v-if="conditions.length" class="mt-1 flex flex-col gap-0.5 text-sm text-highlighted" data-sheet="conditions">
        <li v-for="c in conditions" :key="c">
          {{ c }}
        </li>
      </ul>
      <p v-else class="mt-1 text-sm text-muted">
        {{ t('none') }}
      </p>
    </section>
  </div>
</template>
