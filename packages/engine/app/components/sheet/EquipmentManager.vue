<script setup lang="ts">
/**
 * The equipment manager (the live MeCsEquipmentManager): owned items with their
 * count, mods (one per weapon mod slot; armor mods for the armor's type and slot),
 * attack and damage bonuses and notes; and the catalog to add from, free or bought
 * with credits (selling refunds half, as at most tables).
 */
import type { EquipmentEntry } from '@omnibrew/engine/character'
import { actions, gearRecords, type Rec } from '@omnibrew/engine/rules'

const { t, te } = useI18n()
const ui = useSheetUi()
const { sheet, character, apply } = useSheet()
const open = ui.model('equipment')
const tab = ref<'owned' | 'add'>(character.value.equipment.length ? 'owned' : 'add')

const tr = (key: string, fallback: string) => (te(key) ? t(key) : fallback)
const KINDS = [
  { kind: 'weapon', collection: 'weapons', title: () => t('weapon_title', 2) },
  { kind: 'armor', collection: 'armor', title: () => t('armor_title', 2) },
  { kind: 'gear', collection: 'gear', title: () => t('gear_title', 2) },
]
const catalogOf = (kind: string): Rec[] => (kind === 'gear' ? gearRecords(sheet.value.content) : sheet.value.content.list(KINDS.find(k => k.kind === kind)!.collection)).filter(r => !r.notAddable)

// --- add ---
const kind = ref('weapon')
const search = ref('')
const catalog = computed(() => {
  const q = search.value.trim().toLowerCase()
  return catalogOf(kind.value).filter(r => !q || String(r.name).toLowerCase().includes(q)).sort((a, b) => String(a.name).localeCompare(String(b.name))).slice(0, 80)
})
const cost = (r: Rec) => (typeof r.cost === 'number' ? r.cost : Number(r.cost) || 0)
const credits = computed(() => character.value.state.credits)
const consumable = (r: Rec) => kind.value === 'gear' && r.equippable === false

function add(r: Rec, buy: boolean) {
  apply(s => actions.edit(actions.addItem(s.character, { id: r.id, kind: kind.value }, consumable(r) ? { uses: 1 } : {}), (c) => {
    if (buy) c.state.credits = Math.max(0, c.state.credits - cost(r))
  }))
}

// --- owned ---
const owned = computed(() => {
  const eq = sheet.value.equipment
  return [...eq.weapons, ...eq.armor, ...eq.gear] as Array<{ entry: EquipmentEntry, data: Rec }>
})
const update = (uuid: string, patch: Partial<EquipmentEntry>) => apply(s => actions.updateItem(s.character, uuid, patch))
function remove(item: { entry: EquipmentEntry, data: Rec }, sell: boolean) {
  apply(s => actions.edit(actions.removeItem(s.character, item.entry.uuid), (c) => {
    if (sell) c.state.credits += Math.floor(cost(item.data) / 2)
    c.state.toggles = Object.fromEntries(Object.entries(c.state.toggles).filter(([k]) => k !== item.entry.uuid))
  }))
}

const mods = computed(() => sheet.value.content.list('mods'))
function modSlots(item: { entry: EquipmentEntry, data: Rec }) {
  if (item.entry.kind === 'weapon') return sheet.value.rules.weapons.modSlots(String(item.data.weaponType))
  if (item.entry.kind === 'armor' && !item.entry.custom) return [item.data.coverage === 'piece' ? String(item.data.slot) : 'suit']
  return []
}
function modsFor(item: { entry: EquipmentEntry, data: Rec }, slot: string) {
  const type = item.entry.kind === 'weapon' ? item.data.weaponType : item.data.armorType
  return mods.value.filter(m => m.modType === (item.entry.kind === 'weapon' ? 'weapon' : 'armor')
    && (m.availability as string[]).includes(type)
    && (slot === 'suit' ? true : m.placement === slot))
}
const installed = (item: { entry: EquipmentEntry }, slot: string) => item.entry.mods?.find(m => (m.slot ?? '') === slot || (!m.slot && slot === 'suit'))?.id ?? ''
function setMod(item: { entry: EquipmentEntry }, slot: string, id: string) {
  const others = (item.entry.mods ?? []).filter(m => (m.slot ?? 'suit') !== slot)
  update(item.entry.uuid, { mods: id ? [...others, { id, ...(slot === 'suit' ? {} : { slot }) }] : others })
}
const expanded = ref<string | null>(null)
</script>

