<script setup lang="ts">
/**
 * Settings & Overrides and Preferences (the live character side navs): values typed over
 * the computed ones, extra proficiencies, custom features, and the rule options. The
 * game adds its own (ME shields) through the `settings` slot and its options' labels.
 */
import { sheet as gameSheet } from '#game-client'
import { ABILITY_KEYS, type Character } from '@omnibrew/engine/character'
import { actions } from '@omnibrew/engine/rules'

const { t, te } = useI18n()
const { game } = useAppConfig()
const ui = useSheetUi()
const { sheet, character, apply } = useSheet()
const open = ui.model('settings')

const tab = ref<'overrides' | 'preferences' | 'custom'>('overrides')
const store = useCharacterStore()
const session = useSession()
const discord = useDiscord()
const toast = useToast()
// Discord webhooks are the signed-in owner's; a local character can't post (it has no stored id).
const canPost = computed(() => session.signedIn && store.editable && Boolean(store.id) && !isLocalId(store.id))
watch([open, canPost], ([o, c]) => {
  if (o && c) discord.load()
})
async function setWebhook(webhookId: string, on: boolean) {
  try {
    await discord.setCharacter(webhookId, store.id!, on)
  }
  catch {
    toast.add({ title: t('sheet.webhooks.save_failed'), color: 'error', icon: 'i-lucide-circle-alert' })
  }
}
const change = (fn: (c: Character) => void) => apply(s => actions.edit(s.character, fn))
const num = (v: unknown) => (v === null || v === undefined || v === '' ? null : Math.floor(Number(v)) || 0)

const o = computed(() => character.value.overrides)
const enums = computed(() => sheet.value.enums.values)
const tr = (key: string, fallback: string) => (te(key) ? t(key) : fallback)

const profLists = computed(() => [
  { key: 'skill' as const, label: t('skills_title'), items: sheet.value.content.list('skills').map(s => ({ label: s.name, value: s.id })) },
  { key: 'expertise' as const, label: t('sheet.settings.expertise'), items: sheet.value.content.list('skills').map(s => ({ label: s.name, value: s.id })) },
  { key: 'savingThrow' as const, label: t('saving_throws_title'), items: ABILITY_KEYS.map(a => ({ label: t(`abilities.${a}.title`), value: a })) },
  { key: 'armor' as const, label: t('armor_title', 1), items: (enums.value.armorTypes ?? []).map(a => ({ label: tr(`armor_types.${a}`, a), value: a })) },
  { key: 'weapon' as const, label: t('weapon_title', 2), items: (enums.value.weaponTypes ?? []).map(w => ({ label: tr(`weapon_types.${w}`, w), value: w })) },
  { key: 'tool' as const, label: t('sheet.profs.tools'), items: sheet.value.content.list('tool-profs').map(x => ({ label: x.name, value: x.id })) },
])
const defenseLists = computed(() => [
  { key: 'resistance' as const, label: t('sheet.settings.defense.resistance'), items: (enums.value.damageTypes ?? []).map(d => ({ label: tr(`damage_types.${d}`, d), value: d })) },
  { key: 'immunity' as const, label: t('sheet.settings.defense.immunity'), items: (enums.value.damageTypes ?? []).map(d => ({ label: tr(`damage_types.${d}`, d), value: d })) },
  { key: 'vulnerability' as const, label: t('sheet.settings.defense.vulnerability'), items: (enums.value.damageTypes ?? []).map(d => ({ label: tr(`damage_types.${d}`, d), value: d })) },
  { key: 'conditionImmunity' as const, label: t('sheet.settings.defense.conditionImmunity'), items: sheet.value.content.list(game.sheet.conditions).map(c => ({ label: c.name, value: c.id })) },
])
const speeds = ['walk', 'swim', 'fly', 'climb', 'burrow']
const senses = computed(() => enums.value.senses ?? [])
const rollKinds = ['all', 'melee', 'ranged', 'power'] as const

const coreOptions = ['armorSpeedPenalty', 'armorProficiencyPenalty', 'abilityScoreOnTop'] as const
const gameOptions = computed(() => Object.keys(character.value.options.game))
const settingsSlots = gameSheet.slots.settings ?? []

