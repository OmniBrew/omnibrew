/** What a post needs of a roll (the roll store's `RollEntry`). */
export interface PostedRoll {
  at: string
  label: string
  notation: string
  total: number
  dice: Array<{ value: number, dropped?: boolean, sides?: number }>
  kind?: string
  advantage?: string
  crit?: boolean
  fumble?: boolean
  parts?: Array<{ type: string, notation: string, total: number }>
}

/**
 * Discord webhooks (plan/26 §1.5): kept on the profile (owner-only, B70), at most five,
 * each naming the characters whose rolls it posts. Posting stays in the browser, as live.
 * The live profile stored `{ id, name, link, characters: [{ name, id }] }`; `normalizeWebhooks`
 * reads that shape too, so 3d copies the field as it is.
 */
export interface DiscordWebhook {
  id: string
  name: string
  url: string
  /** Character ids whose rolls post here. */
  characters: string[]
}

export const MAX_WEBHOOKS = 5

/** A Discord webhook URL (Server Settings › Integrations › Webhooks › Copy Webhook URL). */
const WEBHOOK_URL = /^https:\/\/(?:(?:ptb|canary)\.)?discord(?:app)?\.com\/api\/webhooks\/\d{5,25}\/[\w-]{20,100}\/?$/

export const isWebhookUrl = (url: string) => WEBHOOK_URL.test(url.trim())

/** The profile's webhooks, from this site's shape or the live one; anything else is dropped. */
export function normalizeWebhooks(raw: unknown): DiscordWebhook[] {
  if (!Array.isArray(raw)) return []
  const out: DiscordWebhook[] = []
  for (const w of raw) {
    if (!w || typeof w !== 'object') continue
    const r = w as Record<string, unknown>
    const url = typeof r.url === 'string' ? r.url : typeof r.link === 'string' ? r.link : ''
    const characters = Array.isArray(r.characters)
      ? r.characters.map(c => (typeof c === 'string' ? c : c && typeof c === 'object' && typeof (c as { id?: unknown }).id === 'string' ? (c as { id: string }).id : null)).filter((c): c is string => Boolean(c))
      : []
    out.push({ id: typeof r.id === 'string' && r.id ? r.id : globalThis.crypto.randomUUID(), name: typeof r.name === 'string' ? r.name : '', url: url.trim(), characters: [...new Set(characters)] })
  }
  return out.slice(0, MAX_WEBHOOKS)
}

/** Problems with a webhook list before saving: i18n keys by webhook index. */
export function webhookErrors(list: DiscordWebhook[]): Record<number, string> {
  const errors: Record<number, string> = {}
  list.forEach((w, i) => {
    if (!w.url.trim()) errors[i] = 'profile.webhooks.url_required'
    else if (!isWebhookUrl(w.url)) errors[i] = 'profile.webhooks.url_invalid'
  })
  return errors
}

/** Turns a character's posting on or off for one webhook. */
export function setWebhookCharacter(list: DiscordWebhook[], webhookId: string, characterId: string, on: boolean): DiscordWebhook[] {
  return list.map((w) => {
    if (w.id !== webhookId) return w
    const rest = w.characters.filter(c => c !== characterId)
    return { ...w, characters: on ? [...rest, characterId] : rest }
  })
}

export interface DiscordPayload {
  username: string
  avatar_url?: string
  embeds: Array<{
    title: string
    description: string
    color?: number
    fields?: Array<{ name: string, value: string, inline?: boolean }>
    footer?: { text: string }
    timestamp?: string
  }>
}

/** What the payload needs translated (the page passes `t`'s results). */
export interface RollPostText {
  /** The roll's kind ("Attack", "Damage"). */
  kind: string
  /** "Advantage", "Disadvantage", "Critical hit", "Natural 1", when they apply. */
  advantage?: string
  crit?: string
  fumble?: string
  /** A damage type's name. */
  damageType: (type: string) => string
  footer: string
}

// Embed side colors (Discord takes integers): crits emerald, fumbles red, the rest alliance blue.
const COLORS = { crit: 0x10B981, fumble: 0xEF4444, roll: 0x0EA5E9 }

