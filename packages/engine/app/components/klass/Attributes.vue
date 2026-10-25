<script setup lang="ts">
/**
 * The start of a class's features: hit points from the hit die, the
 * proficiencies, and the starting equipment (and wealth, when the class has it).
 */
interface Prof { text?: string }

const props = defineProps<{
  klass: {
    hitDie?: number
    profs?: Partial<Record<'armor' | 'weapon' | 'tool' | 'skill' | 'saving-throw', Prof>>
    startingEquipment?: { text?: string }[]
    startingWealth?: { text?: string, value: string }
  }
}>()

const { t } = useI18n()
const die = computed(() => props.klass.hitDie ?? 0)
const dice = computed(() => t('dice', { dieCount: 1, dieType: die.value }))
const hitPoints = computed(() => [
  [t('hit_dice_title'), t('hit_dice_per_level', { hitDice: dice.value })],
  [t('hit_points_at_first_title'), t('hit_points_at_first_text', { die: die.value, mod: t('abilities.con.title') })],
  [t('hit_points_at_higher_title'), t('hit_points_at_higher_text', { die: dice.value, min: hitDieAverage(die.value), mod: t('abilities.con.title') })],
])

const PROF_LABELS = {
  'armor': () => t('armor_title', 2),
  'weapon': () => t('weapon_title', 2),
  'tool': () => t('gear_types.tool'),
  'skill': () => t('skills_title'),
  'saving-throw': () => t('saving_throws_title'),
}
const profs = computed(() => (Object.keys(PROF_LABELS) as (keyof typeof PROF_LABELS)[])
  .filter(key => props.klass.profs?.[key]?.text)
  .map(key => [PROF_LABELS[key](), props.klass.profs![key]!.text!]))
</script>

<template>
  <div>
    <KlassFeature :title="t('hit_points_title')">
      <dl class="grid gap-x-6 gap-y-1 sm:grid-cols-[auto_1fr]">
        <template v-for="[label, value] in hitPoints" :key="label">
          <dt class="font-semibold text-highlighted">
            {{ label }}
          </dt>
          <dd class="mb-2 sm:mb-0">
            {{ value }}
          </dd>
        </template>
      </dl>
    </KlassFeature>

    <KlassFeature :title="t('proficiencies_title')">
      <dl class="grid gap-x-6 gap-y-1 sm:grid-cols-[auto_1fr]">
        <template v-for="[label, value] in profs" :key="label">
          <dt class="font-semibold text-highlighted">
            {{ label }}
          </dt>
          <dd class="mb-2 sm:mb-0">
            {{ value }}
          </dd>
        </template>
      </dl>
    </KlassFeature>

    <KlassFeature :title="t('starting_equipment_title')">
      <p>{{ t('starting_equipment_info') }}</p>
      <ul class="mt-2 list-disc ps-6">
        <li v-for="(item, i) in klass.startingEquipment" :key="i">
          {{ item.text }}
        </li>
      </ul>
      <p v-if="klass.startingWealth" class="mt-4">
        <span class="font-semibold text-highlighted">{{ t('starting_wealth_title') }}:</span>
        {{ klass.startingWealth.text ?? klass.startingWealth.value }}
      </p>
    </KlassFeature>
  </div>
</template>
