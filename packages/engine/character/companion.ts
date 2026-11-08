import { z } from 'zod'

/**
 * Companions (plan/26 §1.6): free-form stat blocks a player keeps on a character
 * (`character.companions`, the live `companion.js` shape, so the 3a migrator's copies
 * need no transform). The schema reads leniently: the live sheet stored some numbers as
 * strings, and keys it doesn't know are kept. A game adds fields and pools (ME: shields)
 * through `CharacterExtension.companion`.
 */
export const COMPANION_ACTION_TYPES = ['Attack', 'Action', 'Bonus Action', 'Reaction', 'Other'] as const
export type CompanionActionType = typeof COMPANION_ACTION_TYPES[number]
export const COMPANION_RESOURCE_DISPLAYS = ['Counter', 'Checkboxes', 'Heat Tracker'] as const

/** A pool a game adds to companions (ME shields), absorbed before hit points in this order. */
export interface CompanionPool {
  id: string
  /** i18n key. */
  label: string
  /** Text color classes, fixed per pool (B82). */
  color: string
  /** Companion fields holding its current value, its maximum and its regeneration. */
  current: string
  max: string
  regen?: string
}

export interface CompanionExtension {
  fields?: () => z.ZodRawShape
  defaults?: () => Record<string, unknown>
  pools?: CompanionPool[]
}

/** A number the live sheet may have stored as a string; anything unreadable is the fallback. */
const num = (fallback: number) => z.preprocess(v => (typeof v === 'string' && v.trim() !== '' ? Number(v) : v), z.number().finite()).catch(fallback)
const optNum = () => z.preprocess(v => (v === '' || v === null ? undefined : typeof v === 'string' ? Number(v) : v), z.number().finite().optional()).catch(undefined)
const strings = () => z.array(z.string()).catch([])
const text = (fallback = '') => z.string().catch(fallback)

export const companionActionSchema = z.looseObject({
  uuid: text(),
  name: text(),
  type: z.enum(COMPANION_ACTION_TYPES).catch('Action'),
  description: text(),
  hit: optNum(),
  dc: optNum(),
  dcSave: text(),
  shortRange: optNum(),
  longRange: optNum(),
  aoeType: text(),
  aoeSize: optNum(),
  dmgDieCount: optNum(),
  dmgDieType: optNum(),
  dmgBonus: optNum(),
  dmgType: text(),
  resourceMax: optNum(),
  resourceDisplay: z.enum(COMPANION_RESOURCE_DISPLAYS).optional().catch(undefined),
  remainingResources: optNum(),
})
export type CompanionAction = z.infer<typeof companionActionSchema>

export function companionSchema(ext: CompanionExtension = {}) {
  return z.looseObject({
    uuid: text(),
    name: text('New Companion'),
    image: text(),
    notes: text(),
    str: num(10),
    dex: num(10),
    con: num(10),
    int: num(10),
    wis: num(10),
    cha: num(10),
    profBonus: num(2),
    ac: num(10),
    hp: num(10),
    currentHp: num(10),
    speed: z.record(z.string(), num(0)).catch({ walk: 30 }),
    senses: z.record(z.string(), num(0)).catch({}),
    dmgVul: strings(),
    dmgRes: strings(),
    dmgImm: strings(),
    conImm: strings(),
    /** Conditions the companion has now (added in 3c-2; the live sheet had none). */
    conditions: strings(),
    skills: strings(),
    savingThrows: strings(),
    expertises: strings(),
    features: z.array(companionActionSchema).catch([]),
    ...ext.fields?.(),
  })
}
export type Companion = z.infer<ReturnType<typeof companionSchema>> & Record<string, unknown>

/** A new companion with the live defaults (`baseCompanion`) and the game's. */
export function newCompanion(ext: CompanionExtension = {}, uuid = `companion-${globalThis.crypto.randomUUID()}`): Companion {
  return companionSchema(ext).parse({
    uuid,
    name: 'New Companion',
    str: 10,
    dex: 10,
    con: 10,
    int: 10,
    wis: 10,
    cha: 10,
    profBonus: 2,
    ac: 10,
    hp: 10,
    currentHp: 10,
    speed: { walk: 30 },
    senses: {},
    ...ext.defaults?.(),
  }) as Companion
}

export function newCompanionAction(uuid = `companion-feature-${globalThis.crypto.randomUUID()}`): CompanionAction {
  return companionActionSchema.parse({ uuid, name: '', type: 'Action', description: '' })
}

/** Reads a stored companion (live or new); its uuid is kept or made up. */
export function readCompanion(raw: unknown, ext: CompanionExtension = {}): Companion {
  const c = companionSchema(ext).parse(raw && typeof raw === 'object' ? raw : {}) as Companion
  if (!c.uuid) c.uuid = `companion-${globalThis.crypto.randomUUID()}`
  c.features = c.features.map(f => (f.uuid ? f : { ...f, uuid: `companion-feature-${globalThis.crypto.randomUUID()}` }))
  return c
}