<template>
  <USlideover v-model:open="open" :title="t('sheet.gear.manage')" :ui="{ content: 'max-w-xl' }">
    <template #body>
      <UTabs v-model="tab" :items="[{ label: t('sheet.gear.owned'), value: 'owned' }, { label: t('sheet.gear.add'), value: 'add' }]" :content="false" class="mb-4" />

      <div v-if="tab === 'add'" class="flex flex-col gap-3">
        <div class="flex flex-wrap gap-2">
          <UTabs v-model="kind" :items="KINDS.map(k => ({ label: k.title(), value: k.kind }))" :content="false" variant="pill" size="sm" />
          <UInput v-model="search" icon="i-lucide-search" :placeholder="t('search')" class="min-w-40 flex-1" />
        </div>
        <p class="text-sm text-muted">
          {{ t('sheet.gear.credits_left', { n: credits.toLocaleString() }) }}
        </p>
        <ul class="divide-y divide-(--ui-border)">
          <li v-for="r in catalog" :key="r.id" class="flex items-center gap-2 py-2 text-sm">
            <div class="min-w-0 flex-1">
              <p class="truncate font-semibold text-highlighted">
                {{ r.name }}
              </p>
              <p class="truncate text-xs text-muted">
                {{ [r.rarity ? tr(`rarities.${r.rarity}`, r.rarity) : '', r.weaponType ? tr(`weapon_types.${r.weaponType}`, r.weaponType) : '', r.armorType ? tr(`armor_types.${r.armorType}`, r.armorType) : '', r.type ? tr(`gear_types.${r.type}`, r.type) : ''].filter(Boolean).join(' · ') }}
                <span v-if="cost(r)" class="font-mono"> · {{ cost(r).toLocaleString() }}</span>
              </p>
            </div>
            <UButton :label="t('sheet.gear.add_free')" size="xs" variant="outline" @click="add(r, false)" />
            <UButton v-if="cost(r)" :label="t('sheet.gear.buy')" size="xs" color="neutral" variant="ghost" :disabled="cost(r) > credits" @click="add(r, true)" />
          </li>
        </ul>
      </div>

      <ul v-else class="flex flex-col gap-2">
        <li v-for="item in owned" :key="item.entry.uuid" class="rounded-md border border-default bg-muted text-sm">
          <button type="button" class="flex w-full items-center gap-2 p-3 text-start" :aria-expanded="expanded === item.entry.uuid" @click="expanded = expanded === item.entry.uuid ? null : item.entry.uuid">
            <UIcon name="i-lucide-chevron-right" class="size-4 text-muted transition-transform" :class="{ 'rotate-90': expanded === item.entry.uuid }" />
            <span class="flex-1 truncate font-semibold text-highlighted">{{ item.data.name ?? item.entry.id }}</span>
            <span v-if="item.entry.uses !== undefined" class="font-mono text-xs text-muted">×{{ item.entry.uses }}</span>
            <UBadge v-if="item.entry.equipped" :label="t('sheet.gear.equipped')" color="primary" variant="soft" size="sm" />
          </button>
          <div v-if="expanded === item.entry.uuid" class="flex flex-col gap-3 border-t border-default p-3">
            <UFormField v-if="item.entry.uses !== undefined" :label="t('sheet.gear.count')">
              <UInputNumber :model-value="item.entry.uses" :min="0" class="w-32" @update:model-value="v => update(item.entry.uuid, { uses: Number(v) || 0 })" />
            </UFormField>
            <UFormField v-for="slot in modSlots(item)" :key="slot" :label="t('sheet.gear.mod_slot', { slot: tr(`mod_placements.${slot}`, slot === 'suit' ? t('mod_title', 2) : slot) })">
              <USelect
                :model-value="installed(item, slot) || NONE"
                :items="[{ label: t('none'), value: NONE }, ...modsFor(item, slot).map(m => ({ label: m.name, value: m.id }))]"
                class="w-full"
                @update:model-value="v => setMod(item, slot, fromSelect(v))"
              />
            </UFormField>
            <div v-if="item.entry.kind === 'weapon'" class="grid grid-cols-2 gap-3">
              <UFormField :label="t('sheet.gear.bonus_hit')">
                <UInputNumber :model-value="item.entry.bonusHit ?? 0" @update:model-value="v => update(item.entry.uuid, { bonusHit: Number(v) || 0 })" />
              </UFormField>
              <UFormField :label="t('sheet.gear.bonus_damage')">
                <UInputNumber :model-value="item.entry.bonusDamage ?? 0" @update:model-value="v => update(item.entry.uuid, { bonusDamage: Number(v) || 0 })" />
              </UFormField>
            </div>
            <UFormField :label="t('notes_title')">
              <UTextarea :model-value="item.entry.notes ?? ''" :rows="2" autoresize class="w-full" @update:model-value="v => update(item.entry.uuid, { notes: String(v) })" />
            </UFormField>
            <div class="flex gap-2">
              <UButton :label="t('sheet.gear.remove')" icon="i-lucide-trash-2" color="error" variant="ghost" size="sm" @click="remove(item, false)" />
              <UButton v-if="cost(item.data)" :label="t('sheet.gear.sell', { n: Math.floor(cost(item.data) / 2).toLocaleString() })" color="neutral" variant="ghost" size="sm" @click="remove(item, true)" />
            </div>
          </div>
        </li>
        <li v-if="!owned.length" class="text-sm text-muted">
          {{ t('sheet.gear.none') }}
        </li>
      </ul>
    </template>
  </USlideover>
</template>
