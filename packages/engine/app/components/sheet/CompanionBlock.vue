<script setup lang="ts">
/**
 * One companion's stat block (the live MeCsCompanionStatBlock, in the design's stat block
 * style): picture and name, hit points and the game's pools with damage, heal and regen,
 * AC and speeds; abilities, saves and skills to roll; senses and defenses; conditions;
 * actions by type with to-hit, damage and resources; notes. Numbers come from
 * `companionSheet`; changes go through the engine's companion actions.
 */
import type { CompanionExtension } from '@omnibrew/engine/character'
import { companions as play } from '@omnibrew/engine/rules'

const props = defineProps<{ raw: unknown }>()
const emit = defineEmits<{ edit: [] }>()

const { t, te } = useI18n()
const { sheet, editable, apply } = useSheet()
const { distance } = useUnits()
const { game } = useAppConfig()
const rolls = useSheetRolls()
const rollStore = useRollStore()
const ext = computed<CompanionExtension>(() => sheet.value.game.def.character?.companion ?? {})
const skills = computed(() => sheet.value.content.list('skills').map(s => ({ id: String(s.id), name: String(s.name), ability: s.link })))
const view = computed(() => play.companionSheet(props.raw, ext.value, skills.value))
const c = computed(() => view.value.companion)
const amount = ref<number | null>(null)
const tr = (key: string, fallback: string) => (te(key) ? t(key) : fallback)
const signed = (n: number) => (n >= 0 ? `+${n}` : String(n))
const who = (label: string) => t('sheet.companions.roll_label', { name: c.value.name, label })

const edit = (fn: Parameters<typeof play.editCompanion>[2]) => apply(s => play.editCompanion(s.character, c.value.uuid, fn, ext.value))

function damage(bypass = false) {
  const n = Number(amount.value)
  if (!n) return
  edit(x => play.damageCompanion(x, n, ext.value, { bypass }))
  amount.value = null
}
function heal() {
  const n = Number(amount.value)
  if (!n) return
  edit(x => play.healCompanion(x, n))
  amount.value = null
}
const regen = () => edit(x => play.regenCompanion(x, ext.value))
const hasRegen = computed(() => view.value.pools.some(p => p.regen > 0))

function attack(item: ReturnType<typeof play.companionSheet>['actions'][number]['items'][number], mode: 'advantage' | 'disadvantage' | null) {
  const a = item.action
  const damages = a.dmgDieCount && a.dmgDieType
    ? [{ types: { [a.dmgType || 'damage']: { [a.dmgDieType]: a.dmgDieCount, bonus: a.dmgBonus ?? 0 } } }]
    : []
  rolls.show(rollStore.roll({ label: who(a.name), kind: 'attack', notation: item.hitNotation!, advantage: mode, ...(damages.length ? { damage: { damages } } : {}) }))
}
function rollDamage(item: ReturnType<typeof play.companionSheet>['actions'][number]['items'][number]) {
  const a = item.action
  if (a.dmgDieCount && a.dmgDieType) rolls.damage(who(a.name), [{ types: { [a.dmgType || 'damage']: { [a.dmgDieType]: a.dmgDieCount, bonus: a.dmgBonus ?? 0 } } }])
  else rolls.custom(item.damageNotation!, who(a.name))
}
const setResource = (uuid: string, n: number) => edit(x => play.setCompanionResource(x, uuid, n))
const toggleCondition = (id: string) => edit((x) => {
  x.conditions = x.conditions.includes(id) ? x.conditions.filter(cnd => cnd !== id) : [...x.conditions, id]
})

const conditionOptions = computed(() => sheet.value.content.list(game.sheet.conditions).map(x => String(x.id)).filter(id => !c.value.conImm.includes(id)))
const damageName = (id: string) => tr(`damage_types.${id}`, id)
const conditionName = (id: string) => String(sheet.value.content.get(game.sheet.conditions, id)?.name ?? id)
const perceptionName = computed(() => String(sheet.value.content.get('skills', 'perception')?.name ?? 'Perception'))
const defenses = computed(() => [
  { key: 'resistances', items: c.value.dmgRes.map(damageName) },
  { key: 'immunities', items: c.value.dmgImm.map(damageName) },
  { key: 'vulnerabilities', items: c.value.dmgVul.map(damageName) },
  { key: 'condition_immunities', items: c.value.conImm.map(conditionName) },
].filter(d => d.items.length))
const speeds = computed(() => Object.entries(c.value.speed).filter(([, v]) => Number(v) > 0))
const senses = computed(() => Object.entries(c.value.senses).filter(([, v]) => Number(v) > 0))
</script>

