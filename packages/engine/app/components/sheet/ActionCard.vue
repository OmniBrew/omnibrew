<script setup lang="ts">
/**
 * One card of the Actions and Powers tabs: an attack (range, hit and damage roll
 * buttons), a save (DC), or an action with its resource tracker and toggle. The
 * numbers are `sheet.card(card)`; details (the record's prose) open in place.
 */
import { actions, type SheetCard } from '@omnibrew/engine/rules'

const props = defineProps<{ card: SheetCard, power?: boolean }>()

const { t, te } = useI18n()
const { sheet, editable, apply } = useSheet()
const rolls = useSheetRolls()
const { distance } = useUnits()

const resolved = computed(() => sheet.value.card(props.card))
const open = ref(false)

const name = computed(() => props.card.name ?? '')
const level = computed(() => (props.power ? Number(props.card.level) : null))

/** "1d8+3 piercing" per damage roll. */
const damageLabels = computed(() => (resolved.value.damages ?? []).map(d => Object.entries(d.types).map(([type, values]) => ({ dice: damageNotation(values), type: te(`damage_types.${type}`) ? t(`damage_types.${type}`) : type === 'damage' ? '' : type }))))

const range = computed(() => {
  const r = resolved.value.range
  if (!r?.short) return ''
  return r.long ? `${distance(r.short, { numOnly: true })}/${distance(r.long, { abbr: true })}` : distance(r.short, { abbr: true })
})

const subtitle = computed(() => {
  const c = props.card
  const parts: string[] = []
  if (c.weaponType && te(`weapon_types.${c.weaponType}`)) parts.push(t(`weapon_types.${c.weaponType}`))
  if (Array.isArray(c.properties)) parts.push(...(c.properties as string[]))
  if (props.power) parts.push(level.value ? t('level_adj', { nth: t(`ordinal_numbers[${level.value}]`) }) : t('cantrip'))
  return [...new Set(parts)].join(' · ')
})

const notes = computed(() => resolved.value.notes.filter(n => n.text))

function attack(mode: RollMode, dialog = false) {
  rolls.attack(sheet.value, { ...props.card, name: name.value }, mode, dialog)
}
function rollDamage(index: number) {
  const d = resolved.value.damages?.[index]
  if (d) rolls.damage(name.value, [d], { addCritDie: critDie(props.card) })
}

// Powers: cast spends a slot of the card's level or its level in points.
const cost = computed(() => (props.power ? actions.castCost(sheet.value, String(props.card.type), Number(props.card.level)) : null))
const canCast = computed(() => {
  const c = cost.value
  if (!c) return false
  const pc = sheet.value.powercasting
  if (c.kind === 'points') {
    const p = pc.points[c.pool]
    return !!p && p.max - p.used >= c.amount && (!p.limit || Number(props.card.level) <= p.limit)
  }
  const s = pc.slots[Number(props.card.level)]
  return !!s && s.max - s.used > 0
})
const cast = () => apply(s => actions.cast(s, String(props.card.type), Number(props.card.level)))

const toggle = computed(() => (props.card.toggle && typeof props.card.toggle === 'object' ? props.card.toggle as { id: string, label?: string, options?: Array<{ id: string, label?: string, name?: string }> } : null))

const custom = computed(() => (props.card.custom ? htmlToText(String(props.card.html ?? '')) : ''))
const more = computed(() => props.card.moreInfo as { model?: string, id?: string, equipment?: string } | undefined)
const hasDetails = computed(() => Boolean(more.value?.model || more.value?.equipment || custom.value || props.card.advancement))
</script>

