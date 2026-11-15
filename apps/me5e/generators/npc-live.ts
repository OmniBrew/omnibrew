import type { GeneratedNpc, NpcEntries, NpcEntry } from './npc'
import { ordinal } from './npc'

/**
 * A generated NPC bookmarked on the live site (`format: 'live'`: the live generator's
 * output, old bestiary.json keys) as a new bestiary record, the shape the stat block
 * shows. It does in the browser what the content migration (`migrate/record.ts`) did to
 * the bestiary, for the few things a generated NPC holds:
 * - "none" markers (`false`, `null`, `{}`, `[]`) dropped: irv, senses, shields, image, entries;
 * - Vue tags in text (`<me-distance length="5" />`, `<me-condition id="prone" />`) as MDC;
 * - powercasting lists marked as powers (`ref: power`), with the tech points or pact slots
 *   (fields the bestiary has no place for) written into the text;
 * - per-turn features ("1/Turn") written as "Once per turn" text;
 * - an id that is a valid slug (live ids held spaces).
 */
type Rec = Record<string, unknown>

const isObject = (v: unknown): v is Rec => typeof v === 'object' && v !== null && !Array.isArray(v)
const isNone = (v: unknown) => v === false || v === null || v === undefined || v === '' || (Array.isArray(v) && !v.length) || (isObject(v) && !Object.keys(v).length)

/** `<me-distance length="15" adj />` → `:distance{length="15" adj}`; `:length="5"` bindings become plain. */
export function liveTagsToMdc(text: string): string {
  return text
    .replace(/<me-(distance|condition|weight)\b([^>]*?)\/?>(?:\s*<\/me-\1>)?/g, (_, tag: string, attrs: string) => {
      const props = attrs.trim().replace(/\/$/, '').trim().replace(/(^|\s):([\w-]+)=/g, '$1$2=')
      return `:${tag}{${props}}`
    })
    .replace(/\s*\n\s*/g, ' ')
}

const ENTRY_KEYS = ['id', 'name', 'text', 'hit', 'miss', 'target', 'attack', 'mod', 'proficient', 'range', 'damage', 'dc', 'save', 'recharge', 'perDay', 'uses', 'cost', 'ref', 'weaponId', 'casterLevel', 'list']

function convertEntry(raw: Rec): NpcEntry {
  const e: Rec = {}
  for (const key of ENTRY_KEYS) if (!isNone(raw[key])) e[key] = typeof raw[key] === 'string' ? liveTagsToMdc(raw[key]) : raw[key]
  if (Array.isArray(e.damage)) e.damage = e.damage.filter(isObject).map(d => Object.fromEntries(Object.entries(d).filter(([k, v]) => ['dieCount', 'dieType', 'type', 'mod'].includes(k) && v !== null)))
  if (e.id === 'powercasting' || e.id === 'innate-powercasting') {
    e.ref = 'power'
    const tech = raw.tech as { points?: number, limit?: number } | undefined
    const pact = raw.pact as { numSlots?: number, maxLevel?: number } | undefined
    let text = String(e.text ?? '')
    if (isObject(tech) && tech.points) {
      const limit = `(at most ${tech.limit ?? 1} on one power)`
      text = /tech points,/.test(text) ? text.replace(/tech points,/, `tech points ${limit},`) : `${text} It has ${tech.points} tech points ${limit}.`
    }
    if (isObject(pact) && pact.numSlots) {
      const slots = `It has ${pact.numSlots} ${ordinal(pact.maxLevel ?? 1)}-level power slot${pact.numSlots === 1 ? '' : 's'}.`
      text = text.includes('It regains') ? text.replace('It regains', `${slots} It regains`) : `${slots} ${text}`
    }
    if (text) e.text = text.trim()
  }
  if (raw.perTurn) {
    delete e.uses
    const text = String(e.text ?? '')
    e.text = `Once per turn, ${text.charAt(0).toLowerCase()}${text.slice(1)}`
  }
  if (typeof e.casterLevel === 'string' && /^\d+$/.test(e.casterLevel)) e.casterLevel = Number(e.casterLevel)
  return e as NpcEntry
}

/** Entries as a list (very old NPCs kept actions in an object keyed by id). */
const entryList = (value: unknown): NpcEntry[] =>
  (Array.isArray(value) ? value : isObject(value) ? Object.entries(value).map(([id, v]) => (isObject(v) ? { id, ...v } : v)) : [])
    .filter(isObject)
    .map(convertEntry)

const SENSES: Record<string, string> = { infrared_vision: 'infrared-vision' }

export function fromLiveNpc(live: Rec): GeneratedNpc {
  const npc: Rec = {}
  const name = typeof live.name === 'string' ? live.name : 'Generated NPC'
  const id = String(live.id ?? name).toLowerCase().replace(/[^a-z\d-]+/g, '-').replace(/^-+|-+$/g, '')
  npc.id = id || 'generated-npc'
  npc.name = name
  for (const key of ['size', 'type', 'alignment', 'ac', 'hp', 'speed', 'abilityScores', 'cr', 'profBonus']) if (!isNone(live[key])) npc[key] = live[key]
  npc.unit = 'archetype'
  for (const key of ['savingThrows', 'skills', 'shields']) if (!isNone(live[key])) npc[key] = live[key]
  if (isObject(live.senses)) {
    const senses = Object.fromEntries(Object.entries(live.senses).filter(([, v]) => typeof v === 'number').map(([k, v]) => [SENSES[k] ?? k, v]))
    if (Object.keys(senses).length) npc.senses = senses
  }
  if (isObject(live.irv)) {
    const irv = Object.fromEntries(['res', 'damImm', 'vul', 'conImm'].filter(k => Array.isArray((live.irv as Rec)[k]) && ((live.irv as Rec)[k] as unknown[]).length).map(k => [k, (live.irv as Rec)[k]]))
    if (Object.keys(irv).length) npc.irv = irv
  }
  if (isObject(npc.shields) && !npc.shields.regen) npc.shields = { capacity: npc.shields.capacity }

  const raw = isObject(live.entries) ? live.entries : {}
  const entries: NpcEntries = {}
  for (const key of ['features', 'actions', 'reactions'] as const) {
    const list = entryList(raw[key])
    if (list.length) entries[key] = list
  }
  const legendary = isObject(raw.legendary) ? raw.legendary : undefined
  const legendaryActions = entryList(legendary?.actions)
  if (legendaryActions.length) {
    entries.legendary = { ...(typeof legendary?.text === 'string' ? { text: liveTagsToMdc(legendary.text) } : {}), actions: legendaryActions }
  }
  npc.entries = entries
  return npc as unknown as GeneratedNpc
}
