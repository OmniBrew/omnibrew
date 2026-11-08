import { describe, expect, it, vi } from 'vitest'
import { createDiscordPoster, diceText, isWebhookUrl, MAX_WEBHOOKS, normalizeWebhooks, rollPayload, setWebhookCharacter, webhookErrors } from '../app/utils/discord'
import type { RollEntry } from '../app/stores/rolls'

const URL = 'https://discord.com/api/webhooks/123456789012345678/abcdefghijklmnopqrstuvwxyz_ABCDEFG-123'

describe('webhook URLs', () => {
  it('accepts Discord webhook URLs only', () => {
    expect(isWebhookUrl(URL)).toBe(true)
    expect(isWebhookUrl(URL.replace('discord.com', 'discordapp.com'))).toBe(true)
    expect(isWebhookUrl(URL.replace('discord.com', 'canary.discord.com'))).toBe(true)
    expect(isWebhookUrl(` ${URL} `)).toBe(true)
    expect(isWebhookUrl(URL.replace('https', 'http'))).toBe(false)
    expect(isWebhookUrl('https://evil.example/api/webhooks/123456789012345678/abcdefghijklmnopqrstuvwxyz')).toBe(false)
    expect(isWebhookUrl('https://discord.com/channels/1/2')).toBe(false)
  })

  it('reports missing and wrong URLs by index', () => {
    expect(webhookErrors([{ id: 'a', name: '', url: '', characters: [] }, { id: 'b', name: '', url: 'nope', characters: [] }, { id: 'c', name: '', url: URL, characters: [] }]))
      .toEqual({ 0: 'profile.webhooks.url_required', 1: 'profile.webhooks.url_invalid' })
  })
})

describe('the profile’s webhooks', () => {
  it('reads the live shape (link, characters as { name, id }) and this site’s', () => {
    expect(normalizeWebhooks([
      { id: 'webhook-0-1-x', name: 'Table', link: URL, characters: [{ name: 'Shep', id: 'c1' }, { name: 'Shep', id: 'c1' }] },
      { id: 'w2', name: 'Two', url: ` ${URL} `, characters: ['c2'] },
      null,
      'junk',
    ])).toEqual([
      { id: 'webhook-0-1-x', name: 'Table', url: URL, characters: ['c1'] },
      { id: 'w2', name: 'Two', url: URL, characters: ['c2'] },
    ])
    expect(normalizeWebhooks(null)).toEqual([])
  })

  it('keeps at most five', () => {
    expect(normalizeWebhooks(Array.from({ length: 7 }, (_, i) => ({ id: `w${i}`, url: URL })))).toHaveLength(MAX_WEBHOOKS)
  })

  it('turns one character on or off for one webhook only', () => {
    const list = [{ id: 'a', name: '', url: URL, characters: ['c1', 'c2'] }, { id: 'b', name: '', url: URL, characters: ['c1'] }]
    const off = setWebhookCharacter(list, 'a', 'c1', false)
    expect(off.map(w => w.characters)).toEqual([['c2'], ['c1']])
    expect(setWebhookCharacter(off, 'a', 'c1', true)[0]!.characters).toEqual(['c2', 'c1'])
    expect(setWebhookCharacter(list, 'a', 'c1', true)[0]!.characters).toEqual(['c2', 'c1'])
  })
})

const entry = (patch: Partial<RollEntry> = {}): RollEntry => ({ id: 'r', at: '2026-11-08T12:00:00.000Z', label: 'Pistol', kind: 'attack', notation: '2d20kh1+7', total: 21, dice: [{ sides: 20, value: 14 }, { sides: 20, value: 6, dropped: true }], ...patch })
const text = { kind: 'Attack', advantage: 'Advantage', crit: 'Critical hit!', fumble: 'Natural 1', damageType: (t: string) => t.toUpperCase(), footer: 'N7 World' }

