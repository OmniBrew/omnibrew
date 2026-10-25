import { CHARACTER_VERSION, characterSchema, type Character, type ChoiceValue } from '@omnibrew/engine/character'
import { gearRecords, type RulesContent } from '@omnibrew/engine/rules'
import type { Game } from '@omnibrew/engine/schemas'
import jsonpack from 'jsonpack/main'
import { meLegacy } from './legacy'
import { LEGACY_CURRENT, legacyMigrate } from './legacy-character'

/**
 * Old character → engine character model (plan/18). Re-runnable and pure:
 *
 * 1. unpack: the `data` string of a `Character` row is jsonpack;
 * 2. the live site's own migrations bring it to cbVersion 1.0.2 (`legacy-character.ts`);
 * 3. 1.0.2 maps field by field to the model (`characterSchema`, version 1);
 * 4. content renames since the live data apply: the game's renamed mechanic
 *    types and enum values (plan/04 B20), renamed record ids
 *    (`destiny-acension` → `destiny-ascension`), and the Cain's resource
 *    (`m-560-hydra` → `m-920-cain`, only on a character with a Cain);
 * 5. every content id is checked: one the content doesn't have is kept as it
 *    is and reported (`unknown`); homebrew ids (powers and weapons from the
 *    Homebrew table) are reported apart. Nothing is dropped silently: a value
 *    that can't be carried over is listed in `dropped`.
 */
type Rec = Record<string, any> // eslint-disable-line @typescript-eslint/no-explicit-any -- old untyped character JSON

export interface MigrationIssue {
  /** Where in the old character (`equipment[2].mods.barrel`). */
  at: string
  id?: string
  collection?: string
  message: string
}

export interface CharacterMigrationReport {
  from: string
  /** Content ids the content no longer has (kept in the character). */
  unknown: MigrationIssue[]
  /** Homebrew records the character uses (kept; resolved against the Homebrew table at sign-in). */
  homebrew: MigrationIssue[]
  /** Ids and values renamed to their current names. */
  renamed: MigrationIssue[]
  /** Values that could not be carried over. */
  dropped: MigrationIssue[]
  /** Values added or changed to keep what the old sheet showed. */
  notes: MigrationIssue[]
}

/** Record ids renamed since the live data (collection → old → new). */
export const RENAMED_IDS: Record<string, Record<string, string>> = {
  vehicles: { 'destiny-acension': 'destiny-ascension' },
  // An earlier spelling of the turian trait, still picked by saved characters (plan/18, prod sample).
  traits: { 'thilium-skin': 'thulium-skin' },
}

const UUID = /^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i

export function unpackCharacter(data: string | Rec): Rec {
  return typeof data === 'string' ? jsonpack.unpack(data) as Rec : data
}

export interface MigrateCharacterOptions {
  game: Game
  content: RulesContent
  /** Timestamp for items the old migrations create (re-runs pass the same value). */
  now?: string
}

export function migrateCharacter(input: string | Rec, opts: MigrateCharacterOptions): { character: Character, report: CharacterMigrationReport } {
  const raw = unpackCharacter(input)
  const from = raw.meta?.version ?? 'none'
  const old = raw.meta?.version === LEGACY_CURRENT ? structuredClone(raw) : legacyMigrate(raw, opts.now ?? '1970-01-01T00:00:00.000Z')
  const report: CharacterMigrationReport = { from, unknown: [], homebrew: [], renamed: [], dropped: [], notes: [] }
  const ctx = new Context(opts, report)
  const character = toModel(old, ctx)
  const parsed = schemaFor(opts.game).safeParse(character)
  if (!parsed.success) throw new Error(`migrated character does not fit the model: ${parsed.error.issues.slice(0, 5).map(i => `${i.path.join('.')}: ${i.message}`).join('; ')}`)
  return { character, report }
}

class Context {
  constructor(readonly opts: MigrateCharacterOptions, readonly report: CharacterMigrationReport) {}

