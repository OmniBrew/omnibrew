<script setup lang="ts">
/**
 * The Class step (the live MeCbClasses*): classes and their levels (20 in all), the
 * subclass, hit points per level (average or rolled), an ability increase or a feat at
 * each increase level, experience, and the choices the classes offer.
 */
import type { Character, ClassEntry } from '@omnibrew/engine/character'
import { actions, type Rec } from '@omnibrew/engine/rules'

const { t } = useI18n()
const { sheet, character, apply } = useSheet()

const classes = computed(() => sheet.value.content.list('classes').sort((a, b) => String(a.name).localeCompare(String(b.name))))
const level = computed(() => sheet.value.level)
const change = (fn: (c: Character) => void) => apply(s => actions.edit(s.character, fn))
const record = (id: string) => sheet.value.content.get('classes', id) ?? {}
const average = (die: number) => Math.ceil((die + 1) / 2)

function hitPoints(entry: Pick<ClassEntry, 'id'>, levels: number, first: boolean, current: number[] = []) {
  const die = Number(record(entry.id).hitDie) || 0
  return Array.from({ length: levels }, (_, i) => current[i] ?? (i === 0 && first ? die : average(die)))
}

const adding = ref('')
function addClass(id: string) {
  if (!id || level.value >= 20) return
  change(c => c.classes.push({ id, levels: 1, subclass: null, hitPoints: hitPoints({ id }, 1, c.classes.length === 0), rolledHitPoints: false, asi: {} }))
  adding.value = ''
}
function setLevels(i: number, levels: number) {
  change((c) => {
    const k = c.classes[i]!
    k.levels = Math.max(1, Math.min(levels, 20 - (level.value - k.levels)))
    k.hitPoints = hitPoints(k, k.levels, i === 0, k.hitPoints)
  })
}
const removeClass = (i: number) => change(c => c.classes.splice(i, 1))
const setSubclass = (i: number, id: string) => change(c => (c.classes[i]!.subclass = id || null))
function setRolled(i: number, rolled: boolean) {
  change((c) => {
    const k = c.classes[i]!
    k.rolledHitPoints = rolled
    if (!rolled) k.hitPoints = hitPoints(k, k.levels, i === 0)
  })
}
const setHp = (i: number, n: number, v: unknown) => change(c => (c.classes[i]!.hitPoints[n] = Math.max(1, Math.floor(Number(v)) || 1)))
const setAsi = (i: number, lvl: number, v: 'asi' | 'feat' | null) => change(c => (c.classes[i]!.asi[String(lvl)] = v))

const asiLevels = (k: Rec, levels: number) => ((k.progression?.abi ?? []) as number[]).filter(l => l <= levels)
const subclassLevel = (k: Rec) => ((k.progression?.subclass ?? []) as number[])[0] ?? 3
const subclasses = (id: string) => sheet.value.content.list('subclasses').filter(s => s.klass === id)

const xp = computed(() => character.value.experience)
</script>