/** The dice of a roll as text: kept dice, then dropped ones struck through (`[14, ~~6~~]`). */
export function diceText(entry: Pick<PostedRoll, 'dice'>): string {
  if (!entry.dice.length) return ''
  return `[${entry.dice.map(d => (d.dropped ? `~~${d.value}~~` : String(d.value))).join(', ')}]`
}

const clip = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1)}…` : s)

/** One roll as a Discord message: the character as the sender, one embed with the result. */
export function rollPayload(entry: PostedRoll, sender: { name: string, avatar?: string }, text: RollPostText): DiscordPayload {
  const dice = diceText(entry)
  const notes = [entry.advantage && text.advantage, entry.crit && text.crit, entry.fumble && text.fumble].filter(Boolean)
  const fields = (entry.parts ?? []).length > 1
    ? entry.parts!.map(p => ({ name: text.damageType(p.type), value: `\`${p.notation}\` = **${p.total}**`, inline: true }))
    : undefined
  return {
    username: clip(sender.name || 'N7 World', 80),
    ...(sender.avatar ? { avatar_url: sender.avatar } : {}),
    embeds: [{
      title: clip(`${entry.label} · ${text.kind}`, 256),
      description: clip([`\`${entry.notation}\`${dice ? ` ${dice}` : ''} = **${entry.total}**`, notes.join(' · ')].filter(Boolean).join('\n'), 4096),
      color: entry.crit ? COLORS.crit : entry.fumble ? COLORS.fumble : COLORS.roll,
      ...(fields ? { fields } : {}),
      footer: { text: text.footer },
      timestamp: entry.at,
    }],
  }
}

export type PostResult = 'sent' | 'gone' | 'failed'

interface PosterOptions {
  fetch: typeof globalThis.fetch
  sleep?: (ms: number) => Promise<void>
  /** Tries per message (the first send plus retries after a 429). */
  tries?: number
}

/**
 * Posts to Discord one message at a time per webhook (about 5 requests per 2 seconds are
 * allowed per webhook): waits when the rate-limit headers say the bucket is empty, waits
 * out a 429's `retry_after` and retries, and gives up after `tries`. A 401 or 404 means
 * the webhook was deleted: `gone`, and the caller stops using it.
 */
export function createDiscordPoster({ fetch, sleep = ms => new Promise(r => setTimeout(r, ms)), tries = 3 }: PosterOptions) {
  const queues = new Map<string, Promise<unknown>>()
  const gone = new Set<string>()

  async function send(url: string, payload: DiscordPayload): Promise<PostResult> {
    for (let attempt = 0; attempt < tries; attempt++) {
      if (gone.has(url)) return 'gone'
      let res: Response
      try {
        res = await fetch(`${url}${url.includes('?') ? '&' : '?'}wait=false`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
      }
      catch {
        return 'failed'
      }
      if (res.status === 401 || res.status === 404) {
        gone.add(url)
        return 'gone'
      }
      if (res.status === 429) {
        const body = await res.json().catch(() => ({})) as { retry_after?: number }
        const seconds = Number(body.retry_after ?? res.headers.get('retry-after') ?? 1)
        await sleep(Math.min(Math.max(seconds, 0.2), 30) * 1000)
        continue
      }
      if (!res.ok) return 'failed'
      if (res.headers.get('x-ratelimit-remaining') === '0') {
        const reset = Number(res.headers.get('x-ratelimit-reset-after') ?? 0)
        if (reset > 0) await sleep(Math.min(reset, 30) * 1000)
      }
      return 'sent'
    }
    return 'failed'
  }

  /** Queues a post behind this webhook's earlier ones. */
  function post(url: string, payload: DiscordPayload): Promise<PostResult> {
    const previous = queues.get(url) ?? Promise.resolve()
    const next = previous.then(() => send(url, payload))
    queues.set(url, next.catch(() => {}))
    return next
  }

  return { post, isGone: (url: string) => gone.has(url) }
}