// Custom features ("brews").
const TYPES = ['action', 'bonus-action', 'reaction', 'other', 'feature']
function addFeature() {
  change(c => c.customFeatures.push({ id: `custom-${globalThis.crypto.randomUUID()}`, name: t('sheet.custom.new'), type: 'feature' }))
}
</script>

<template>
  <USlideover v-model:open="open" :title="t('sheet.settings.title')" :ui="{ content: 'max-w-xl' }">
    <template #body>
      <UTabs v-model="tab" :items="[{ label: t('sheet.settings.overrides'), value: 'overrides' }, { label: t('sheet.settings.preferences'), value: 'preferences' }, { label: t('sheet.settings.custom'), value: 'custom' }]" :content="false" class="mb-4" />

      <div v-if="tab === 'overrides'" class="flex flex-col gap-6 text-sm">
        <section class="flex flex-col gap-3">
          <h3 class="section-tick font-label font-semibold text-highlighted">
            {{ t('sheet.settings.defensive') }}
          </h3>
          <div class="grid grid-cols-3 gap-3">
            <UFormField :label="t('sheet.settings.hp_override')" :hint="String(sheet.hp.max)">
              <UInputNumber :model-value="o.hp ?? undefined" :min="1" :placeholder="t('sheet.settings.auto')" @update:model-value="v => change(c => (c.overrides.hp = num(v)))" />
            </UFormField>
            <UFormField :label="t('sheet.settings.ac_override')" :hint="String(sheet.ac)">
              <UInputNumber :model-value="o.ac ?? undefined" :min="0" :placeholder="t('sheet.settings.auto')" @update:model-value="v => change(c => (c.overrides.ac = num(v)))" />
            </UFormField>
            <UFormField :label="t('sheet.settings.ac_bonus')">
              <UInputNumber :model-value="o.acBonus" @update:model-value="v => change(c => (c.overrides.acBonus = num(v) ?? 0))" />
            </UFormField>
          </div>
          <component :is="part" v-for="(part, i) in settingsSlots" :key="i" />
          <UFormField v-for="d in defenseLists" :key="d.key" :label="d.label">
            <USelectMenu :model-value="o.defenses[d.key]" :items="d.items" value-key="value" multiple class="w-full" @update:model-value="(v: string[]) => change(c => (c.overrides.defenses[d.key] = v))" />
          </UFormField>
        </section>

        <section class="flex flex-col gap-3">
          <h3 class="section-tick font-label font-semibold text-highlighted">
            {{ t('sheet.settings.offensive') }}
          </h3>
          <div class="grid grid-cols-[auto_1fr_1fr] items-center gap-x-3 gap-y-2">
            <span />
            <span class="eyebrow text-muted">{{ t('sheet.settings.attack') }}</span>
            <span class="eyebrow text-muted">{{ t('damage_title') }}</span>
            <template v-for="k in rollKinds" :key="k">
              <span>{{ t(`sheet.settings.roll_kind.${k}`) }}</span>
              <UInputNumber :model-value="o.attack[k]" size="sm" :aria-label="`${t('sheet.settings.attack')} ${t(`sheet.settings.roll_kind.${k}`)}`" @update:model-value="v => change(c => (c.overrides.attack[k] = num(v) ?? 0))" />
              <UInputNumber :model-value="o.damage[k]" size="sm" :aria-label="`${t('damage_title')} ${t(`sheet.settings.roll_kind.${k}`)}`" @update:model-value="v => change(c => (c.overrides.damage[k] = num(v) ?? 0))" />
            </template>
          </div>
        </section>

        <section v-if="sheet.classes.length" class="flex flex-col gap-3">
          <h3 class="section-tick font-label font-semibold text-highlighted">
            {{ t('sheet.settings.powercasting') }}
          </h3>
          <UFormField v-for="k in sheet.classes" :key="k.id" :label="k.data.name" :hint="sheet.powercastingAbilities[k.id] ? t(`abilities.${sheet.powercastingAbilities[k.id]}.title`) : t('none')">
            <USelect
              :model-value="o.powercasting[k.id] ?? NONE"
              :items="[{ label: t('sheet.settings.auto'), value: NONE }, ...ABILITY_KEYS.map(a => ({ label: t(`abilities.${a}.title`), value: a }))]"
              class="w-48"
              @update:model-value="v => change(c => { if (fromSelect(v)) c.overrides.powercasting[k.id] = fromSelect(v); else delete c.overrides.powercasting[k.id] })"
            />
          </UFormField>
        </section>

        <section class="flex flex-col gap-3">
          <h3 class="section-tick font-label font-semibold text-highlighted">
            {{ t('sheet.settings.abilities') }}
          </h3>
          <div class="grid grid-cols-[auto_1fr_1fr] items-center gap-x-3 gap-y-2">
            <span />
            <span class="eyebrow text-muted">{{ t('sheet.settings.bonus') }}</span>
            <span class="eyebrow text-muted">{{ t('sheet.settings.override') }}</span>
            <template v-for="a in ABILITY_KEYS" :key="a">
              <span>{{ t(`abilities.${a}.abbr`) }} <span class="font-mono text-xs text-muted">{{ sheet.abilities[a]?.total ?? '–' }}</span></span>
              <UInputNumber :model-value="character.abilityScores.bonus[a] ?? undefined" size="sm" :aria-label="`${t(`abilities.${a}.title`)} ${t('sheet.settings.bonus')}`" @update:model-value="v => change(c => (c.abilityScores.bonus[a] = num(v)))" />
              <UInputNumber :model-value="character.abilityScores.override[a] ?? undefined" :min="1" :max="30" size="sm" :aria-label="`${t(`abilities.${a}.title`)} ${t('sheet.settings.override')}`" @update:model-value="v => change(c => (c.abilityScores.override[a] = num(v)))" />
            </template>
          </div>
        </section>

        <section class="flex flex-col gap-3">
          <h3 class="section-tick font-label font-semibold text-highlighted">
            {{ t('proficiencies_title') }}
          </h3>
          <UFormField v-for="p in profLists" :key="p.key" :label="p.label">
            <USelectMenu :model-value="o.profs[p.key]" :items="p.items" value-key="value" multiple class="w-full" @update:model-value="(v: string[]) => change(c => (c.overrides.profs[p.key] = v))" />
          </UFormField>
        </section>

        <section class="flex flex-col gap-3">
          <h3 class="section-tick font-label font-semibold text-highlighted">
            {{ t('sheet.settings.speeds_senses') }}
          </h3>
          <div class="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <UFormField v-for="s in speeds" :key="s" :label="t(`speeds.${s}.title`)">
              <UInputNumber :model-value="o.speeds[s] || undefined" :min="0" :step="5" :placeholder="t('sheet.settings.auto')" @update:model-value="v => change(c => { if (num(v)) c.overrides.speeds[s] = num(v)!; else delete c.overrides.speeds[s] })" />
            </UFormField>
            <UFormField v-for="s in senses" :key="s" :label="t(`senses.${s.replaceAll('-', '_')}_title`)">
              <UInputNumber :model-value="o.senses[s] || undefined" :min="0" :step="5" :placeholder="t('sheet.settings.auto')" @update:model-value="v => change(c => { if (num(v)) c.overrides.senses[s] = num(v)!; else delete c.overrides.senses[s] })" />
            </UFormField>
          </div>
          <p class="text-xs text-muted">
            {{ t('sheet.settings.feet') }}
          </p>
        </section>
      </div>

      <div v-else-if="tab === 'preferences'" class="flex flex-col gap-4">
        <USwitch
          v-for="key in coreOptions"
          :key="key"
          :model-value="character.options[key]"
          :label="t(`sheet.preferences.${key}`)"
          :description="te(`sheet.preferences.${key}_text`) ? t(`sheet.preferences.${key}_text`) : undefined"
          @update:model-value="v => change(c => (c.options[key] = !!v))"
        />
        <USwitch
          v-for="key in gameOptions"
          :key="key"
          :model-value="Boolean(character.options.game[key])"
          :label="tr(`sheet.preferences.${key}`, key)"
          :description="te(`sheet.preferences.${key}_text`) ? t(`sheet.preferences.${key}_text`) : undefined"
          @update:model-value="v => change(c => (c.options.game[key] = !!v))"
        />
        <section class="mt-2 border-t border-default pt-4" aria-labelledby="sheet-webhooks">
          <h3 id="sheet-webhooks" class="eyebrow mb-1 text-muted">
            {{ t('profile.webhooks.title') }}
          </h3>
          <p v-if="!canPost" class="text-sm text-muted">
            {{ t(session.signedIn ? 'sheet.webhooks.not_stored' : 'sheet.webhooks.sign_in') }}
          </p>
          <div v-else-if="discord.status === 'loading'" class="py-2">
            <UIcon name="i-lucide-loader-circle" class="size-5 animate-spin text-dimmed" />
          </div>
          <p v-else-if="discord.status === 'error'" class="text-sm text-error">
            {{ t('sheet.webhooks.load_failed') }}
          </p>
          <template v-else>
            <p v-if="!discord.webhooks?.length" class="text-sm text-muted">
              {{ t('sheet.webhooks.none') }}
            </p>
            <div v-else class="flex flex-col gap-3">
              <p class="text-sm text-muted">
                {{ t('sheet.webhooks.text') }}
              </p>
              <USwitch
                v-for="(w, i) in discord.webhooks"
                :key="w.id"
                :model-value="w.characters.includes(store.id!)"
                :label="w.name || t('profile.webhooks.name_placeholder', { n: i + 1 })"
                data-webhook-switch
                @update:model-value="v => setWebhook(w.id, !!v)"
              />
            </div>
            <ULink to="/profile" class="mt-2 inline-block text-sm text-primary">
              {{ t('sheet.webhooks.manage') }}
            </ULink>
          </template>
        </section>
      </div>

      <div v-else class="flex flex-col gap-3">
        <p class="text-sm text-muted">
          {{ t('sheet.custom.text') }}
        </p>
        <div v-for="(f, i) in character.customFeatures" :key="f.id" class="flex flex-col gap-2 rounded-md border border-default bg-muted p-3">
          <div class="flex gap-2">
            <UInput :model-value="f.name" :aria-label="t('name_title')" class="flex-1" @update:model-value="v => change(c => (c.customFeatures[i]!.name = String(v)))" />
            <UButton icon="i-lucide-trash-2" color="error" variant="ghost" :aria-label="t('characters.delete')" @click="change(c => c.customFeatures.splice(i, 1))" />
          </div>
          <div class="grid grid-cols-3 gap-2">
            <USelect :model-value="f.type" :items="TYPES.map(x => ({ label: t(`sheet.custom.types.${x}`), value: x }))" :aria-label="t('type_title')" @update:model-value="v => change(c => (c.customFeatures[i]!.type = String(v)))" />
            <UInputNumber :model-value="f.uses ?? undefined" :min="0" :placeholder="t('sheet.custom.uses')" :aria-label="t('sheet.custom.uses')" @update:model-value="v => change(c => { if (num(v)) c.customFeatures[i]!.uses = num(v)!; else delete c.customFeatures[i]!.uses })" />
            <USelect :model-value="f.recharge ?? 'long'" :items="['short', 'long'].map(x => ({ label: t(`sheet.resource.per_${x}`), value: x }))" :aria-label="t('sheet.custom.recharge')" @update:model-value="v => change(c => (c.customFeatures[i]!.recharge = String(v)))" />
          </div>
          <UTextarea :model-value="htmlToText(f.html ?? '')" :rows="3" autoresize :aria-label="t('sheet.custom.description')" @update:model-value="v => change(c => (c.customFeatures[i]!.html = String(v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')))" />
        </div>
        <UButton :label="t('sheet.custom.add')" icon="i-lucide-plus" variant="outline" class="self-start" @click="addFeature" />
      </div>
    </template>
  </USlideover>
</template>
