<script setup lang="ts">
/**
 * A generated NPC's stat block: the engine's stat block parts (lines, sections, entries)
 * laid out as its StatblockSheet, with ME's shields, but with the records it names given
 * from the rules bundle (`refs`) instead of Nuxt Content queries, which the generator page
 * never loads. Leveled powercasting lists its powers by level: a generated caster's slots
 * or tech points are in the feature's text.
 */
import type { GeneratedNpc, NpcEntry } from '../../../../generators/npc'
import { isLeveledPowercasting, powerLevelLines, type NpcSheetRefs } from '../../../../generators/npc-sheet'

const props = defineProps<{
  npc: GeneratedNpc
  refs: NpcSheetRefs
}>()

const { t } = useI18n()
const { distance } = useUnits()
const feet = (n: number | undefined) => (Number(n) === 0 ? `0${distance(0, { abbr: true })}` : distance(Number(n), { abbr: true }))

const stats = computed(() => props.npc as unknown as StatBlockData)
const scores = computed(() => props.npc.abilityScores as Record<string, number>)
const prof = computed(() => props.npc.profBonus)
const irv = computed(() => props.npc.irv ?? {})
const entries = computed(() => statEntries(stats.value))
const sections = computed(() => [
  { key: 'features', title: t('npc.traits_title'), list: shownEntries(entries.value.features) },
  { key: 'actions', title: t('npc.actions_title'), list: shownEntries(sortActions(entries.value.actions)) },
  { key: 'reactions', title: t('npc.reactions_title'), list: shownEntries(entries.value.reactions) },
].filter(s => s.list.length))
const legendary = computed(() => entries.value.legendary)
const powerLines = (e: StatEntry) => powerLevelLines(t, e as NpcEntry, props.refs.powers)
</script>

<template>
  <div class="text-[0.90625rem]/[1.55]" data-generated-npc>
    <div class="rounded-md border border-t-3 border-default border-t-(--ui-tick) bg-muted px-4 pt-4 pb-5 sm:px-6 sm:pt-5">
      <div class="grid gap-x-10 lg:grid-cols-2">
        <div class="min-w-0">
          <h2 class="text-2xl/[1.15] font-bold text-highlighted">
            {{ npc.name }}
          </h2>
          <p class="mt-0.5 text-muted italic">
            {{ creatureKindText(t, npc) }}
          </p>
          <hr class="statblock-rule">
          <StatblockLine :label="t('ac_title')">
            {{ npc.ac }}
          </StatblockLine>
          <StatblockLine :label="t('hit_points_title')">
            {{ hitPointsText(t, npc.hp, scores.con) }}
          </StatblockLine>
          <StatblockLine v-if="npc.shields" :label="t('shields_title')">
            {{ npcShieldsText(t, npc.shields) }}
          </StatblockLine>
          <StatblockLine :label="t('speed_title')">
            <StatblockText :value="speedText(t, npc.speed, feet)" />
          </StatblockLine>

          <hr class="statblock-rule">
          <dl class="grid grid-cols-3 gap-1 gap-y-2 text-center sm:grid-cols-6 lg:grid-cols-3 xl:grid-cols-6">
            <div v-for="a in abilityScoreList(scores)" :key="a.ability">
              <dt class="eyebrow text-muted">
                {{ t(`abilities.${a.ability}.abbr`) }}
              </dt>
              <dd class="mt-0.5 font-mono text-sm whitespace-nowrap text-highlighted tabular-nums">
                {{ abilityScoreText(a.score) }}
              </dd>
            </div>
          </dl>

          <hr class="statblock-rule">
          <StatblockLine v-if="npc.savingThrows?.length" :label="t('saving_throws_title')">
            {{ savingThrowsText(t, npc.savingThrows, scores, prof) }}
          </StatblockLine>
          <StatblockLine v-if="npc.skills?.length" :label="t('skills_title')">
            {{ skillsText(t, npc.skills, scores, prof, refs.skills) }}
          </StatblockLine>
          <StatblockLine v-if="irv.vul?.length" :label="t('npc.damage_vulnerabilities')">
            {{ damageTypesText(t, irv.vul) }}
          </StatblockLine>
          <StatblockLine v-if="irv.res?.length" :label="t('npc.damage_resistances')">
            {{ damageTypesText(t, irv.res) }}
          </StatblockLine>
          <StatblockLine v-if="irv.damImm?.length" :label="t('npc.damage_immunities')">
            {{ damageTypesText(t, irv.damImm) }}
          </StatblockLine>
          <StatblockLine v-if="irv.conImm?.length" :label="t('npc.condition_immunities')">
            {{ conditionsText(t, irv.conImm, refs.conditions) }}
          </StatblockLine>
          <StatblockLine :label="t('senses_title')">
            {{ sensesText(t, passivePerception(scores, prof, npc.skills), npc.senses, feet) }}
          </StatblockLine>
          <StatblockLine :label="t('cr_title')">
            {{ challengeText(t, refs.challenge[npc.cr]) }}
          </StatblockLine>
          <StatblockLine :label="t('class_feature_columns.prof_bonus')">
            {{ modifierText(prof) }}
          </StatblockLine>
        </div>

        <div class="min-w-0 max-lg:mt-4.5">
          <StatblockSection v-for="section in sections" :key="section.key" :title="section.title">
            <template v-for="(e, i) in section.list" :key="e.id ?? i">
              <div v-if="isLeveledPowercasting(e as NpcEntry)">
                <p>
                  <span class="font-semibold italic text-highlighted">{{ entryTitle(t, e) }}</span>{{ ' ' }}<StatblockText v-if="e.text" :value="e.text" />
                </p>
                <StatblockListLines :lines="powerLines(e)" collection="powers" />
              </div>
              <StatblockEntry v-else :entry="e" :scores="scores" :prof-bonus="prof" :refs="refs" :rules="npcWeaponRules" />
            </template>
          </StatblockSection>

          <StatblockSection v-if="legendary?.actions?.length" :title="t('npc.legendary_title')">
            <p v-if="legendary.text">
              <StatblockText :value="legendary.text" />
            </p>
            <StatblockEntry
              v-for="(e, i) in shownEntries(sortLegendary(legendary.actions))"
              :key="e.id ?? i"
              :entry="e"
              :scores="scores"
              :prof-bonus="prof"
              :refs="refs"
              :rules="npcWeaponRules"
            />
          </StatblockSection>
        </div>
      </div>
    </div>
  </div>
</template>
