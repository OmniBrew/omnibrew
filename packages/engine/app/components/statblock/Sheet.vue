<script setup lang="ts">
/**
 * A creature's 5e stat block: size, type and alignment; armor class, hit points
 * and speed; ability scores; saves, skills, damage and condition immunities,
 * senses, challenge and proficiency bonus; then its features, actions,
 * reactions and legendary actions, with the image beside it and the record's
 * notes under it. The weapons, powers, items, skills, conditions and challenge
 * ratings it names are looked up in their collections.
 *
 * Slot `defenses`: more lines after hit points (ME5e shields).
 */
import type { StatBlockData, StatBlockRefs, StatBlockRules, StatDamage } from '../../utils/statblock'

const props = withDefaults(defineProps<{
  stats: StatBlockData & { body?: unknown }
  rules?: StatBlockRules
  /** Power slots by power level and caster level, for leveled powercasting. */
  slots?: number[][]
}>(), {
  rules: () => ({}),
  slots: () => [],
})

defineSlots<{ defenses?: () => unknown }>()

const { t } = useI18n()
const { distance } = useUnits()

// Lookup tables every stat block shares.
const { data: tables } = useAsyncData('statblock:tables', async () => {
  const [challenge, skills, conditions] = await Promise.all([
    queryCollection('npcStats').select('stem', 'cr', 'xp').all(),
    queryCollection('skills').select('stem', 'name', 'link').all(),
    queryCollection('conditions').select('stem', 'name').all(),
  ])
  return {
    challenge: Object.fromEntries(challenge.map(r => [recordId(r), { cr: r.cr ?? '', xp: r.xp ?? 0 }])),
    skills: Object.fromEntries(skills.map(r => [recordId(r), { name: r.name ?? '', link: r.link ?? '' }])),
    conditions: Object.fromEntries(conditions.map(r => [recordId(r), r.name ?? ''])),
  }
}, { default: () => ({ challenge: {}, skills: {}, conditions: {} }) })

// The weapons, powers and items this creature names.
const ids = statBlockRefIds(props.stats)
const paths = (collection: string, list: string[]) => list.map(id => `/${collection}/${id}`)
const { data: linked } = useAsyncData(`statblock:${props.stats.path ?? props.stats.name}`, async () => {
  const [weapons, powers, items] = await Promise.all([
    ids.weapons.length ? queryCollection('weapons').where('path', 'IN', paths('weapons', ids.weapons)).select('stem', 'name', 'weaponType', 'damage', 'properties', 'range').all() : [],
    ids.powers.length ? queryCollection('powers').where('path', 'IN', paths('powers', ids.powers)).select('stem', 'name', 'level').all() : [],
    ids.items.length ? queryCollection('gear').where('path', 'IN', paths('gear', ids.items)).select('stem', 'name').all() : [],
  ])
  return {
    weapons: Object.fromEntries(weapons.map(w => [recordId(w), { ...w, damage: w.damage as StatDamage | undefined }])),
    powers: Object.fromEntries(powers.map(p => [recordId(p), { name: p.name ?? '', level: p.level ?? 0 }])),
    items: Object.fromEntries(items.map(i => [recordId(i), i.name ?? ''])),
  }
}, { default: () => ({ weapons: {}, powers: {}, items: {} }) })

const refs = computed<StatBlockRefs>(() => ({ ...tables.value, ...linked.value }))
const scores = computed(() => props.stats.abilityScores ?? {})
const prof = computed(() => props.stats.profBonus ?? 0)
const entries = computed(() => statEntries(props.stats))
const irv = computed(() => props.stats.irv ?? {})
const immunities = computed(() => damageImmunities(irv.value))
// useUnits leaves out a 0 (content writes `:distance{length="0"}` for the unit alone); a speed of 0 shows it.
const feet = (n: number | undefined) => (Number(n) === 0 ? `0${distance(0, { abbr: true })}` : distance(Number(n), { abbr: true }))
const hasNotes = computed(() => !!bodyText(props.stats.body))
const brokenImage = ref(false)
const image = computed(() => (brokenImage.value ? undefined : props.stats.image))
// The light frame (for dark renders on transparent backgrounds) shows once the image has loaded.
const imageEl = useTemplateRef('imageEl')
const imageLoaded = ref(false)
onMounted(() => {
  // It may have loaded, or failed, before hydration.
  if (!imageEl.value?.complete) return
  if (imageEl.value.naturalWidth) imageLoaded.value = true
  else brokenImage.value = true
})
</script>