  /** Current id of a record, renamed if needed; unknown ids are kept and reported. */
  ref(collection: string, id: unknown, at: string, { homebrew = false, optional = false } = {}): string | null {
    if (id === null || id === undefined || id === '') {
      if (!optional) this.report.dropped.push({ at, collection, message: 'empty id' })
      return null
    }
    if (typeof id !== 'string') {
      this.report.dropped.push({ at, collection, message: `not an id: ${JSON.stringify(id)}` })
      return null
    }
    const renamed = RENAMED_IDS[collection]?.[id]
    if (renamed) {
      this.report.renamed.push({ at, id, collection, message: `${id} → ${renamed}` })
      return renamed
    }
    if (this.opts.content.get(collection, id) || (collection === 'gear' && gearRecords(this.opts.content).some(g => g.id === id))) return id
    if (homebrew && UUID.test(id)) this.report.homebrew.push({ at, id, collection, message: 'homebrew record' })
    else this.report.unknown.push({ at, id, collection, message: `no ${collection} record "${id}"` })
    return id
  }

  /** A choice pick: records for model choices, else skill/tool/weapon/ability ids checked against their lists. */
  pick(key: string, value: unknown, at: string): string | null {
    const content = this.opts.content
    // A model choice names a collection, or an edge family (`fighting-styles`).
    const isModel = key in this.opts.game.def.sources || (this.opts.game.enums.values.edgeTypes ?? []).includes(key) || content.list(key).length > 0
    const collection = key === 'expertise' ? 'skills' : key === 'skill' ? 'skills' : key === 'tool' ? 'tool-profs' : isModel ? key : null
    if (key === 'weapon') {
      if (typeof value === 'string' && !this.opts.game.enums.values.weaponTypes?.includes(value)) this.report.unknown.push({ at, id: value, collection: 'weaponTypes', message: `no weapon type "${value}"` })
      return typeof value === 'string' ? value : null
    }
    if (key === 'tool' && typeof value === 'string' && value.startsWith('vehicle-')) return value
    if (key.startsWith('powercasting')) return typeof value === 'string' ? value : null
    if (!collection) {
      if (typeof value !== 'string') {
        this.report.dropped.push({ at, message: `pick ${JSON.stringify(value)} under "${key}"` })
        return null
      }
      this.report.unknown.push({ at, id: value, message: `choice "${key}" names no collection` })
      return value
    }
    return this.ref(collection, value, at)
  }
}

const schemas = new WeakMap<Game, ReturnType<typeof characterSchema>>()
function schemaFor(game: Game) {
  if (!schemas.has(game)) schemas.set(game, characterSchema(game.def.character))
  return schemas.get(game)!
}

const int = (v: unknown, fallback = 0) => {
  const n = typeof v === 'number' ? v : Number.parseInt(String(v), 10)
  return Number.isFinite(n) ? Math.trunc(n) : fallback
}
const intOrNull = (v: unknown) => (v === null || v === undefined || v === '' ? null : int(v, 0) || null)
const strings = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [])

function choiceValues(selection: Rec, key: string, at: string, ctx: Context): ChoiceValue[] {
  const out: ChoiceValue[] = []
  const values = Array.isArray(selection.value) ? selection.value : [selection.value]
  values.forEach((v: unknown, i: number) => {
    const where = `${at}.value[${i}]`
    if (typeof v === 'string') {
      const id = ctx.pick(key, v, where)
      if (id) out.push(id)
      return
    }
    if (!v || typeof v !== 'object') {
      ctx.report.dropped.push({ at: where, message: `pick ${JSON.stringify(v)}` })
      return
    }
    const r = v as Rec
    if (r.type === 'asi' && typeof r.ability === 'string') {
      out.push({ ability: r.ability, amount: int(r.amount, 1) })
      return
    }
    if (r.type === 'advancement') {
      const power = ctx.ref('powers', r.id, `${where}.id`, { homebrew: true })
      const rec = power ? ctx.opts.content.get('powers', power) : undefined
      if (power && typeof r.value === 'string') {
        if (rec && !(rec.advancements ?? []).some((a: Rec) => a.id === r.value)) ctx.report.unknown.push({ at: `${where}.value`, id: r.value, collection: 'advancements', message: `power "${power}" has no advancement "${r.value}"` })
        out.push({ power, advancement: r.value })
      }
      else ctx.report.dropped.push({ at: where, message: `advancement pick ${JSON.stringify(v)}` })
      return
    }
    // The 1.0.2 migration stored a feat pick's value as a list.
    for (const [j, id] of [r.value].flat().entries()) {
      const picked = ctx.pick(key, id, Array.isArray(r.value) ? `${where}.value[${j}]` : `${where}.value`)
      if (picked) out.push(picked)
    }
  })
  return out
}

