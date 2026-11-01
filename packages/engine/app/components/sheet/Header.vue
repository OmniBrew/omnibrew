<script setup lang="ts">
/**
 * The sheet's identity card: class icon with the sheet-color chip, name and identity
 * line, the save state and the character menu; then AC, proficiency, speed,
 * initiative (rolls) and inspiration.
 */
import { actions } from '@omnibrew/engine/rules'

const { t } = useI18n()
const { game } = useAppConfig()
const { store, sheet, character, editable, apply } = useSheet()
const ui = useSheetUi()
const rolls = useSheetRolls()
const { distance } = useUnits()
const { $characterGame } = useNuxtApp()
const toast = useToast()

const accent = computed(() => sheetAccent(character.value, game.theme as SheetTheme))
const icon = computed(() => {
  const first = character.value.classes[0]?.id
  return first && game.sheet.classIcon ? game.sheet.classIcon.replace('{id}', first) : ''
})

const identity = computed(() => {
  const s = sheet.value
  const classes = s.classes.map(k => `${k.data.name} ${k.levels}`).join(' / ')
  return [s.species?.name, classes].filter(Boolean).join(' · ')
})

const speeds = computed(() => Object.entries(sheet.value.speeds).filter(([, v]) => v && v.distance > 0) as Array<[string, { distance: number }]>)
const walk = computed(() => sheet.value.speeds.walk?.distance ?? 0)
const initiative = computed(() => sheet.value.initiative)
const setInspiration = (v: boolean) => apply(s => actions.setInspiration(s.character, v))
const initMode = computed(() => (initiative.value.advantage && !initiative.value.disadvantage ? 'advantage' : initiative.value.disadvantage && !initiative.value.advantage ? 'disadvantage' : null))

function share() {
  const url = new URL(`/characters/sheet?id=${encodeURIComponent(store.id ?? '')}`, location.origin).toString()
  navigator.clipboard.writeText(url).then(
    () => toast.add({ title: t('characters.link_copied'), icon: 'i-lucide-link', color: 'success' }),
    () => toast.add({ title: url }),
  )
}

const exportIt = () => downloadJson(exportName([character.value]), exportFile($characterGame.id, [toRaw(character.value)]))

const menu = computed(() => [
  editable.value
    ? [
        { label: t('sheet.menu.edit'), icon: 'i-lucide-pencil', to: { path: '/characters/builder', query: { id: store.id } } },
        { label: t('sheet.rest.short'), icon: 'i-lucide-coffee', onSelect: () => ui.open('rest', 'short') },
        { label: t('sheet.rest.long'), icon: 'i-lucide-bed', onSelect: () => ui.open('rest', 'long') },
      ]
    : [],
  [
    { label: t('sheet.log.title'), icon: 'i-lucide-scroll-text', onSelect: () => ui.open('log') },
    ...(editable.value
      ? [
          { label: t('sheet.settings.title'), icon: 'i-lucide-sliders-horizontal', onSelect: () => ui.open('settings') },
          { label: t('sheet_color.title'), icon: 'i-lucide-palette', onSelect: () => ui.open('color') },
        ]
      : []),
  ],
  [
    ...(store.record?.local ? [] : [{ label: t('characters.share'), icon: 'i-lucide-link', onSelect: share }]),
    { label: t('characters.export'), icon: 'i-lucide-download', onSelect: exportIt },
  ],
].filter(group => group.length))
</script>

<template>
  <SheetPanel as="header" class="!p-4">
    <div class="flex items-start gap-3">
      <img v-if="character.image" :src="character.image" alt="" class="size-11 shrink-0 rounded-sm bg-default object-cover sm:size-13">
      <img v-else-if="icon" :src="icon" alt="" class="size-11 shrink-0 sm:size-13">
      <UIcon v-else name="i-lucide-user-round" class="size-11 shrink-0 text-dimmed sm:size-13" />
      <div class="min-w-0 flex-1">
        <p class="truncate font-display text-2xl/7 font-bold text-highlighted">
          {{ character.name || t('characters.unnamed') }}
        </p>
        <p class="truncate text-sm text-muted">
          {{ identity || t('characters.not_started') }}
        </p>
        <SheetSaveState class="mt-1" />
      </div>
      <div class="flex shrink-0 items-center gap-1">
        <button
          v-if="editable && accent"
          type="button"
          class="flex size-8 items-center justify-center rounded-sm hover:bg-elevated focus-visible:outline-2 focus-visible:outline-primary max-sm:size-10"
          :aria-label="t('sheet_color.title')"
          :title="t('sheet_color.title')"
          data-accent-chip
          @click="ui.open('color')"
        >
          <span class="size-4 rounded-xs bg-primary ring-1 ring-default" />
        </button>
        <UDropdownMenu :items="menu" :content="{ align: 'end' }">
          <UButton icon="i-lucide-menu" color="neutral" variant="ghost" :aria-label="t('sheet.menu.title')" class="max-sm:size-10 max-sm:justify-center" />
        </UDropdownMenu>
      </div>
    </div>

    <USeparator class="my-3" />

    <dl class="grid grid-cols-5 gap-1 text-center">
      <div>
        <dt class="eyebrow text-muted">
          {{ t('ac_abbr') }}
        </dt>
        <dd class="mt-1 font-mono text-xl/8 font-semibold text-highlighted" data-sheet="ac">
          {{ sheet.ac }}
        </dd>
      </div>
      <div>
        <dt class="eyebrow text-muted">
          {{ t('sheet.prof_abbr') }}
        </dt>
        <dd class="mt-1 font-mono text-xl/8 font-semibold text-highlighted" data-sheet="profBonus">
          {{ signed(sheet.profBonus) }}
        </dd>
      </div>
      <div>
        <dt class="eyebrow text-muted">
          {{ t('speed_title') }}
        </dt>
        <dd class="mt-1 font-mono text-xl/8 font-semibold whitespace-nowrap text-highlighted" :title="speeds.map(([k, v]) => `${t(`speeds.${k}.title`)} ${distance(v.distance)}`).join(', ')" data-sheet="speed">
          {{ distance(walk, { abbr: true }) }}
        </dd>
      </div>
      <div>
        <dt class="eyebrow text-muted">
          {{ t('sheet.init_abbr') }}
        </dt>
        <dd class="mt-1 flex justify-center" data-sheet="initiative">
          <SheetRollButton :label="t('sheet.initiative')" :value="signed(initiative.bonus)" @roll="mode => rolls.check(t('sheet.initiative'), initiative.bonus, 'initiative', mode ?? initMode)" />
        </dd>
      </div>
      <div>
        <dt class="eyebrow text-muted">
          {{ t('sheet.insp_abbr') }}
        </dt>
        <dd class="mt-1 flex h-8 items-center justify-center max-sm:h-10">
          <UCheckbox
            :model-value="character.state.inspiration"
            :disabled="!editable"
            :aria-label="t('sheet.inspiration')"
            @update:model-value="v => setInspiration(!!v)"
          />
        </dd>
      </div>
    </dl>
  </SheetPanel>
</template>