<template>
  <div class="flex flex-col gap-4">
    <div class="flex flex-wrap items-end gap-3">
      <USwitch :model-value="xp.useMilestone" :label="t('builder.class.milestone')" @update:model-value="v => change(c => (c.experience.useMilestone = !!v))" />
      <UFormField v-if="xp.useMilestone" :label="t('sheet.details.milestone')">
        <UInputNumber :model-value="xp.milestone" :min="0" class="w-28" @update:model-value="v => change(c => (c.experience.milestone = Number(v) || 0))" />
      </UFormField>
      <UFormField v-else :label="t('xp_title')">
        <UInputNumber :model-value="xp.points" :min="0" :step="100" class="w-36" @update:model-value="v => change(c => (c.experience.points = Number(v) || 0))" />
      </UFormField>
      <span class="ms-auto text-sm text-muted">{{ t('builder.class.total_level', { n: level }) }}</span>
    </div>

    <article v-for="(entry, i) in character.classes" :key="`${entry.id}-${i}`" class="flex flex-col gap-3 rounded-md border border-default bg-default p-3" :data-class="entry.id">
      <header class="flex flex-wrap items-center gap-3">
        <h2 class="flex-1 font-label text-lg font-semibold text-highlighted">
          {{ record(entry.id).name ?? entry.id }}
        </h2>
        <UFormField :label="t('level_title', 1)" class="w-28">
          <UInputNumber :model-value="entry.levels" :min="1" :max="20 - (level - entry.levels)" @update:model-value="v => setLevels(i, Number(v) || 1)" />
        </UFormField>
        <UButton icon="i-lucide-trash-2" color="error" variant="ghost" :aria-label="t('builder.class.remove', { name: record(entry.id).name })" @click="removeClass(i)" />
      </header>

      <UFormField v-if="subclasses(entry.id).length" :label="t('subclass_title', 1)" :hint="entry.levels < subclassLevel(record(entry.id)) ? t('builder.class.subclass_at', { n: subclassLevel(record(entry.id)) }) : undefined">
        <USelect
          :model-value="entry.subclass ?? NONE"
          :items="[{ label: t('choose_subclass'), value: NONE }, ...subclasses(entry.id).map(s => ({ label: s.name, value: s.id }))]"
          :disabled="entry.levels < subclassLevel(record(entry.id))"
          class="w-full sm:w-80"
          @update:model-value="v => setSubclass(i, fromSelect(v))"
        />
      </UFormField>

      <div v-if="asiLevels(record(entry.id), entry.levels).length" class="flex flex-col gap-2">
        <span class="eyebrow text-muted">{{ t('ability_score_increase_title') }}</span>
        <div v-for="lvl in asiLevels(record(entry.id), entry.levels)" :key="lvl" class="flex flex-wrap items-center gap-2 text-sm">
          <span class="w-24">{{ t('level_nth', { nth: t(`ordinal_numbers[${lvl}]`) }) }}</span>
          <UButton v-for="opt in ['asi', 'feat'] as const" :key="opt" :label="t(`builder.class.${opt}`)" size="sm" :variant="entry.asi[String(lvl)] === opt ? 'soft' : 'outline'" :color="entry.asi[String(lvl)] === opt ? 'primary' : 'neutral'" @click="setAsi(i, lvl, entry.asi[String(lvl)] === opt ? null : opt)" />
        </div>
      </div>

      <div class="flex flex-col gap-2">
        <div class="flex items-center gap-3">
          <span class="eyebrow text-muted">{{ t('hit_points_title') }}</span>
          <USwitch :model-value="entry.rolledHitPoints" :label="t('builder.class.rolled')" size="sm" @update:model-value="v => setRolled(i, !!v)" />
        </div>
        <div class="flex flex-wrap gap-1.5">
          <template v-for="(hp, n) in entry.hitPoints" :key="n">
            <UInputNumber v-if="entry.rolledHitPoints" :model-value="hp" :min="1" :max="Number(record(entry.id).hitDie) || 20" size="sm" class="w-20" :aria-label="t('builder.class.hp_at', { n: n + 1 })" @update:model-value="v => setHp(i, n, v)" />
            <span v-else class="rounded-xs border border-default px-2 py-1 font-mono text-xs" :title="t('builder.class.hp_at', { n: n + 1 })">{{ hp }}</span>
          </template>
        </div>
      </div>

      <details class="text-sm">
        <summary class="cursor-pointer text-muted">
          {{ t('class_features_title') }} ({{ sheet.classes[i]?.features.length ?? 0 }})
        </summary>
        <ul class="mt-2 flex flex-col gap-1">
          <li v-for="f in sheet.classes[i]?.features ?? []" :key="f.id">
            <details>
              <summary class="cursor-pointer">
                <span class="font-semibold text-highlighted">{{ f.name }}</span> <span class="text-xs text-muted">{{ f.level }}</span>
              </summary>
              <SheetProse :id="f.id" collection="class-features" class="py-1 ps-4" />
            </details>
          </li>
        </ul>
      </details>
    </article>

    <div v-if="level < 20" class="flex flex-wrap items-center gap-2">
      <USelect
        v-model="adding"
        :items="classes.filter(k => !character.classes.some(c => c.id === k.id)).map(k => ({ label: k.name, value: k.id }))"
        :placeholder="character.classes.length ? t('builder.class.multiclass') : t('builder.class.choose')"
        class="w-full sm:w-72"
        :aria-label="t('builder.class.choose')"
      />
      <UButton :label="t('builder.class.add')" icon="i-lucide-plus" :disabled="!adding" @click="addClass(adding)" />
    </div>

    <BuilderChoices :prefixes="['class/']" />
  </div>
</template>