<template>
  <div class="text-sm leading-6">
    <div class="grid gap-6" :class="image ? 'md:grid-cols-[minmax(0,1fr)_14rem]' : ''">
      <div class="min-w-0">
        <p class="italic text-muted">
          {{ creatureKindText(t, stats) }}
        </p>
        <USeparator color="secondary" class="my-3" :ui="{ border: 'border-t-2' }" />
        <StatblockLine :label="t('ac_title')">
          {{ armorClassText(stats.ac, stats.acNote) }}
        </StatblockLine>
        <StatblockLine v-if="stats.hp" :label="t('hit_points_title')">
          {{ hitPointsText(t, stats.hp, scores.con) }}
        </StatblockLine>
        <slot name="defenses" />
        <StatblockLine v-if="stats.speed" :label="t('speed_title')">
          <StatblockText :value="speedText(t, stats.speed, feet)" />
        </StatblockLine>

        <USeparator color="secondary" class="my-3" :ui="{ border: 'border-t-2' }" />
        <dl class="grid grid-cols-3 gap-y-2 text-center sm:grid-cols-6">
          <div v-for="a in abilityScoreList(scores)" :key="a.ability">
            <dt class="font-display text-xs font-semibold uppercase tracking-wider text-muted">
              {{ t(`abilities.${a.ability}.abbr`) }}
            </dt>
            <dd>{{ abilityScoreText(a.score) }}</dd>
          </div>
        </dl>

        <USeparator color="secondary" class="my-3" :ui="{ border: 'border-t-2' }" />
        <StatblockLine v-if="stats.savingThrows?.length" :label="t('saving_throws_title')">
          {{ savingThrowsText(t, stats.savingThrows, scores, prof) }}
        </StatblockLine>
        <StatblockLine v-if="stats.skills?.length" :label="t('skills_title')">
          {{ skillsText(t, stats.skills, scores, prof, refs.skills) }}
        </StatblockLine>
        <StatblockLine v-if="irv.vul?.length" :label="t('npc.damage_vulnerabilities')">
          {{ damageTypesText(t, irv.vul) }}
        </StatblockLine>
        <StatblockLine v-if="irv.res?.length" :label="t('npc.damage_resistances')">
          {{ damageTypesText(t, irv.res) }}
        </StatblockLine>
        <StatblockLine v-if="immunities.length" :label="t('npc.damage_immunities')">
          {{ damageTypesText(t, immunities) }}
        </StatblockLine>
        <StatblockLine v-if="irv.conImm?.length" :label="t('npc.condition_immunities')">
          {{ conditionsText(t, irv.conImm, refs.conditions) }}
        </StatblockLine>
        <StatblockLine :label="t('senses_title')">
          {{ sensesText(t, passivePerception(scores, prof, stats.skills), stats.senses, feet) }}
        </StatblockLine>
        <StatblockLine :label="t('cr_title')">
          {{ challengeText(t, stats.cr ? refs.challenge[stats.cr] : undefined) }}
        </StatblockLine>
        <StatblockLine :label="t('class_feature_columns.prof_bonus')">
          {{ modifierText(prof) }}
        </StatblockLine>

        <template v-if="entries.features?.length">
          <USeparator color="secondary" class="my-3" :ui="{ border: 'border-t-2' }" />
          <div class="space-y-3">
            <StatblockEntry
              v-for="(e, i) in shownEntries(entries.features)"
              :key="e.id ?? i"
              :entry="e"
              :scores="scores"
              :prof-bonus="prof"
              :refs="refs"
              :rules="rules"
              :slots="slots"
            />
          </div>
        </template>

        <StatblockSection v-if="entries.actions?.length" :title="t('npc.actions_title')">
          <StatblockEntry
            v-for="(e, i) in shownEntries(sortActions(entries.actions))"
            :key="e.id ?? i"
            :entry="e"
            :scores="scores"
            :prof-bonus="prof"
            :refs="refs"
            :rules="rules"
            :slots="slots"
          />
        </StatblockSection>

        <StatblockSection v-if="entries.reactions?.length" :title="t('npc.reactions_title')">
          <StatblockEntry
            v-for="(e, i) in shownEntries(entries.reactions)"
            :key="e.id ?? i"
            :entry="e"
            :scores="scores"
            :prof-bonus="prof"
            :refs="refs"
            :rules="rules"
            :slots="slots"
          />
        </StatblockSection>

        <StatblockSection v-if="entries.legendary" :title="t('npc.legendary_title')">
          <p v-if="entries.legendary.text">
            <StatblockText :value="entries.legendary.text" />
          </p>
          <StatblockEntry
            v-for="(e, i) in shownEntries(sortLegendary(entries.legendary.actions))"
            :key="e.id ?? i"
            :entry="e"
            :scores="scores"
            :prof-bonus="prof"
            :refs="refs"
            :rules="rules"
            :slots="slots"
          />
        </StatblockSection>
      </div>

      <img
        v-if="image"
        ref="imageEl"
        :src="image"
        :alt="stats.name"
        referrerpolicy="no-referrer"
        class="order-first mx-auto max-h-40 rounded-lg object-contain md:order-none md:max-h-96 md:w-full md:self-start"
        :class="imageLoaded ? 'bg-neutral-200 p-2' : 'invisible'"
        @load="imageLoaded = true"
        @error="brokenImage = true"
      >
    </div>

    <UCard v-if="hasNotes" class="mt-6">
      <ContentRenderer :value="stats" class="prose-record" />
    </UCard>
  </div>
</template>
