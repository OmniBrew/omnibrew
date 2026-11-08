<script setup lang="ts">
/**
 * Editing a companion (the live MeCsCompanionEditDialog; plan/26 §1.6): Name & Image,
 * Abilities & Skills, Defenses, Speed & Senses, Actions, and Delete. Every change saves
 * through the character store like any sheet change (autosave).
 */
import { ABILITY_KEYS, COMPANION_ACTION_TYPES, COMPANION_RESOURCE_DISPLAYS, newCompanionAction, type Companion, type CompanionAction, type CompanionExtension } from '@omnibrew/engine/character'
import { companions as play } from '@omnibrew/engine/rules'

const props = defineProps<{ uuid: string }>()
const emit = defineEmits<{ close: [] }>()

const { t, te } = useI18n()
const { sheet, character, apply } = useSheet()
const { game } = useAppConfig()
const ext = computed<CompanionExtension>(() => sheet.value.game.def.character?.companion ?? {})
const raw = computed(() => character.value.companions.find(c => (c as { uuid?: unknown }).uuid === props.uuid))
const c = computed(() => (raw.value ? play.companionSheet(raw.value, ext.value).companion : null))
const tr = (key: string, fallback: string) => (te(key) ? t(key) : fallback)

const open = ref(true)
watch(open, (v) => {
  if (!v) emit('close')
})
watch(raw, (v) => {
  if (!v) emit('close')
})

const tab = ref('name')
const tabs = computed(() => ['name', 'abilities', 'defenses', 'movement', 'actions'].map(v => ({ label: t(`sheet.companions.tabs.${v}`), value: v })))
const edit = (fn: (x: Companion) => void) => apply(s => play.editCompanion(s.character, props.uuid, fn, ext.value))
const set = (key: string, value: unknown) => edit((x) => {
  (x as Record<string, unknown>)[key] = value
})
const num = (v: unknown) => (v === null || v === undefined || v === '' ? 0 : Math.floor(Number(v)) || 0)
const optNum = (v: unknown) => (v === null || v === undefined || v === '' ? undefined : Math.floor(Number(v)) || 0)

const skills = computed(() => sheet.value.content.list('skills').map(s => ({ label: String(s.name), value: String(s.id) })))
const abilities = computed(() => ABILITY_KEYS.map(a => ({ label: t(`abilities.${a}.title`), value: a as string })))
const damageTypes = computed(() => (sheet.value.enums.values.damageTypes ?? []).map(d => ({ label: tr(`damage_types.${d}`, d), value: d })))
const conditions = computed(() => sheet.value.content.list(game.sheet.conditions).map(x => ({ label: String(x.name), value: String(x.id) })))
const speedTypes = computed(() => sheet.value.enums.values.speeds ?? ['walk'])
const senseTypes = computed(() => (sheet.value.enums.values.senses ?? []))
const actionTypes = COMPANION_ACTION_TYPES.map(v => ({ label: t(`sheet.companions.types.${v.replace(' ', '_').toLowerCase()}`), value: v }))
const aoeTypes = computed(() => (sheet.value.enums.values.aoeShapes ?? []).map(a => ({ label: tr(`aoe_types.${a}`, a), value: a })))
const dieTypes = [4, 6, 8, 10, 12].map(d => ({ label: `d${d}`, value: d }))
const resourceDisplays = COMPANION_RESOURCE_DISPLAYS.map(v => ({ label: t(`sheet.companions.resource_${v.split(' ')[0]!.toLowerCase()}`), value: v }))

const editAction = (uuid: string, fn: (a: CompanionAction) => void) => edit((x) => {
  const a = x.features.find(f => f.uuid === uuid)
  if (a) fn(a)
})
const setAction = (uuid: string, key: keyof CompanionAction, value: unknown) => editAction(uuid, (a) => {
  (a as Record<string, unknown>)[key] = value
})
const addAction = () => edit((x) => {
  x.features.push(newCompanionAction())
})
const removeAction = (uuid: string) => edit((x) => {
  x.features = x.features.filter(f => f.uuid !== uuid)
})

