<script setup lang="ts">
/**
 * The Gear tab (the live MeCsEquipment): credits, weapons, armor and gear with their
 * equip switches (the game's equip rules say why one can't be equipped), active set
 * bonuses, and the game's own gear panels (ME capacities and thermal clips, shoulder
 * mounts). The equipment manager adds, removes and changes items.
 */
import { sheet as gameSheet } from '#game-client'
import { actions, type OwnedItem } from '@omnibrew/engine/rules'

const { t, te } = useI18n()
const { sheet, character, editable, apply } = useSheet()
const ui = useSheetUi()

const eq = computed(() => sheet.value.equipment)
const groups = computed(() => [
  { id: 'weapons', title: t('weapon_title', 2), items: eq.value.weapons as OwnedItem[] },
  { id: 'armor', title: t('armor_title', 2), items: eq.value.armor },
  { id: 'gear', title: t('gear_title', 2), items: eq.value.gear },
].filter(g => g.items.length))

const tr = (key: string, fallback: string) => (te(key) ? t(key) : fallback)
function subtitle(item: OwnedItem) {
  const d = item.data
  const parts = [
    d.rarity ? tr(`rarities.${d.rarity}`, d.rarity) : '',
    d.weaponType ? tr(`weapon_types.${d.weaponType}`, d.weaponType) : '',
    d.armorType ? tr(`armor_types.${d.armorType}`, d.armorType) : '',
    d.placement && item.entry.kind === 'armor' ? tr(`armor_placements.${d.placement}`, d.placement) : '',
    d.type && item.entry.kind === 'gear' ? tr(`gear_types.${d.type}`, d.type) : '',
  ]
  return parts.filter(Boolean).join(' · ')
}

const blocked = (uuid: string) => actions.equipCheck(sheet.value, uuid)
const equip = (uuid: string, on: boolean) => apply(s => actions.setEquipped(s, uuid, on))
const credits = computed(() => character.value.state.credits)
const setCredits = (v: number | null) => apply(s => actions.setCredits(s.character, Number(v) || 0))
const slots = gameSheet.slots.gear ?? []
</script>

<template>
  <div class="flex flex-col gap-4">
    <div class="flex flex-wrap items-center gap-3">
      <label class="flex items-center gap-2 rounded-sm border border-default bg-default px-3 py-1.5">
        <span class="eyebrow text-muted">{{ t('sheet.gear.credits') }}</span>
        <UInputNumber :model-value="credits" :min="0" :disabled="!editable" size="sm" class="w-36" :ui="{ base: 'font-mono' }" @update:model-value="setCredits" />
      </label>
      <UButton v-if="editable" :label="t('sheet.gear.manage')" icon="i-lucide-package-plus" size="sm" variant="outline" class="ms-auto" @click="ui.open('equipment')" />
    </div>

    <component :is="part" v-for="(part, i) in slots" :key="i" />

    <section v-for="g in groups" :key="g.id" class="flex flex-col gap-1">
      <h3 class="section-tick font-label text-base font-semibold text-highlighted">
        {{ g.title }}
      </h3>
      <ul class="divide-y divide-(--ui-border)">
        <li v-for="item in g.items" :key="item.entry.uuid" class="flex min-h-11 items-center gap-3 py-1.5" :data-item="item.data.id">
          <USwitch
            v-if="item.data.equippable !== false"
            :model-value="item.entry.equipped"
            :disabled="!editable || (!item.entry.equipped && !!blocked(item.entry.uuid))"
            :aria-label="t('sheet.gear.equip', { name: item.data.name })"
            :title="blocked(item.entry.uuid) ? t(blocked(item.entry.uuid)!.key, blocked(item.entry.uuid)!.params ?? {}) : undefined"
            @update:model-value="v => equip(item.entry.uuid, !!v)"
          />
          <span v-else class="w-8 text-center font-mono text-xs text-muted">{{ item.entry.uses ?? '' }}</span>
          <div class="min-w-0 flex-1">
            <p class="truncate text-sm font-semibold text-highlighted">
              {{ item.data.name }}
              <span v-if="item.entry.mods?.length" class="ms-1 text-xs font-normal text-muted">{{ t('sheet.gear.mods', { n: item.entry.mods.length }) }}</span>
            </p>
            <p class="truncate text-xs text-muted">
              {{ subtitle(item) }}
            </p>
          </div>
          <span v-if="item.entry.uses !== undefined && item.data.equippable !== false" class="font-mono text-xs text-muted">×{{ item.entry.uses }}</span>
        </li>
      </ul>
    </section>

    <section v-if="eq.setBonuses.length" class="flex flex-col gap-2">
      <h3 class="section-tick font-label text-base font-semibold text-highlighted">
        {{ t('sheet.gear.set_bonuses') }}
      </h3>
      <div v-for="b in eq.setBonuses" :key="b.id" class="rounded-md border border-default bg-default p-3 text-sm">
        <p class="font-semibold text-highlighted">
          {{ b.name }} <span class="font-mono text-xs text-muted">{{ b.count }}/{{ b.max ?? b.items.length }}</span>
        </p>
        <ul class="mt-1 flex flex-col gap-1">
          <li v-for="(bonus, i) in b.bonuses" :key="i">
            <MDC v-if="bonus.text" :value="String(bonus.text)" class="sheet-prose" />
          </li>
        </ul>
      </div>
    </section>

    <UEmpty v-if="!groups.length" icon="i-lucide-package" :title="t('sheet.gear.none')" :actions="editable ? [{ label: t('sheet.gear.manage'), onClick: () => ui.open('equipment') }] : []" />
  </div>
</template>
