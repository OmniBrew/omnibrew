<script setup lang="ts">
/** The sheet's side column: the game's panels (ME reputation), the rest buttons, proficiencies and Settings. */
import { sheet as gameSheet } from '#game-client'
const { t, te } = useI18n()
const { sheet, editable } = useSheet()
const ui = useSheetUi()

const tr = (key: string, fallback: string) => (te(key) ? t(key) : fallback)
const profs = computed(() => {
  const p = sheet.value.profs
  const tools = p.tool.map(id => sheet.value.content.get('tool-profs', id)?.name ?? id)
  return [
    { id: 'armor', title: t('armor_title', 1), values: p.armor.map(a => tr(`armor_types.${a}`, a)) },
    { id: 'weapon', title: t('weapon_title', 2), values: p.weapon.map(w => tr(`weapon_types.${w}`, w)) },
    { id: 'tool', title: t('sheet.profs.tools'), values: tools },
  ].filter(x => x.values.length)
})
const slots = gameSheet.slots.side ?? []
</script>

<template>
  <aside class="flex min-w-0 flex-col gap-3">
    <component :is="part" v-for="(part, i) in slots" :key="i" />
    <div v-if="editable" class="grid grid-cols-2 gap-2">
      <UButton :label="t('sheet.rest.short')" color="neutral" variant="outline" block class="max-sm:h-11" @click="ui.open('rest', 'short')" />
      <UButton :label="t('sheet.rest.long')" color="neutral" variant="outline" block class="max-sm:h-11" @click="ui.open('rest', 'long')" />
    </div>
    <SheetPanel :title="t('proficiencies_title')">
      <dl v-if="profs.length" class="flex flex-col gap-2 text-sm" data-sheet="profs">
        <div v-for="p in profs" :key="p.id">
          <dt class="text-xs text-muted">
            {{ p.title }}
          </dt>
          <dd class="text-highlighted">
            {{ p.values.join(', ') }}
          </dd>
        </div>
      </dl>
      <p v-else class="text-sm text-muted">
        {{ t('none') }}
      </p>
    </SheetPanel>
    <UButton v-if="editable" :label="t('sheet.settings.title')" icon="i-lucide-sliders-horizontal" color="neutral" variant="outline" block class="max-sm:hidden" @click="ui.open('settings')" />
  </aside>
</template>