const confirming = ref(false)
function remove() {
  apply(s => play.removeCompanion(s.character, props.uuid))
  emit('close')
}
</script>

<template>
  <UModal v-model:open="open" :title="t('sheet.companions.edit', { name: c?.name ?? '' })" fullscreen>
    <template #body>
      <div v-if="c" class="mx-auto flex max-w-3xl flex-col gap-4">
        <UTabs v-model="tab" :items="tabs" :content="false" class="max-sm:[&_[role=tablist]]:grid max-sm:[&_[role=tablist]]:grid-cols-3" />

        <!-- Name & Image -->
        <div v-if="tab === 'name'" class="grid gap-4">
          <UFormField :label="t('name_title')">
            <UInput :model-value="c.name" class="w-full" @update:model-value="v => set('name', String(v))" />
          </UFormField>
          <UFormField :label="t('sheet.companions.image')" :help="t('sheet.companions.image_help')">
            <UInput :model-value="c.image" inputmode="url" class="w-full" @update:model-value="v => set('image', String(v))" />
          </UFormField>
          <UFormField :label="t('sheet.companions.notes')">
            <UTextarea :model-value="c.notes" :rows="5" autoresize class="w-full" @update:model-value="v => set('notes', String(v))" />
          </UFormField>
        </div>

        <!-- Abilities & Skills -->
        <div v-else-if="tab === 'abilities'" class="grid gap-4">
          <div class="grid grid-cols-3 gap-3 sm:grid-cols-6">
            <UFormField v-for="a in ABILITY_KEYS" :key="a" :label="t(`abilities.${a}.abbr`)">
              <UInputNumber :model-value="Number(c[a])" :min="1" :max="30" class="w-full" @update:model-value="v => set(a, num(v))" />
            </UFormField>
          </div>
          <UFormField :label="t('sheet.companions.prof_bonus')">
            <UInputNumber :model-value="c.profBonus" :min="0" :max="10" class="w-32" @update:model-value="v => set('profBonus', num(v))" />
          </UFormField>
          <UFormField :label="t('saving_throws_title')">
            <USelectMenu :model-value="c.savingThrows" :items="abilities" value-key="value" multiple class="w-full" @update:model-value="v => set('savingThrows', v)" />
          </UFormField>
          <UFormField :label="t('skills_title')">
            <USelectMenu :model-value="c.skills" :items="skills" value-key="value" multiple class="w-full" @update:model-value="v => set('skills', v)" />
          </UFormField>
          <UFormField :label="t('sheet.settings.expertise')" :help="t('sheet.companions.expertise_help')">
            <USelectMenu :model-value="c.expertises" :items="skills.filter(s => c!.skills.includes(s.value))" value-key="value" multiple class="w-full" @update:model-value="v => set('expertises', v)" />
          </UFormField>
        </div>

        <!-- Defenses -->
        <div v-else-if="tab === 'defenses'" class="grid gap-4">
          <div class="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <UFormField :label="t('ac_title')">
              <UInputNumber :model-value="c.ac" :min="0" class="w-full" @update:model-value="v => set('ac', num(v))" />
            </UFormField>
            <UFormField :label="t('sheet.companions.max_hp')">
              <UInputNumber :model-value="c.hp" :min="0" class="w-full" @update:model-value="v => edit(x => { x.hp = num(v); x.currentHp = Math.min(x.currentHp, x.hp) })" />
            </UFormField>
            <template v-for="p in ext.pools ?? []" :key="p.id">
              <UFormField :label="t('sheet.companions.max_pool', { pool: t(p.label) })">
                <UInputNumber :model-value="Number(c[p.max]) || 0" :min="0" class="w-full" @update:model-value="v => edit(x => { const r = x as Record<string, unknown>; r[p.max] = num(v); r[p.current] = Math.min(Number(r[p.current]) || 0, num(v)) })" />
              </UFormField>
              <UFormField v-if="p.regen" :label="t('sheet.companions.pool_regen', { pool: t(p.label) })">
                <UInputNumber :model-value="Number(c[p.regen]) || 0" :min="0" class="w-full" @update:model-value="v => set(p.regen!, num(v))" />
              </UFormField>
            </template>
          </div>
          <UFormField :label="t('sheet.companions.resistances')">
            <USelectMenu :model-value="c.dmgRes" :items="damageTypes" value-key="value" multiple class="w-full" @update:model-value="v => set('dmgRes', v)" />
          </UFormField>
          <UFormField :label="t('sheet.companions.immunities')">
            <USelectMenu :model-value="c.dmgImm" :items="damageTypes" value-key="value" multiple class="w-full" @update:model-value="v => set('dmgImm', v)" />
          </UFormField>
          <UFormField :label="t('sheet.companions.vulnerabilities')">
            <USelectMenu :model-value="c.dmgVul" :items="damageTypes" value-key="value" multiple class="w-full" @update:model-value="v => set('dmgVul', v)" />
          </UFormField>
          <UFormField :label="t('sheet.companions.condition_immunities')">
            <USelectMenu :model-value="c.conImm" :items="conditions" value-key="value" multiple class="w-full" @update:model-value="v => set('conImm', v)" />
          </UFormField>
        </div>

        <!-- Speed & Senses -->
        <div v-else-if="tab === 'movement'" class="grid gap-4">
          <p class="text-sm text-muted">
            {{ t('sheet.companions.feet_help') }}
          </p>
          <div class="grid grid-cols-2 gap-3 sm:grid-cols-5">
            <UFormField v-for="s in speedTypes" :key="s" :label="tr(`speeds.${s}.title`, s)">
              <UInputNumber :model-value="Number(c.speed[s]) || 0" :min="0" :step="5" class="w-full" @update:model-value="v => edit(x => { x.speed = { ...x.speed, [s]: num(v) } })" />
            </UFormField>
          </div>
          <div class="grid grid-cols-2 gap-3 sm:grid-cols-5">
            <UFormField v-for="s in senseTypes" :key="s" :label="tr(`senses.${s.replaceAll('-', '_')}_title`, s)">
              <UInputNumber :model-value="Number(c.senses[s]) || 0" :min="0" :step="5" class="w-full" @update:model-value="v => edit(x => { x.senses = { ...x.senses, [s]: num(v) } })" />
            </UFormField>
          </div>
        </div>

        <!-- Actions -->
        <div v-else class="flex flex-col gap-3">
          <details v-for="a in c.features" :key="a.uuid" class="group rounded-md border border-default bg-muted" open>
            <summary class="flex cursor-pointer list-none items-center gap-2 p-3">
              <UIcon name="i-lucide-chevron-right" class="size-4 text-muted transition-transform group-open:rotate-90" />
              <span class="font-semibold text-highlighted">{{ a.name || t('sheet.companions.unnamed_action') }}</span>
              <span class="text-sm text-muted">{{ t(`sheet.companions.types.${a.type.replace(' ', '_').toLowerCase()}`) }}</span>
            </summary>
            <div class="grid gap-3 border-t border-default p-3 sm:grid-cols-4">
              <UFormField :label="t('name_title')" class="sm:col-span-2">
                <UInput :model-value="a.name" class="w-full" @update:model-value="v => setAction(a.uuid, 'name', String(v))" />
              </UFormField>
              <UFormField :label="t('sheet.companions.type')" class="sm:col-span-2">
                <USelect :model-value="a.type" :items="actionTypes" class="w-full" @update:model-value="v => setAction(a.uuid, 'type', v)" />
              </UFormField>
              <UFormField :label="t('sheet.companions.hit')">
                <UInputNumber :model-value="a.hit ?? null" class="w-full" @update:model-value="v => setAction(a.uuid, 'hit', optNum(v))" />
              </UFormField>
              <UFormField :label="t('sheet.companions.dc')">
                <UInputNumber :model-value="a.dc ?? null" :min="0" class="w-full" @update:model-value="v => setAction(a.uuid, 'dc', optNum(v))" />
              </UFormField>
              <UFormField :label="t('sheet.companions.dc_save')" class="sm:col-span-2">
                <USelect :model-value="a.dcSave || undefined" :items="abilities" class="w-full" @update:model-value="v => setAction(a.uuid, 'dcSave', String(v ?? ''))" />
              </UFormField>
              <UFormField :label="t('sheet.companions.range')">
                <UInputNumber :model-value="a.shortRange ?? null" :min="0" :step="5" class="w-full" @update:model-value="v => setAction(a.uuid, 'shortRange', optNum(v))" />
              </UFormField>
              <UFormField :label="t('sheet.companions.long_range')">
                <UInputNumber :model-value="a.longRange ?? null" :min="0" :max="600" :step="5" class="w-full" @update:model-value="v => setAction(a.uuid, 'longRange', optNum(v))" />
              </UFormField>
              <UFormField :label="t('sheet.companions.aoe')">
                <USelect :model-value="a.aoeType || undefined" :items="aoeTypes" class="w-full" @update:model-value="v => setAction(a.uuid, 'aoeType', String(v ?? ''))" />
              </UFormField>
              <UFormField :label="t('sheet.companions.aoe_size')">
                <UInputNumber :model-value="a.aoeSize ?? null" :min="0" :max="300" :step="5" class="w-full" @update:model-value="v => setAction(a.uuid, 'aoeSize', optNum(v))" />
              </UFormField>
              <UFormField :label="t('sheet.companions.damage_dice')">
                <UInputNumber :model-value="a.dmgDieCount ?? null" :min="0" class="w-full" @update:model-value="v => setAction(a.uuid, 'dmgDieCount', optNum(v))" />
              </UFormField>
              <UFormField :label="t('sheet.companions.damage_die')">
                <USelect :model-value="a.dmgDieType" :items="dieTypes" class="w-full" @update:model-value="v => setAction(a.uuid, 'dmgDieType', optNum(v))" />
              </UFormField>
              <UFormField :label="t('sheet.companions.damage_bonus')">
                <UInputNumber :model-value="a.dmgBonus ?? null" class="w-full" @update:model-value="v => setAction(a.uuid, 'dmgBonus', optNum(v))" />
              </UFormField>
              <UFormField :label="t('damage_title')">
                <USelect :model-value="a.dmgType || undefined" :items="damageTypes" class="w-full" @update:model-value="v => setAction(a.uuid, 'dmgType', String(v ?? ''))" />
              </UFormField>
              <UFormField :label="t('sheet.companions.uses_max')">
                <UInputNumber :model-value="a.resourceMax ?? null" :min="0" class="w-full" @update:model-value="v => setAction(a.uuid, 'resourceMax', optNum(v))" />
              </UFormField>
              <UFormField :label="t('sheet.companions.uses_display')" class="sm:col-span-3">
                <USelect :model-value="a.resourceDisplay" :items="resourceDisplays" class="w-full" @update:model-value="v => setAction(a.uuid, 'resourceDisplay', v)" />
              </UFormField>
              <UFormField :label="t('sheet.companions.description')" class="sm:col-span-4">
                <UTextarea :model-value="a.description" :rows="3" autoresize class="w-full" @update:model-value="v => setAction(a.uuid, 'description', String(v))" />
              </UFormField>
              <UButton color="error" variant="ghost" icon="i-lucide-trash-2" :label="t('sheet.companions.remove_action')" class="self-start" @click="removeAction(a.uuid)" />
            </div>
          </details>
          <UButton variant="outline" icon="i-lucide-plus" :label="t('sheet.companions.add_action')" class="self-start" @click="addAction" />
        </div>
      </div>
    </template>
    <template #footer>
      <div class="flex w-full flex-wrap justify-between gap-2">
        <UButton v-if="!confirming" color="error" variant="ghost" icon="i-lucide-trash-2" :label="t('sheet.companions.delete')" @click="confirming = true" />
        <div v-else class="flex items-center gap-2">
          <span class="text-sm text-default">{{ t('sheet.companions.delete_confirm', { name: c?.name ?? '' }) }}</span>
          <UButton color="error" :label="t('sheet.companions.delete')" @click="remove" />
          <UButton color="neutral" variant="ghost" :label="t('buttons.close')" @click="confirming = false" />
        </div>
        <UButton :label="t('sheet.companions.done')" @click="open = false" />
      </div>
    </template>
  </UModal>
</template>
