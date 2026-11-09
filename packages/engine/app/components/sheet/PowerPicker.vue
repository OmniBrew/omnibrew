<script setup lang="ts">
/**
 * The power picker (the live MeCsKlassPowerSelect), per class: its list plus other
 * classes' (`use-class-for-*-list`), the counts against the class's known powers and
 * cantrips, advancements (unless the game says no: ME `me:prevent-advancements`).
 * In the sheet's power manager and the builder's Powers step.
 */
import { actions, type Rec } from '@omnibrew/engine/rules'

const { t } = useI18n()
const { sheet, character, apply } = useSheet()

const classes = computed(() => sheet.value.classes.filter(k => {
  const pc = sheet.value.powercasting.byClass[k.id]
  return pc && (pc.maxPowerLevel >= 0 || pc.numCantrips > 0)
}))
const classId = ref(classes.value[0]?.id ?? '')
watch(classes, (list) => {
  if (!list.some(k => k.id === classId.value)) classId.value = list[0]?.id ?? ''
})

const picker = computed(() => (classId.value ? actions.powerPicker(sheet.value, classId.value) : null))
const search = ref('')
const learnedOnly = ref(false)
const level = ref<'all' | number>('all')
const rows = computed(() => (picker.value?.rows ?? []).filter(r =>
  (!search.value || String(r.power.name).toLowerCase().includes(search.value.toLowerCase()))
  && (!learnedOnly.value || r.learned || r.fromFeature)
  && (level.value === 'all' || r.power.level === level.value)))
const levels = computed(() => [...new Set((picker.value?.rows ?? []).map(r => r.power.level as number))].sort((a, b) => a - b))
const expanded = ref<string | null>(null)

const full = (r: { power: Rec, learned: boolean }) => {
  const p = picker.value
  if (!p || r.learned) return false
  return r.power.level === 0 ? p.cantrips >= p.limits.numCantrips : p.powers >= p.limits.numPowers
}
const toggle = (id: string) => apply(s => actions.togglePower(s.character, classId.value, id))
function advance(r: { power: Rec, fromFeature: string | false }, advancement: string) {
  apply(s => (r.fromFeature
    ? actions.setGrantedAdvancement(s.character, r.fromFeature, r.power.id, advancement)
    : actions.setPowerAdvancement(s.character, classId.value, r.power.id, advancement)))
}
const forget = (id: string) => apply(s => actions.togglePower(s.character, null, id))
const unlinked = computed(() => character.value.powers.filter(p => !p.class))
const levelName = (l: number) => (l === 0 ? t('sheet.powers.cantrips') : t(`ordinal_numbers[${l}]`))
</script>

<template>
  <div class="flex flex-col gap-3 text-sm">
    <p v-if="!classes.length" class="text-muted">
      {{ t('sheet.powers.no_casters') }}
    </p>
    <template v-else>
      <UTabs v-if="classes.length > 1" v-model="classId" :items="classes.map(k => ({ label: k.data.name, value: k.id }))" :content="false" />
      <div v-if="picker" class="flex flex-wrap gap-2" data-power-counts>
        <UBadge :label="t('sheet.powers.cantrips_known', { n: picker.cantrips, max: picker.limits.numCantrips })" :color="picker.cantrips > picker.limits.numCantrips ? 'error' : picker.cantrips < picker.limits.numCantrips ? 'warning' : 'success'" variant="soft" />
        <UBadge :label="t('sheet.powers.powers_known', { n: picker.powers, max: picker.limits.numPowers })" :color="picker.powers > picker.limits.numPowers ? 'error' : picker.powers < picker.limits.numPowers ? 'warning' : 'success'" variant="soft" />
        <UBadge v-if="picker.limits.maxPowerLevel > 0" :label="t('sheet.powers.max_level', { n: picker.limits.maxPowerLevel })" color="neutral" variant="soft" />
      </div>
      <div class="flex flex-wrap items-center gap-2">
        <UInput v-model="search" icon="i-lucide-search" :placeholder="t('search')" class="min-w-40 flex-1" />
        <USelect v-model="level" :items="[{ label: t('all_title'), value: 'all' }, ...levels.map(l => ({ label: levelName(l), value: l }))]" class="w-32" :aria-label="t('level_title', 1)" />
        <USwitch v-model="learnedOnly" :label="t('sheet.powers.learned_only')" />
      </div>
      <ul class="flex flex-col gap-1">
        <li v-for="r in rows" :key="r.power.id" class="rounded-sm border border-default bg-muted">
          <div class="flex items-center gap-2 p-2">
            <UCheckbox
              :model-value="r.learned || !!r.fromFeature"
              :disabled="!!r.fromFeature || full(r)"
              :aria-label="t('sheet.powers.learn', { name: r.power.name })"
              @update:model-value="toggle(r.power.id)"
            />
            <button type="button" class="flex min-w-0 flex-1 items-center gap-2 text-start" :aria-expanded="expanded === r.power.id" @click="expanded = expanded === r.power.id ? null : r.power.id">
              <span class="truncate font-semibold text-highlighted">{{ r.power.name }}</span>
              <span class="text-xs text-muted">{{ levelName(r.power.level) }}</span>
              <UBadge v-if="r.power.homebrew" :label="t('homebrew.badge')" color="secondary" variant="subtle" size="sm" :title="r.power.author ? t('homebrew.by', { name: r.power.author }) : undefined" />
              <UBadge v-if="r.fromFeature" :label="t('sheet.powers.from_feature')" color="neutral" variant="soft" size="sm" />
              <UBadge v-if="r.notAvailable" :label="t('sheet.powers.not_available')" color="error" variant="soft" size="sm" />
              <UBadge v-if="r.advancement" :label="(r.power.advancements ?? []).find((a: Rec) => a.id === r.advancement)?.name ?? r.advancement" color="primary" variant="soft" size="sm" />
            </button>
          </div>
          <div v-if="expanded === r.power.id" class="border-t border-default p-3">
            <SheetProse :id="r.power.id" collection="powers" class="text-sm" />
            <fieldset v-if="(r.power.advancements ?? []).length && !r.noAdvancements && (r.learned || r.fromFeature)" class="mt-3 flex flex-col gap-2">
              <legend class="eyebrow mb-1 text-muted">
                {{ t('advancement_options_title') }}
              </legend>
              <UCheckbox
                v-for="a in r.power.advancements"
                :key="a.id"
                :model-value="r.advancement === a.id"
                :label="a.name"
                :description="htmlToText(a.text)"
                @update:model-value="advance(r, a.id)"
              />
            </fieldset>
          </div>
        </li>
      </ul>
    </template>
    <div v-if="unlinked.length" class="flex flex-col gap-1">
      <h3 class="eyebrow text-muted">
        {{ t('sheet.powers.unlinked') }}
      </h3>
      <div v-for="p in unlinked" :key="p.id" class="flex items-center gap-2">
        <span class="flex-1">{{ sheet.content.get('powers', p.id)?.name ?? p.id }}</span>
        <UButton icon="i-lucide-trash-2" color="error" variant="ghost" size="xs" :aria-label="t('characters.delete')" @click="forget(p.id)" />
      </div>
    </div>
  </div>
</template>