function equipment(old: Rec[], ctx: Context): Character['equipment'] {
  const out: Character['equipment'] = []
  old.forEach((e, i) => {
    const at = `equipment[${i}]`
    if (!e || typeof e !== 'object') {
      ctx.report.dropped.push({ at, message: `item ${JSON.stringify(e)}` })
      return
    }
    const uuid = typeof e.uuid === 'string' && e.uuid ? e.uuid : `${e.id}_migrated_${i}`
    if (uuid !== e.uuid) ctx.report.notes.push({ at, message: `item had no uuid; given "${uuid}"` })
    if (e.type === 'weapon') {
      const id = ctx.ref('weapons', e.id, `${at}.id`, { homebrew: true }) ?? String(e.id)
      const mods = Object.entries((e.mods ?? {}) as Record<string, unknown>).filter(([, m]) => m).map(([slot, m]) => ({ id: ctx.ref('mods', m, `${at}.mods.${slot}`) ?? String(m), slot }))
      out.push({
        uuid, id, kind: 'weapon', equipped: !!e.equipped,
        ...(mods.length ? { mods } : {}),
        ...(e.overrides && Object.keys(e.overrides).length ? { overrides: e.overrides } : {}),
        ...(e.bonusHit ? { bonusHit: int(e.bonusHit) } : {}),
        ...(e.bonusDamage ? { bonusDamage: int(e.bonusDamage) } : {}),
      })
      return
    }
    if (e.type === 'armor') {
      const mods = strings(e.mods).map((m, j) => ({ id: ctx.ref('mods', m, `${at}.mods[${j}]`) ?? m }))
      if (e.custom) {
        const custom = meLegacy({ ...e.custom }, { collection: 'armor', note: () => undefined })
        out.push({ uuid, id: String(e.id ?? 'custom-armor'), kind: 'armor', equipped: !!e.equipped, ...(mods.length ? { mods } : {}), custom: { ...custom, kind: 'armor', mechanics: custom.mechanics ?? [] } })
        return
      }
      const id = ctx.ref('armor', e.id, `${at}.id`) ?? String(e.id)
      out.push({ uuid, id, kind: 'armor', equipped: !!e.equipped, ...(mods.length ? { mods } : {}) })
      return
    }
    if (e.type === 'gear') {
      const id = ctx.ref('gear', e.id, `${at}.id`) ?? String(e.id)
      out.push({
        uuid, id, kind: 'gear', equipped: !!e.equipped,
        ...(e.uses !== undefined ? { uses: Number(e.uses) || 0 } : {}),
        ...(e.equippedAmount ? { equippedAmount: Number(e.equippedAmount) || 0 } : {}),
        ...(e.notes ? { notes: String(e.notes) } : {}),
      })
      return
    }
    ctx.report.dropped.push({ at, id: e.id, message: `item type "${e.type}"` })
  })
  return out
}

