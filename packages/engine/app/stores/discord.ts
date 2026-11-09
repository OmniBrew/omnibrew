import { cardImage } from '@omnibrew/engine/schemas'
import { createDiscordPoster, normalizeWebhooks, rollPayload, setWebhookCharacter, type DiscordWebhook } from '../utils/discord'
import type { RollEntry } from './rolls'

/**
 * Discord posting for the open sheet (plan/26 §1.5). The webhooks are the signed-in
 * owner's (profile, owner-only); a webhook posts the rolls of the characters it names.
 * The sheet's Preferences turn this character on or off for each webhook. A deleted
 * webhook (Discord answers 401 or 404) shows one toast and is skipped for the session.
 */
export const useDiscord = defineStore('discord', () => {
  const session = useSession()
  const webhooks = ref<DiscordWebhook[] | null>(null)
  const status = ref<'idle' | 'loading' | 'ready' | 'error'>('idle')
  const poster = createDiscordPoster({ fetch: (...args) => globalThis.fetch(...args) })
  let loadedFor: string | null = null

  async function load() {
    const owner = session.user?.sub ?? null
    if (!owner) {
      webhooks.value = null
      status.value = 'idle'
      loadedFor = null
      return
    }
    if (loadedFor === owner && status.value === 'ready') return
    loadedFor = owner
    status.value = 'loading'
    try {
      const data = await useUserData()
      if (!data) throw new Error('no backend')
      webhooks.value = normalizeWebhooks((await data.profile.mine()).webhooks)
      status.value = 'ready'
    }
    catch {
      status.value = 'error'
    }
  }

  /** Turns a character's rolls on or off for one webhook, saved to the profile. */
  async function setCharacter(webhookId: string, characterId: string, on: boolean) {
    if (!webhooks.value) return
    const previous = webhooks.value
    webhooks.value = setWebhookCharacter(previous, webhookId, characterId, on)
    try {
      const data = await useUserData()
      if (!data) throw new Error('no backend')
      webhooks.value = normalizeWebhooks((await data.profile.update({ webhooks: webhooks.value })).webhooks)
    }
    catch (e) {
      webhooks.value = previous
      throw e
    }
  }

  const forCharacter = (characterId: string) => (webhooks.value ?? []).filter(w => w.characters.includes(characterId) && w.url)

  return { webhooks, status, poster, load, setCharacter, forCharacter }
})

/**
 * Posts the open sheet's rolls to its webhooks. Called by the sheet page; only the
 * signed-in owner of a stored character posts (view-only sheets never do, as live).
 */
const NOT_POSTED = new Set(['hit_dice', 'recovery'])

export function useDiscordPosting() {
  const { t, te } = useI18n()
  const toast = useToast()
  const session = useSession()
  const store = useCharacterStore()
  const rolls = useRollStore()
  const discord = useDiscord()
  const warned = new Set<string>()

  const active = computed(() => session.signedIn && store.editable && Boolean(store.id) && !isLocalId(store.id))
  watch(active, (on) => {
    if (on) discord.load()
  }, { immediate: true })

  function avatar(): string | undefined {
    const character = store.character
    const species = character?.species && store.sheet ? store.sheet.content.get('species', character.species) : null
    const path = character?.image || (store.sheet ? cardImage(store.sheet.game.def, 'species', species) : '')
    if (!path) return undefined
    try {
      return new URL(path, window.location.origin).toString()
    }
    catch {
      return undefined
    }
  }

  async function post(entry: RollEntry, characterId: string | null) {
    // Rest rolls (hit dice, recovery) stay on the sheet, as live.
    if (!active.value || !characterId || characterId !== store.id || NOT_POSTED.has(entry.kind)) return
    const targets = discord.forCharacter(characterId).filter(w => !discord.poster.isGone(w.url))
    if (!targets.length) return
    const payload = rollPayload(entry, { name: store.character?.name || t('characters.unnamed'), avatar: avatar() }, {
      kind: te(`sheet.roll.kind.${entry.kind}`) ? t(`sheet.roll.kind.${entry.kind}`) : entry.kind,
      advantage: entry.advantage ? t(`sheet.roll.${entry.advantage}`) : undefined,
      crit: t('sheet.roll.crit'),
      fumble: t('sheet.roll.fumble'),
      damageType: type => (te(`damage_types.${type}`) ? t(`damage_types.${type}`) : type),
      footer: t('profile.webhooks.footer'),
    })
    for (const w of targets) {
      const result = await discord.poster.post(w.url, payload)
      if (result === 'gone' && !warned.has(w.url)) {
        warned.add(w.url)
        toast.add({ title: t('profile.webhooks.gone'), description: w.name, color: 'warning', icon: 'i-simple-icons-discord', actions: [{ label: t('auth.profile_title'), to: '/profile' }] })
      }
    }
  }

  const stop = rolls.onRoll((entry, characterId) => {
    void post(entry, characterId)
  })
  onBeforeUnmount(stop)
}