<template>
  <article class="overflow-hidden rounded-md border border-default border-t-3 border-t-secondary bg-muted" :aria-label="c.name" data-companion>
    <header class="flex items-start gap-3 p-3">
      <img v-if="c.image" :src="c.image" alt="" class="size-14 shrink-0 rounded-sm bg-default object-cover">
      <div class="min-w-0 flex-1">
        <h4 class="font-display text-xl font-bold text-highlighted">
          {{ c.name }}
        </h4>
        <p class="text-sm text-muted italic">
          {{ t('sheet.companions.subtitle') }}
        </p>
      </div>
      <UButton v-if="editable" color="neutral" variant="ghost" icon="i-lucide-pencil" :aria-label="t('sheet.companions.edit', { name: c.name })" @click="emit('edit')" />
    </header>
    <div class="statblock-rule" />

    <!-- Defense and vitals -->
    <div class="grid gap-3 p-3 sm:grid-cols-[auto_minmax(0,1fr)]">
      <dl class="grid grid-cols-2 gap-x-4 gap-y-1 text-sm sm:grid-cols-1">
        <div class="flex gap-2">
          <dt class="font-semibold text-highlighted">
            {{ t('ac_title') }}
          </dt>
          <dd class="font-mono" data-companion-ac>
            {{ c.ac }}
          </dd>
        </div>
        <div v-if="speeds.length" class="flex gap-2">
          <dt class="font-semibold text-highlighted">
            {{ t('speed_title') }}
          </dt>
          <dd>
            {{ speeds.map(([type, value]) => `${type === 'walk' ? '' : `${tr(`speeds.${type}.label`, type)} `}${distance(Number(value), { abbr: true })}`).join(', ') }}
          </dd>
        </div>
      </dl>
      <div class="flex flex-col gap-2">
        <SheetPoolBar v-for="p in view.pools" :key="p.id" :label="t(p.label)" :color="p.color" :current="p.current" :max="p.max" row :data-companion-pool="p.id" />
        <div v-if="editable" class="flex flex-wrap items-center gap-1.5">
          <UInputNumber v-model="amount" :min="0" :placeholder="t('sheet.vitals.amount')" :aria-label="t('sheet.vitals.amount')" class="w-28" size="sm" />
          <UButton size="sm" variant="outline" color="error" icon="i-lucide-minus" :label="t('sheet.vitals.damage')" @click="damage()" />
          <UButton size="sm" variant="outline" color="success" icon="i-lucide-plus" :label="t('sheet.vitals.heal')" @click="heal" />
          <UButton v-if="view.pools.length > 1" size="sm" variant="ghost" color="neutral" :label="t('sheet.vitals.mode_short_bypass')" @click="damage(true)" />
          <UButton v-if="hasRegen" size="sm" variant="ghost" color="neutral" icon="i-lucide-refresh-cw" :label="t('sheet.companions.regen')" @click="regen" />
        </div>
      </div>
    </div>
    <div class="statblock-rule" />

    <!-- Abilities -->
    <div class="grid grid-cols-3 gap-2 p-3 sm:grid-cols-6">
      <div v-for="a in view.abilities" :key="a.key" class="flex flex-col items-center gap-1">
        <span class="eyebrow text-muted">{{ t(`abilities.${a.key}.abbr`) }}</span>
        <SheetRollButton :label="t('sheet.companions.check', { ability: t(`abilities.${a.key}.title`) })" :value="signed(a.mod)" :data-companion-mod="a.key" @roll="m => rolls.check(who(t('sheet.roll.check_of', { ability: t(`abilities.${a.key}.title`) })), a.mod, 'check', m)" />
        <span class="font-mono text-xs text-muted">{{ a.score }}</span>
      </div>
    </div>

    <div class="flex flex-col gap-2 border-t border-default p-3 text-sm">
      <div class="flex flex-wrap items-center gap-1.5">
        <span class="font-semibold text-highlighted">{{ t('saving_throws_title') }}</span>
        <SheetRollButton
          v-for="s in view.saves"
          :key="s.key"
          :label="who(t('sheet.roll.save_of', { ability: t(`abilities.${s.key}.title`) }))"
          :value="`${t(`abilities.${s.key}.abbr`)} ${signed(s.mod)}`"
          :highlight="s.proficient"
          @roll="m => rolls.check(who(t('sheet.roll.save_of', { ability: t(`abilities.${s.key}.title`) })), s.mod, 'save', m)"
        />
      </div>
      <div v-if="view.skills.length" class="flex flex-wrap items-center gap-1.5">
        <span class="font-semibold text-highlighted">{{ t('skills_title') }}</span>
        <SheetRollButton v-for="s in view.skills" :key="s.id" :label="who(s.name)" :value="`${s.name} ${signed(s.mod)}`" @roll="m => rolls.check(who(s.name), s.mod, 'skill', m)" />
      </div>
      <p>
        <span class="font-semibold text-highlighted">{{ t('senses_title') }}</span>
        {{ [...senses.map(([type, value]) => `${tr(`senses.${type.replaceAll('-', '_')}`, type)} ${distance(Number(value), { abbr: true })}`), `${t('sheet.passive', { skill: perceptionName })} ${view.passivePerception}`].join(', ') }}
      </p>
      <p v-for="d in defenses" :key="d.key">
        <span class="font-semibold text-highlighted">{{ t(`sheet.companions.${d.key}`) }}</span> {{ d.items.join(', ') }}
      </p>
      <div class="flex flex-wrap items-center gap-1.5">
        <span class="font-semibold text-highlighted">{{ t('conditions_title') }}</span>
        <template v-if="editable">
          <UBadge v-for="id in c.conditions" :key="id" color="warning" variant="subtle" class="cursor-pointer" @click="toggleCondition(id)">
            {{ conditionName(id) }} <UIcon name="i-lucide-x" class="size-3" />
          </UBadge>
          <USelectMenu
            :model-value="undefined"
            :items="conditionOptions.filter(id => !c.conditions.includes(id)).map(id => ({ label: conditionName(id), value: id }))"
            value-key="value"
            size="xs"
            :placeholder="t('sheet.companions.add_condition')"
            class="w-40"
            @update:model-value="v => v && toggleCondition(String(v))"
          />
        </template>
        <span v-else-if="c.conditions.length">{{ c.conditions.map(conditionName).join(', ') }}</span>
        <span v-else class="text-muted">{{ t('sheet.companions.no_conditions') }}</span>
      </div>
    </div>

    <!-- Actions -->
    <section v-for="g in view.actions" :key="g.type" class="border-t border-default p-3">
      <h5 class="eyebrow mb-2 text-secondary">
        {{ t(`sheet.companions.types.${g.type.replace(' ', '_').toLowerCase()}`) }}
      </h5>
      <div class="flex flex-col gap-3">
        <div v-for="item in g.items" :key="item.action.uuid" class="text-sm" data-companion-action>
          <div class="flex flex-wrap items-center gap-1.5">
            <span class="font-semibold text-highlighted italic">{{ item.action.name || t('sheet.companions.unnamed_action') }}.</span>
            <span v-if="item.action.shortRange" class="text-muted">{{ distance(item.action.shortRange, { abbr: true }) }}<template v-if="item.action.longRange">/{{ distance(item.action.longRange, { abbr: true }) }}</template></span>
            <span v-if="item.action.aoeType && item.action.aoeSize" class="text-muted">{{ distance(item.action.aoeSize, { abbr: true }) }} {{ tr(`aoe_types.${item.action.aoeType}`, item.action.aoeType) }}</span>
            <SheetRollButton v-if="item.hitNotation" :label="t('sheet.roll.attack_with', { name: item.action.name })" :value="signed(item.hit!)" data-companion-hit @roll="m => attack(item, m)" />
            <span v-if="item.dc !== undefined" class="font-mono text-highlighted">{{ t('sheet.dc', { dc: item.dc }) }}<template v-if="item.action.dcSave"> {{ tr(`abilities.${item.action.dcSave}.abbr`, item.action.dcSave) }}</template></span>
            <SheetRollButton v-if="item.damageNotation" :label="t('sheet.roll.damage_with', { name: item.action.name })" :value="`${item.damageNotation}${item.action.dmgType ? ` ${damageName(item.action.dmgType)}` : ''}`" @roll="rollDamage(item)" />
          </div>
          <p v-if="item.action.description" class="mt-1 whitespace-pre-line text-default">
            {{ item.action.description }}
          </p>
          <div v-if="item.action.resourceMax" class="mt-1 flex items-center gap-2">
            <span class="text-muted">{{ t('sheet.companions.uses') }}</span>
            <template v-if="item.action.resourceDisplay === 'Checkboxes'">
              <UCheckbox
                v-for="n in item.action.resourceMax"
                :key="n"
                :model-value="n <= (item.action.remainingResources ?? item.action.resourceMax)"
                :disabled="!editable"
                :aria-label="t('sheet.companions.use_n', { n })"
                @update:model-value="v => setResource(item.action.uuid, v ? n : n - 1)"
              />
            </template>
            <template v-else>
              <UButton size="xs" variant="outline" icon="i-lucide-minus" :disabled="!editable" :aria-label="t('sheet.companions.use_one')" @click="setResource(item.action.uuid, (item.action.remainingResources ?? item.action.resourceMax) - 1)" />
              <span class="font-mono tabular-nums">{{ item.action.remainingResources ?? item.action.resourceMax }}/{{ item.action.resourceMax }}</span>
              <UButton size="xs" variant="outline" icon="i-lucide-plus" :disabled="!editable" :aria-label="t('sheet.companions.regain_one')" @click="setResource(item.action.uuid, (item.action.remainingResources ?? item.action.resourceMax) + 1)" />
            </template>
          </div>
        </div>
      </div>
    </section>

    <p v-if="c.notes" class="border-t border-default p-3 text-sm whitespace-pre-line">
      {{ c.notes }}
    </p>
  </article>
</template>