function toModel(old: Rec, ctx: Context): Character {
  const game = ctx.opts.game
  const content = ctx.opts.content
  const settings: Rec = old.settings ?? {}
  const stats: Rec = old.currentStats ?? {}
  const options: Rec = old.options ?? {}
  const scores: Rec = old.abilityScores ?? {}

  // Built-in records (`custom` species, `custom-background`) resolve through the content too.
  const species = ctx.ref('species', old.species, 'species', { optional: true })
  const background = ctx.ref('backgrounds', old.background, 'background', { optional: true })

  const classes: Character['classes'] = (old.classes ?? []).map((k: Rec, i: number) => {
    const id = ctx.ref('classes', k.id, `classes[${i}].id`) ?? String(k.id)
    const subclass = k.subclass ? ctx.ref('subclasses', k.subclass, `classes[${i}].subclass`) : null
    const asi: Record<string, 'asi' | 'feat' | null> = {}
    for (const [level, pick] of Object.entries((k.asi ?? {}) as Record<string, unknown>)) {
      if (pick !== null && pick !== 'asi' && pick !== 'feat') ctx.report.dropped.push({ at: `classes[${i}].asi.${level}`, message: `pick ${JSON.stringify(pick)}` })
      asi[level] = pick === 'asi' || pick === 'feat' ? pick : null
    }
    return { id, levels: Math.min(20, Math.max(1, int(k.levels, 1))), subclass, hitPoints: (k.hitPoints ?? []).map((n: unknown) => Math.max(0, int(n))), rolledHitPoints: !!k.hpOverride, asi }
  })

  const choices: Character['choices'] = []
  ;(old.selected ?? []).forEach((s: Rec, i: number) => {
    const at = `selected[${i}]`
    if (!s || typeof s.path !== 'string') {
      ctx.report.dropped.push({ at, message: `selection ${JSON.stringify(s)}` })
      return
    }
    const path = s.path.replace(/^klass\//, 'class/')
    const key = path.slice(path.lastIndexOf('/') + 1)
    choices.push({ path, ...(s.limit ? { limit: String(s.limit) } : {}), values: choiceValues(s, key, at, ctx) })
  })

  const powers: Character['powers'] = []
  ;(old.powers ?? []).forEach((p: Rec, i: number) => {
    const at = `powers[${i}]`
    const id = ctx.ref('powers', p?.id, `${at}.id`, { homebrew: true })
    if (!id) return
    const record = content.get('powers', id)
    let advancement: string | null = null
    // `false` was "no advancement" too.
    if (p.advancement !== null && p.advancement !== undefined && p.advancement !== false) {
      // Older characters stored the advancement object, or its index.
      const raw = typeof p.advancement === 'object' ? p.advancement.id : typeof p.advancement === 'number' ? record?.advancements?.[p.advancement]?.id : p.advancement
      if (typeof raw === 'string') {
        advancement = raw
        if (record && !(record.advancements ?? []).some((a: Rec) => a.id === raw)) ctx.report.unknown.push({ at: `${at}.advancement`, id: raw, collection: 'advancements', message: `power "${id}" has no advancement "${raw}"` })
        if (typeof p.advancement !== 'string') ctx.report.notes.push({ at: `${at}.advancement`, message: `old advancement format → "${raw}"` })
      }
      else ctx.report.dropped.push({ at: `${at}.advancement`, message: `advancement ${JSON.stringify(p.advancement)}` })
    }
    const klass = typeof p.klass === 'string' ? (ctx.ref('classes', p.klass, `${at}.klass`) ?? p.klass) : null
    if (!klass) ctx.report.notes.push({ at, id, message: 'learned power without a class (kept; it casts with the ability of its power type)' })
    powers.push({ id, class: klass, advancement })
  })

  const items = equipment(old.equipment ?? [], ctx)
  if (int(stats.omnigel) > 0 && !items.some(e => e.id === 'omni-gel')) {
    items.push({ uuid: 'omni-gel_migrated', id: 'omni-gel', kind: 'gear', equipped: false, uses: int(stats.omnigel) })
    ctx.report.notes.push({ at: 'currentStats.omnigel', message: `${int(stats.omnigel)} omni-gel the 1.0.2 migration left in currentStats became an item` })
  }

  // Resources: an array was the 1.0.2 migration's empty value.
  const resources: Record<string, number> = {}
  for (const [k, v] of Object.entries((Array.isArray(stats.resources) ? {} : stats.resources ?? {}) as Record<string, unknown>)) {
    const n = Number(v)
    if (Number.isFinite(n)) resources[k] = n
    else ctx.report.dropped.push({ at: `currentStats.resources.${k}`, message: `value ${JSON.stringify(v)}` })
  }
  if ('m-560-hydra' in resources && items.some(e => e.id === 'm-920-cain') && !items.some(e => e.id === 'm-560-hydra')) {
    resources['m-920-cain'] = resources['m-560-hydra']!
    delete resources['m-560-hydra']
    ctx.report.renamed.push({ at: 'currentStats.resources.m-560-hydra', id: 'm-560-hydra', message: 'the Cain\'s resource is m-920-cain' })
  }
  const toggles: Record<string, boolean | string> = {}
  for (const [k, v] of Object.entries((stats.toggles ?? {}) as Record<string, unknown>)) {
    if (typeof v === 'boolean' || typeof v === 'string') toggles[k] = v
    else ctx.report.dropped.push({ at: `currentStats.toggles.${k}`, message: `value ${JSON.stringify(v)}` })
  }

  // Renamed enum values (B20): sense keys typed on the sheet.
  const senseAliases = game.enums.aliases.senses ?? {}
  const senses: Record<string, number> = {}
  for (const [k, v] of Object.entries((settings.senses ?? {}) as Record<string, unknown>)) {
    const key = senseAliases[k] ?? k
    if (key !== k) ctx.report.renamed.push({ at: `settings.senses.${k}`, id: k, message: `${k} → ${key}` })
    senses[key] = Math.max(senses[key] ?? 0, int(v))
  }
  const speeds: Record<string, number> = {}
  for (const [k, v] of Object.entries((settings.speeds ?? {}) as Record<string, unknown>)) speeds[k] = int(v)

  const pointsPool = game.def.powerSystem.pools.find(p => p.kind === 'points')?.id ?? 'points'
  const slotsUsed: Record<string, number> = {}
  ;(Array.isArray(stats.psUsed) ? stats.psUsed : []).forEach((n: unknown, i: number) => {
    if (int(n)) slotsUsed[i + 1] = int(n)
  })
  const ability = (key: string, field: string) => (field === 'value' ? (scores[key]?.value === null || scores[key]?.value === undefined ? null : int(scores[key].value)) : intOrNull(scores[key]?.[field]))
  const abilityRecord = (field: string) => Object.fromEntries(['str', 'dex', 'con', 'int', 'wis', 'cha'].map(k => [k, ability(k, field)])) as Character['abilityScores']['base']
  const method = ['standard', 'buy', 'manual'].includes(options.asiGenMethod) ? options.asiGenMethod : 'manual'

  const character: Character = {
    version: CHARACTER_VERSION,
    game: game.def.id,
    name: typeof old.name === 'string' ? old.name : '',
    ...(typeof old.image === 'string' && old.image ? { image: old.image } : {}),
    experience: { points: Math.max(0, int(old.experiencePoints?.points)), milestone: Math.max(0, int(old.experiencePoints?.milestone, 1)), useMilestone: !!options.useMilestone },
    species,
    background,
    classes,
    abilityScores: { method, base: abilityRecord('value'), bonus: abilityRecord('other'), override: abilityRecord('override') },
    choices,
    powers,
    equipment: items,
    companions: Array.isArray(old.companions) ? old.companions : [],
    customFeatures: (old.brews ?? []).map((b: Rec, i: number) => ({
      id: String(b.id ?? `brew-${i}`),
      name: String(b.name ?? ''),
      type: String(b.type ?? 'other'),
      ...(b.html ? { html: String(b.html) } : {}),
      ...(b.mechanics?.uses ? { uses: int(b.mechanics.uses) } : {}),
      ...(b.mechanics?.recharge ? { recharge: String(b.mechanics.recharge) } : {}),
    })),
    details: {
      characteristics: Object.fromEntries(Object.entries((old.characteristics ?? {}) as Record<string, unknown>).map(([k, v]) => [k, v === null || v === undefined ? '' : String(v)])),
      notes: typeof old.notes === 'string' ? old.notes : '',
    },
    state: {
      hitPointsLost: int(stats.hitPointsLost),
      tempHp: { max: int(stats.tempHp?.max), value: int(stats.tempHp?.value) },
      hitDiceUsed: Object.fromEntries(Object.entries((stats.hitDiceUsed ?? {}) as Record<string, unknown>).map(([k, v]) => [k, int(v)])),
      deathSaves: { successes: int(stats.deathSaves?.successes), failures: int(stats.deathSaves?.failures) },
      inspiration: !!stats.hasInspiration,
      conditions: strings(stats.conditions),
      exhaustion: int(stats.exhaustion),
      credits: Number(stats.credits) || 0,
      pointsUsed: int(stats.tpUsed) ? { [pointsPool]: int(stats.tpUsed) } : {},
      slotsUsed,
      resources,
      toggles,
      game: {
        paragon: int(stats.paragon),
        renegade: int(stats.renegade),
        indoctrination: int(stats.indoctrination),
        // NaN (no shields typed before 1.0.2) is 0 lost.
        shieldsLost: int(stats.shieldsLost),
        barrier: { used: int(stats.barrier?.used), ticksUsed: int(stats.barrier?.ticksUsed) },
        shoulderMounts: strings(stats.shoulderMounts),
        techArmorMax: int(stats.techArmorMax),
      },
    },
    overrides: {
      hp: intOrNull(settings.hp),
      ac: intOrNull(settings.acOverride),
      acBonus: int(settings.acBonus),
      speeds,
      senses,
      attack: { all: int(settings.attackMod), melee: int(settings.attackMeleeMod), ranged: int(settings.attackRangedMod), power: int(settings.attackSpellMod) },
      damage: { all: int(settings.damageMod), melee: int(settings.damageMeleeMod), ranged: int(settings.damageRangedMod), power: int(settings.damageSpellMod) },
      defenses: { resistance: strings(settings.damageRes), immunity: strings(settings.damageImm), vulnerability: strings(settings.damageVul), conditionImmunity: strings(settings.conditionImm) },
      profs: { skill: strings(settings.skill), expertise: strings(settings.expertise), savingThrow: strings(settings.savingThrow), armor: strings(settings.armor), weapon: strings(settings.weapon), tool: strings(settings.tool) },
      powercasting: Object.fromEntries(Object.entries((settings.powercasting ?? {}) as Record<string, unknown>).filter(([, v]) => typeof v === 'string' && v) as Array<[string, string]>),
      game: { shields: intOrNull(settings.shields), regen: intOrNull(settings.regen), ...(typeof settings.shieldSource === 'string' && settings.shieldSource ? { shieldSource: settings.shieldSource } : {}) },
    },
    options: {
      tashas: !!options.tashas,
      // Options a character never had were off for it on the live site.
      armorSpeedPenalty: !!options.armorSpeedPenalty,
      armorProficiencyPenalty: !!options.armorProficiencyPenalty,
      abilityScoreOnTop: !!options.abilityScoreOnTop,
      game: {
        weaponSlots: !!options.weaponSlots,
        grenadeSlots: !!options.grenadeSlots,
        medigelSlots: !!options.medigelSlots,
        thermalClipSlots: !!options.thermalClipSlots,
        thermalClips: !!options.thermalClips,
        programInstall: !!options.programInstall,
        consumeThermalClips: !!options.consumeThermalClips,
      },
    },
    meta: { migratedFrom: `me5e-legacy ${ctx.report.from}` },
  }
  return character
}
