<script setup lang="ts">
/** The character's roll log (this browser, last 200 rolls): each roll with its dice, and the damage follow-up of an attack. */
const { t, d } = useI18n()
const ui = useSheetUi()
const store = useRollStore()
const rolls = useSheetRolls()
const open = ui.model('log')
</script>

<template>
  <USlideover v-model:open="open" :title="t('sheet.log.title')" :description="t('sheet.log.text', { n: ROLL_LOG_LIMIT })">
    <template #body>
      <ol v-if="store.log.length" class="flex flex-col gap-2">
        <li v-for="e in store.log" :key="e.id" class="rounded-md border border-default bg-muted p-3 text-sm">
          <div class="flex items-baseline justify-between gap-2">
            <span class="font-semibold text-highlighted">{{ e.label }}</span>
            <span class="font-mono text-lg font-semibold" :class="e.crit ? 'text-success' : e.fumble ? 'text-error' : 'text-highlighted'">{{ e.total }}</span>
          </div>
          <p class="text-xs text-muted">
            {{ t(`sheet.roll.kind.${e.kind}`) }}<template v-if="e.advantage">
              · {{ t(`sheet.roll.${e.advantage}`) }}
            </template> · <span class="font-mono">{{ e.notation }}</span>
            <template v-if="e.parts?.length">
              · {{ e.parts.map(p => `${p.total} ${p.type}`).join(', ') }}
            </template>
          </p>
          <p class="mt-1 flex flex-wrap gap-1">
            <span v-for="(die, i) in e.dice" :key="i" class="rounded-xs border border-default px-1 font-mono text-xs" :class="die.dropped ? 'text-dimmed line-through' : die.value === die.sides ? 'text-success' : die.value === 1 ? 'text-error' : 'text-default'">{{ die.value }}</span>
          </p>
          <div class="mt-1 flex items-center justify-between gap-2">
            <time class="text-xs text-dimmed" :datetime="e.at">{{ d(new Date(e.at), { hour: 'numeric', minute: '2-digit', month: 'short', day: 'numeric' }) }}</time>
            <UButton v-if="e.damage" :label="e.crit ? t('sheet.roll.crit_damage') : t('sheet.roll.damage')" size="xs" variant="outline" @click="rolls.damage(e.label, e.damage.damages, { crit: e.crit, addCritDie: e.damage.addCritDie })" />
          </div>
        </li>
      </ol>
      <UEmpty v-else icon="i-lucide-dices" :title="t('sheet.log.empty')" />
    </template>
    <template #footer>
      <UButton :label="t('sheet.log.clear')" icon="i-lucide-trash-2" color="neutral" variant="ghost" :disabled="!store.log.length" @click="store.clear()" />
    </template>
  </USlideover>
</template>