describe('a roll as a Discord post', () => {
  it('names the character, shows the dice and total, and colors crits', () => {
    const p = rollPayload(entry({ advantage: 'advantage' }), { name: 'Shepard', avatar: 'https://n7.world/a.png' }, text)
    expect(p.username).toBe('Shepard')
    expect(p.avatar_url).toBe('https://n7.world/a.png')
    expect(p.embeds[0]).toMatchObject({ title: 'Pistol · Attack', description: '`2d20kh1+7` [14, ~~6~~] = **21**\nAdvantage', footer: { text: 'N7 World' }, timestamp: '2026-11-08T12:00:00.000Z' })
    expect(rollPayload(entry({ crit: true }), { name: 'S' }, text).embeds[0]!.color).not.toBe(p.embeds[0]!.color)
    expect(rollPayload(entry(), { name: '' }, text).username).toBe('N7 World')
  })

  it('lists damage parts when there are several', () => {
    const p = rollPayload(entry({ kind: 'damage', notation: '1d8 + 1d6', total: 9, parts: [{ type: 'fire', notation: '1d8', total: 5 }, { type: 'cold', notation: '1d6', total: 4 }] }), { name: 'S' }, text)
    expect(p.embeds[0]!.fields).toEqual([{ name: 'FIRE', value: '`1d8` = **5**', inline: true }, { name: 'COLD', value: '`1d6` = **4**', inline: true }])
    expect(diceText({ dice: [] })).toBe('')
  })
})

const response = (status: number, body: unknown = {}, headers: Record<string, string> = {}) => new Response(status === 204 ? null : JSON.stringify(body), { status, headers })

describe('posting', () => {
  it('posts one message at a time per webhook, in order', async () => {
    const order: string[] = []
    const fetch = vi.fn(async (_url: string, init: RequestInit) => {
      order.push(JSON.parse(String(init.body)).username)
      return response(204)
    })
    const poster = createDiscordPoster({ fetch: fetch as unknown as typeof globalThis.fetch })
    const results = await Promise.all(['a', 'b', 'c'].map(n => poster.post(URL, { username: n, embeds: [] })))
    expect(results).toEqual(['sent', 'sent', 'sent'])
    expect(order).toEqual(['a', 'b', 'c'])
  })

  it('waits out a 429 and retries, then gives up', async () => {
    const sleep = vi.fn(async () => {})
    const fetch = vi.fn()
      .mockResolvedValueOnce(response(429, { retry_after: 1.5 }))
      .mockResolvedValueOnce(response(204))
    const poster = createDiscordPoster({ fetch, sleep })
    expect(await poster.post(URL, { username: 'a', embeds: [] })).toBe('sent')
    expect(sleep).toHaveBeenCalledWith(1500)
    const always = createDiscordPoster({ fetch: vi.fn(async () => response(429, { retry_after: 0 })), sleep, tries: 2 })
    expect(await always.post(URL, { username: 'a', embeds: [] })).toBe('failed')
  })

  it('stops using a deleted webhook', async () => {
    const fetch = vi.fn(async () => response(404, { message: 'Unknown Webhook' }))
    const poster = createDiscordPoster({ fetch })
    expect(await poster.post(URL, { username: 'a', embeds: [] })).toBe('gone')
    expect(await poster.post(URL, { username: 'b', embeds: [] })).toBe('gone')
    expect(fetch).toHaveBeenCalledTimes(1)
    expect(poster.isGone(URL)).toBe(true)
  })

  it('waits when the rate-limit bucket is empty, and reports network failures', async () => {
    const sleep = vi.fn(async () => {})
    const poster = createDiscordPoster({ fetch: vi.fn(async () => response(204, null, { 'x-ratelimit-remaining': '0', 'x-ratelimit-reset-after': '0.4' })), sleep })
    expect(await poster.post(URL, { username: 'a', embeds: [] })).toBe('sent')
    expect(sleep).toHaveBeenCalledWith(400)
    const offline = createDiscordPoster({ fetch: vi.fn(async () => {
      throw new TypeError('offline')
    }) })
    expect(await offline.post(URL, { username: 'a', embeds: [] })).toBe('failed')
  })
})