<template>
  <article class="rounded-md border border-default bg-default" :data-card="card.name">
    <div class="flex flex-wrap items-center gap-x-3 gap-y-2 p-3">
      <button
        type="button"
        class="flex min-w-0 flex-1 basis-48 items-start gap-1 text-start"
        :aria-expanded="hasDetails ? open : undefined"
        :disabled="!hasDetails"
        @click="open = !open"
      >
        <UIcon v-if="hasDetails" name="i-lucide-chevron-right" class="mt-0.5 size-4 shrink-0 text-muted transition-transform" :class="{ 'rotate-90': open }" />
        <span class="min-w-0">
          <span class="block font-label text-[0.9375rem] font-semibold text-highlighted">{{ name }}<span v-if="card.advancement" class="font-normal text-muted"> · {{ (card.advancement as { name: string }).name }}</span></span>
          <span v-if="subtitle" class="block text-xs text-muted">{{ subtitle }}</span>
          <span v-if="resolved.shortDesc" class="mt-0.5 block text-sm text-default"><MDC :value="resolved.shortDesc" tag="span" class="sheet-prose inline" unwrap="p" /></span>
        </span>
      </button>

      <div class="flex flex-wrap items-center gap-2">
        <span v-if="range" class="font-mono text-sm text-default" :title="t('range_title')">{{ range }}</span>
        <SheetRollButton
          v-if="resolved.hit"
          :label="t('sheet.roll.attack_with', { name })"
          :value="signed(resolved.hit.bonus)"
          :highlight="!!card.options?.length"
          data-sheet-hit
          @roll="mode => attack(mode)"
          @contextmenu.prevent="attack(null, true)"
        />
        <span v-if="resolved.dc" class="inline-flex h-8 items-center rounded-sm border border-default px-2 font-mono text-sm text-highlighted" data-sheet-dc>
          {{ t('sheet.dc', { dc: resolved.dc.target }) }}<span v-if="resolved.dc.save" class="ms-1 font-sans text-xs text-muted">{{ t(`abilities.${resolved.dc.save}.abbr`) }}</span>
        </span>
        <SheetRollButton
          v-for="(parts, i) in damageLabels"
          :key="i"
          :label="t('sheet.roll.damage_with', { name })"
          :value="parts.map(p => p.dice).join(' + ')"
          data-sheet-damage
          @roll="rollDamage(i)"
        >
          <span v-for="(p, j) in parts" :key="j"><template v-if="j"> + </template>{{ p.dice }}<span v-if="p.type" class="ms-1 font-sans text-xs font-normal text-muted">{{ p.type }}</span></span>
        </SheetRollButton>
        <UButton v-if="power && cost && editable" :label="t('sheet.powers.cast')" size="sm" variant="outline" :disabled="!canCast" @click="cast" />
        <SheetResource v-if="card.resource" :resource="card.resource" :card="card" />
      </div>
    </div>

    <div v-if="toggle" class="flex flex-wrap items-center gap-3 border-t border-default px-3 py-2">
      <SheetToggle :toggle="toggle" :label="name" />
    </div>

    <div v-if="notes.length" class="flex flex-wrap gap-1.5 px-3 pb-2">
      <template v-for="(n, i) in notes" :key="i">
        <UTooltip v-if="n.type === 'tooltip' && n.tooltipText" :text="htmlToText(String(n.tooltipText))" :content="{ side: 'top' }">
          <UBadge :label="n.text" color="neutral" variant="outline" size="sm" class="cursor-help" />
        </UTooltip>
        <UBadge v-else-if="n.type !== 'html'" :label="n.text" color="neutral" variant="soft" size="sm" />
        <MDC v-else :value="n.text" tag="span" class="sheet-prose text-xs text-muted" />
      </template>
    </div>

    <div v-if="open" class="border-t border-default bg-muted/60 p-3 text-sm">
      <p v-if="custom" class="whitespace-pre-line">
        {{ custom }}
      </p>
      <SheetProse v-else-if="more?.model && more.id" :id="more.id" :collection="more.model" />
      <SheetEquipmentProse v-else-if="more?.equipment" :uuid="more.equipment" />
      <MDC v-if="card.advancement" :value="(card.advancement as { text: string }).text" class="sheet-prose mt-2" />
    </div>
  </article>
</template>
