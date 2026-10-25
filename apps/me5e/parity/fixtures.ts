/* eslint-disable @typescript-eslint/no-explicit-any -- builds characters in the old site's untyped format */
import type { LegacyData, LegacyStore } from './legacy-store'

/**
 * Parity fixtures: characters in the live site's format (cbVersion 1.0.2), built
 * from the live content, with every builder choice filled the way the old
 * builder stores it (`selected` entries, `powers`, `equipment`). No user data:
 * every character is generated from a spec here.
 *
 * Coverage: one character per subclass (levels cycle 1–20), species and
 * backgrounds round-robin (every species, variant and subspecies at least once),
 * every weapon, armor piece and mod equipped somewhere, every set bonus at full
 * set, multiclass mixes, Tasha's option, toggles on, used resources, reputation.
 */

export interface FixtureSpec {
  id: string
  species: string
  classes: Array<{ id: string, levels: number, subclass?: string | null, asi?: 'asi' | 'feat' }>
  background?: string
  scores?: Record<string, number>
  equipment?: Array<{ id: string, type: 'weapon' | 'armor' | 'gear', equipped?: boolean, mods?: string[] }>
  tashas?: boolean
  /** Turn on every toggle the character has (first option of each). */
  togglesOn?: boolean
  paragon?: number
  renegade?: number
  /** Spend some resources (hp, shields, points, slots). */
  used?: boolean
  settings?: Record<string, unknown>
  options?: Record<string, unknown>
}

const ABILITIES = ['str', 'dex', 'con', 'int', 'wis', 'cha'] as const
const STANDARD = [15, 14, 13, 12, 10, 8]
/** Subclass fixture levels: every level a subclass exists at (3+), cycled. Levels 1–2 have their own fixtures. */
const LEVELS = [20, 3, 11, 17, 6, 14, 9, 19, 13, 5, 16, 8, 12, 18, 4, 10, 15, 7]

/** Ability order per class, primary first. */
const PRIORITY: Record<string, string[]> = {
  adept: ['wis', 'con', 'dex', 'cha', 'int', 'str'],
  engineer: ['int', 'con', 'dex', 'wis', 'cha', 'str'],
  experiment: ['con', 'str', 'dex', 'wis', 'int', 'cha'],
  explorer: ['int', 'dex', 'con', 'wis', 'cha', 'str'],
  infiltrator: ['dex', 'int', 'con', 'wis', 'cha', 'str'],
  musician: ['cha', 'dex', 'con', 'wis', 'int', 'str'],
  sentinel: ['wis', 'int', 'con', 'dex', 'cha', 'str'],
  soldier: ['dex', 'con', 'str', 'wis', 'int', 'cha'],
  tracker: ['wis', 'dex', 'con', 'int', 'cha', 'str'],
  vanguard: ['str', 'wis', 'con', 'dex', 'cha', 'int'],
}

export function legacyTemplate(template: Record<string, any>) {
  return structuredClone(template)
}

/** The old builder's add-class step (MeCbClassesAddNew) and level-up HP (MeCbClassCard). */
function classEntry(data: any, levels: number, index: number, subclass: string | null | undefined, asiPick: 'asi' | 'feat' | undefined, seed: number) {
  const hitDie = data.hitDie as number
  const hitPoints = [index === 0 ? hitDie : hitDie / 2 + 1]
  for (let l = 2; l <= levels; l++) hitPoints.push(seed % 3 === 0 ? 1 + ((l * 7 + seed) % hitDie) : Math.ceil((hitDie + 1) / 2))
  const asi: Record<string, string | null> = {}
  for (const lvl of data.progression.abi as number[]) asi[lvl] = lvl <= levels ? (asiPick ?? ((lvl + seed) % 4 === 0 ? 'feat' : 'asi')) : null
  return { id: data.id, hitPoints, subclass: subclass ?? null, hpOverride: seed % 3 === 0, levels, asi }
}

let uuidCounter = 0
const uuid = (id: string) => `${id}_2026-01-01T00:00:${String(uuidCounter++).padStart(6, '0')}Z`

function equipmentEntry(item: { id: string, type: string, equipped?: boolean, mods?: string[] }, data: LegacyData) {
  if (item.type === 'weapon') {
    const weapon = data.get('weapons').find((w: any) => w.id === item.id)
    const mods: Record<string, string | null> = weapon?.type === 'melee' ? { grip: null, strike: null } : { magazine: null, body: null, ammo: null, barrel: null }
    for (const modId of item.mods ?? []) {
      const mod = data.get('mods').find((m: any) => m.id === modId)
      if (mod && mod.placement in mods) mods[mod.placement] = modId
    }
    return { id: item.id, uuid: uuid(item.id), type: 'weapon', mods, overrides: {}, equipped: item.equipped ?? true, bonusDamage: 0, bonusHit: 0 }
  }
  if (item.type === 'armor') return { id: item.id, uuid: uuid(item.id), type: 'armor', mods: item.mods ?? [], equipped: item.equipped ?? true }
  const gear = data.get('gear').find((g: any) => g.id === item.id)
  return { id: item.id, uuid: uuid(item.id), uses: gear?.charges || 1, notes: '', type: 'gear', subType: gear?.type, equipped: item.equipped ?? true, equippedAmount: 0 }
}

export function buildLegacyCharacter(spec: FixtureSpec, template: Record<string, any>, store: LegacyStore, data: LegacyData) {
  const c = legacyTemplate(template)
  c.id = spec.id
  // store/characters.js stamps new characters with the current cbVersion.
  c.meta.version = '1.0.2'
  c.name = `Fixture ${spec.id}`
  c.species = spec.species
  c.background = spec.background ?? null
  c.options.tashas = !!spec.tashas
  Object.assign(c.options, spec.options)
  Object.assign(c.settings, spec.settings)
  const seed = spec.id.length + spec.id.charCodeAt(0)
  const priority = PRIORITY[spec.classes[0]!.id] ?? [...ABILITIES]
  priority.forEach((ab, i) => { c.abilityScores[ab].value = spec.scores?.[ab] ?? STANDARD[i] })
  c.classes = spec.classes.map((k, i) => classEntry(data.get('classes').find((d: any) => d.id === k.id), k.levels, i, k.subclass, k.asi, seed))
  c.equipment = (spec.equipment ?? []).map(e => equipmentEntry(e, data))
  c.currentStats.paragon = spec.paragon ?? 0
  c.currentStats.renegade = spec.renegade ?? 0

  // Fill choices until none is left: a chosen feat or trait can offer its own.
  for (let round = 0; round < 12; round++) {
    store.load(c)
    const pending = pendingChoices(store)
    if (!pending.length) break
    for (const p of pending) {
      const value = choose(p, store, data, priority, c)
      if (value) c.selected.push({ path: p.path, value, ...(p.limit ? { limit: p.limit } : {}) })
      else p.mechanic.__skip = true
    }
  }
  store.load(c)
  c.powers = choosePowers(store, data, c, seed)
  store.load(c)
  if (spec.togglesOn) {
    for (let round = 0; round < 3; round++) {
      for (const m of store.get('character/mechanics/mechanics') as any[]) {
        if (m.toggle?.id && c.currentStats.toggles?.[m.toggle.id] === undefined) {
          c.currentStats.toggles = { ...c.currentStats.toggles, [m.toggle.id]: true }
          if (m.toggle.options?.length > 1) c.currentStats.toggles[`${m.toggle.id}-selection`] = m.toggle.options.at(-1).id
        }
      }
      for (const w of store.get('character/equipment/equippedWeapons') as any[]) {
        if (w.mechanics.some((m: any) => m.type === 'weapon-augment' && m.toggle)) c.currentStats.toggles = { ...c.currentStats.toggles, [w.uuid]: true }
      }
      store.load(c)
    }
  }
  if (spec.used) {
    c.currentStats.hitPointsLost = 7
    c.currentStats.shieldsLost = 3
    c.currentStats.tpUsed = 2
    c.currentStats.psUsed = [1, 1, 0, 0, 0]
    c.currentStats.barrier = { used: 1, ticksUsed: 1 }
    c.currentStats.tempHp = { max: 5, value: 4 }
    const resources: Record<string, number> = {}
    for (const m of store.get('character/mechanics/mechanics') as any[]) if (m.resource?.id) resources[m.resource.id] = 1
    c.currentStats.resources = resources
  }
  store.load(c)
  return c
}

interface Pending { path: string, limit?: string, mechanic: any, source: string }

/** Mirrors INIT_MECHANICS' hydrate(): every `options` mechanic whose path has no selection yet. */
export function pendingChoices(store: LegacyStore): Pending[] {
  const g = store.getters
  const selected = [...g['character/selections/selected']]
  const pending: Pending[] = []
  const hydrate = (mechanics: any[] | undefined, path: string) => {
    for (const m of mechanics ?? []) {
      if (!m.options) continue
      const type = m.type.replace('-choice', '')
      const suffix = type === 'model' ? m.model : type
      const full = `${path}/${suffix}`
      const i = selected.findIndex(s => s.path === full)
      if (i < 0) {
        if (!m.__skip) pending.push({ path: full, mechanic: m, source: path, ...(m.type === 'model-choice' && m.limits ? { limit: JSON.stringify(m.limits) } : {}) })
        continue
      }
      const selection = selected.splice(i, 1)[0]
      if (type !== 'model') continue
      const ids = selection.value.map((v: any) => v.value)
      for (const model of g.getData(suffix).filter((d: any) => ids.includes(d.id))) {
        hydrate(model.mechanics, `${path}/${suffix}/${model.id}`)
        if (suffix === 'species') {
          for (const t of g.getData('traits').filter((t: any) => t.species.includes(model.id))) hydrate(t.mechanics, `${path}/${suffix}/${model.id}/${t.id}`)
        }
      }
    }
  }
  const sources = [
    ...g['character/species/mechanics'], ...g['character/klasses/klassesMechanics'], ...g['character/backgroundMechanics'],
    ...g['character/reputation/benefitsMechanics'], ...g['character/equipment/equipmentMechanics'],
  ]
  for (const s of sources) hydrate(s.mechanics, s.path)
  return pending
}

function pick<T>(items: T[], n: number, offset = 0): T[] {
  if (!items.length) return []
  const out: T[] = []
  for (let i = 0; i < items.length && out.length < n; i++) out.push(items[(i + offset) % items.length]!)
  return out
}

function choose(p: Pending, store: LegacyStore, data: LegacyData, priority: string[], c: any): any[] | null {
  const g = store.getters
  const m = p.mechanic
  const type = m.type.replace('-choice', '')
  const offset = p.path.length
  switch (type) {
    case 'asi': {
      if (/^klass\/[\w-]+\/\d+\/asi$/.test(p.path)) {
        // Alternate a +2 to the primary ability with +1/+1 to the next two.
        return offset % 2 ? [{ type: 'asi', ability: priority[0], amount: 2 }] : [{ type: 'asi', ability: priority[1], amount: 1 }, { type: 'asi', ability: priority[2], amount: 1 }]
      }
      const options: string[] = m.limit ?? priority
      const max = m.max ?? 1
      let total = m.total ?? m.selections ?? 1
      const out: any[] = []
      for (const ability of options) {
        if (total <= 0) break
        const amount = Math.min(max, total)
        out.push({ type: 'asi', ability, amount })
        total -= amount
      }
      return out
    }
    case 'skill':
    case 'expertise': {
      const expertise = type === 'expertise'
      const all: string[] = data.get('skills').map((s: any) => s.id)
      const profs: string[] = g['character/profs/profs'].skill
      let items = all
      if (m.newIf) items = profs.includes(m.newIf) ? all.filter(i => i !== m.newIf) : [m.newIf]
      else if (expertise && (m.limit === 'acquired' || !m.limit)) items = profs
      else if (m.limit) items = all.filter(i => m.limit.includes(i))
      const taken = expertise ? g['character/skills/expertises'] : profs
      const free = items.filter(i => !taken.includes(i))
      const values = pick(free.length ? free : items, m.selections ?? 1, offset)
      return values.map(value => ({ value, type: 'skill', expertise }))
    }
    case 'tool': {
      const items: string[] = []
      for (const prof of data.get('tool-profs')) {
        if (prof.id === 'vehicles') {
          for (const v of ['air', 'land', 'space', 'water']) if (!m.limit || m.limit.includes(`vehicle-${v}`) || m.limit.includes('vehicle')) items.push(`vehicle-${v}`)
        }
        else if (!m.limit || m.limit.includes(prof.id) || m.limit.includes(prof.type)) items.push(prof.id)
      }
      const taken: string[] = g['character/profs/profs'].tool
      return pick(items.filter(i => !taken.includes(i)), m.selections ?? 1, offset).map(value => ({ value, type: 'tool' }))
    }
    case 'weapon': {
      const items = (m.limit as string[] | undefined) ?? ['assault_rifle', 'heavy_pistol', 'melee', 'shotgun', 'smg', 'sniper_rifle']
      const taken: string[] = g['character/profs/profs'].weapon
      return pick(items.filter(i => !taken.includes(i)), m.selections ?? 1, offset).map(value => ({ value, type: 'weapon' }))
    }
    case 'model': {
      let models: any[] = g.getData(m.model)
      if (m.limits) {
        models = models.filter(item => m.limits.every(({ attr, value }: any) => {
          const cmp = value || []
          return Array.isArray(item[attr]) ? item[attr].some((i: any) => cmp.includes(i)) : cmp.includes(item[attr])
        }))
      }
      if (m.model === 'powers' && m.known) {
        const known = (c.powers ?? []).map((i: any) => i.id)
        models = models.filter(i => known.includes(i.id))
      }
      if (m.set) return m.set.map((value: string) => ({ value, type: m.model }))
      const elsewhere = m.isolated ? [] : g['character/selections/selected'].filter((s: any) => s.value[0]?.type === m.model).flatMap((s: any) => s.value.map((v: any) => v.value))
      const free = models.filter(i => !elsewhere.includes(i.id))
      return pick(free, m.selections ?? 1, offset).map(i => ({ value: i.id, type: m.model }))
    }
    case 'powercasting-slots':
    case 'powercasting-points':
    case 'powercasting-pact':
      return Array.isArray(m.mod) ? [m.mod[offset % m.mod.length]] : null
    case 'advancements': {
      let powers: any[] = []
      if (m.limit?.value) powers = data.get('powers').filter((i: any) => m.limit.value.includes(i.id))
      else if (m.limit?.valueLookup) {
        const { model, id } = m.limit.valueLookup
        const ids = g['character/selections/selected']
          .filter((s: any) => s.path.endsWith(`${model}/${id}/powers`) || s.path.endsWith(`${id}/powers`))
          .flatMap((s: any) => s.value).filter((v: any) => v.type === 'powers').map((v: any) => v.value)
        powers = data.get('powers').filter((i: any) => ids.includes(i.id))
      }
      const power = powers.find(i => i.advancements?.length)
      if (!power) return null
      return [{ type: 'advancement', value: power.advancements[offset % power.advancements.length].id, id: power.id }]
    }
    default:
      // prof-choice has no builder component on the live site, so it is never filled.
      return null
  }
}

/** The old powers tab (MeCsKlassPowerSelect): learn up to the class's known counts, some with an advancement. */
function choosePowers(store: LegacyStore, data: LegacyData, c: any, seed: number) {
  const g = store.getters
  const maxes = g['character/powers/klassPowercastingMaxes']
  const mechanics: any[] = g['character/mechanics/mechanics']
  const noAdvancements = mechanics.some(i => i.type === 'prevent-advancements')
  const fromFeatures: string[] = g['character/powers/selectedPowers'].filter((p: any) => p.path).map((p: any) => p.id)
  const powers: any[] = []
  for (const klass of c.classes) {
    const max = maxes[klass.id]
    if (!max) continue
    const available = data.get('powers').filter((p: any) => p.classes?.includes(klass.id) && !fromFeatures.includes(p.id))
    const extraLists = mechanics.filter(i => i.type === 'use-class-for-power-list').map(i => i.klass)
    for (const other of extraLists) available.push(...data.get('powers').filter((p: any) => p.classes?.includes(other) && !available.includes(p)))
    const cantrips = available.filter((p: any) => p.level === 0)
    const leveled = available.filter((p: any) => p.level > 0 && p.level <= max.maxPowerLevel).sort((a: any, b: any) => b.level - a.level)
    for (const p of pick(cantrips, max.numCantrips, seed)) powers.push({ id: p.id, advancement: null, klass: klass.id })
    const chosen = pick(leveled, max.numPowers, seed)
    chosen.forEach((p: any, i: number) => {
      const advancement = !noAdvancements && i % 2 === 0 && p.advancements?.length ? p.advancements[(seed + i) % p.advancements.length].id : null
      powers.push({ id: p.id, advancement, klass: klass.id })
    })
  }
  return powers
}

/**
 * The fixture list. Deterministic: the same live content gives the same specs.
 */
export function fixtureSpecs(data: LegacyData): FixtureSpec[] {
  const specs: FixtureSpec[] = []
  const species: string[] = [...data.get('species').map((s: any) => s.id), 'custom']
  const backgrounds: string[] = data.get('backgrounds').map((b: any) => b.id)
  const weapons: any[] = data.get('weapons')
  const armor: any[] = data.get('armor')
  const mods: any[] = data.get('mods')
  const gear: any[] = data.get('gear').filter((g: any) => g.mechanics?.length && !g.subsets)
  const subclasses: any[] = data.get('subclasses')

  // One per subclass; species, backgrounds, weapons, armor and gear round-robin.
  const weaponMods = mods.filter(m => m.type === 'weapon')
  const armorMods = mods.filter(m => m.type === 'armor')
  const piecesBySlot = (slot: string) => armor.filter(a => a.placement === slot)
  subclasses.forEach((sc, i) => {
    const w1 = weapons[(2 * i) % weapons.length]
    const w2 = weapons[(2 * i + 1) % weapons.length]
    const modsFor = (w: any) => weaponMods.filter(m => m.availability?.includes(w.type)).filter((_, j) => (j + i) % 5 === 0).map(m => m.id)
    const equipment: FixtureSpec['equipment'] = [
      { id: w1.id, type: 'weapon', mods: modsFor(w1) },
      { id: w2.id, type: 'weapon', mods: modsFor(w2) },
    ]
    if (i % 4 === 0) {
      const body = piecesBySlot('body_armor')[i / 4 % piecesBySlot('body_armor').length]
      equipment.push({ id: body.id, type: 'armor' })
    }
    else {
      for (const slot of ['head', 'chest', 'arms', 'legs']) {
        const list = piecesBySlot(slot)
        const piece = list[(i * 3 + slot.length) % list.length]
        const fits = armorMods.filter(m => m.placement === slot && m.availability?.includes(piece.type))
        equipment.push({ id: piece.id, type: 'armor', mods: fits.length ? [fits[i % fits.length].id] : [] })
      }
    }
    equipment.push({ id: gear[i % gear.length].id, type: 'gear' })
    specs.push({
      id: `sub-${sc.id}`,
      species: species[i % species.length]!,
      classes: [{ id: sc.klass, levels: LEVELS[i % LEVELS.length]!, subclass: sc.id }],
      background: backgrounds[i % backgrounds.length],
      equipment,
      tashas: i % 7 === 3,
      togglesOn: i % 2 === 1,
      used: i % 3 === 2,
      paragon: i % 5 === 0 ? 40 : 0,
      renegade: i % 5 === 0 ? 30 : i % 5 === 1 ? 70 : 0,
    })
  })
  // Every class at levels 1 and 2 (before most subclasses).
  for (const klass of data.get('classes')) {
    for (const levels of [1, 2]) {
      const first = klass.progression.subclass[0] as number
      const sc = levels >= first ? subclasses.find(s => s.klass === klass.id)?.id : null
      specs.push({ id: `low-${klass.id}-${levels}`, species: species[(klass.id.length * 3 + levels) % species.length]!, classes: [{ id: klass.id, levels, subclass: sc }], background: backgrounds[(klass.id.length + levels) % backgrounds.length], used: levels === 2 })
    }
  }
  // Remaining species (and every species at level 20 with toggles on once more).
  species.slice(subclasses.length).forEach((s, i) => {
    const sc = subclasses[(i * 7) % subclasses.length]
    specs.push({ id: `species-${s}`, species: s, classes: [{ id: sc.klass, levels: 20, subclass: sc.id }], background: backgrounds[(i + 3) % backgrounds.length], togglesOn: true })
  })
  // Every remaining weapon and mod.
  const leftoverWeapons = weapons.slice(subclasses.length * 2)
  for (let i = 0; i < leftoverWeapons.length; i += 4) {
    const batch = leftoverWeapons.slice(i, i + 4)
    specs.push({
      id: `weapons-${i / 4 + 1}`,
      species: 'human',
      classes: [{ id: 'soldier', levels: 11 + (i % 9), subclass: ['gladiator', 'havoc', 'weapon-master'][i % 3] }],
      equipment: batch.map((w, j) => ({ id: w.id, type: 'weapon' as const, mods: weaponMods.filter(m => m.availability?.includes(w.type)).filter((_, k) => (k + j) % 3 === 0).map(m => m.id) })),
      togglesOn: i % 8 === 0,
    })
  }
  for (let i = 0; i < weaponMods.length; i += 6) {
    const batch = weaponMods.slice(i, i + 6)
    const equipment: NonNullable<FixtureSpec['equipment']> = []
    for (const mod of batch) {
      const w = weapons.find(w => mod.availability?.includes(w.type) && !equipment.some(e => e.id === w.id))
      if (w) equipment.push({ id: w.id, type: 'weapon', mods: [mod.id] })
    }
    specs.push({ id: `weapon-mods-${i / 6 + 1}`, species: 'turian', classes: [{ id: 'infiltrator', levels: 9, subclass: 'sniper' }], equipment, togglesOn: true })
  }
  // Every armor mod, on a matching piece.
  for (let i = 0; i < armorMods.length; i += 4) {
    const batch = armorMods.slice(i, i + 4)
    const equipment: NonNullable<FixtureSpec['equipment']> = []
    for (const mod of batch) {
      const piece = armor.find(a => a.placement === mod.placement && mod.availability?.includes(a.type) && !equipment.some(e => e.id === a.id))
      if (piece && !equipment.some(e => armor.find(a => a.id === e.id)?.placement === piece.placement)) equipment.push({ id: piece.id, type: 'armor', mods: [mod.id] })
    }
    specs.push({ id: `armor-mods-${i / 4 + 1}`, species: 'krogan', classes: [{ id: 'sentinel', levels: 12, subclass: 'juggernaut' }], equipment, togglesOn: true })
  }
  // Every set bonus, at full set.
  for (const set of data.get('set-bonuses')) {
    const pieces = armor.filter(a => a.set === set.id)
    const bySlot = new Map<string, any>()
    for (const p of pieces) if (!bySlot.has(p.placement)) bySlot.set(p.placement, p)
    if (bySlot.has('body_armor') && bySlot.size > 1) bySlot.delete('body_armor')
    specs.push({
      id: `set-${set.id}`,
      species: 'asari',
      classes: [{ id: 'vanguard', levels: 10, subclass: 'nemesis' }],
      equipment: [...bySlot.values()].map(p => ({ id: p.id, type: 'armor' as const })),
      togglesOn: true,
    })
  }
  // Remaining armor and gear.
  const usedArmor = new Set(specs.flatMap(s => s.equipment ?? []).filter(e => e.type === 'armor').map(e => e.id))
  const leftoverArmor = armor.filter(a => !usedArmor.has(a.id))
  for (let i = 0; i < leftoverArmor.length; i += 4) {
    const equipment = new Map<string, any>()
    for (const a of leftoverArmor.slice(i, i + 4)) equipment.set(`${a.placement}-${equipment.size}`, a)
    specs.push({
      id: `armor-${i / 4 + 1}`,
      species: 'salarian',
      classes: [{ id: 'engineer', levels: 7, subclass: 'armorer' }],
      equipment: [...equipment.values()].map((a, j) => ({ id: a.id, type: 'armor' as const, equipped: j === 0 || a.placement !== 'body_armor' })),
    })
  }
  const allGear: any[] = data.get('gear').filter((g: any) => !g.subsets)
  for (let i = 0; i < allGear.length; i += 10) {
    specs.push({
      id: `gear-${i / 10 + 1}`,
      species: 'quarian',
      classes: [{ id: 'engineer', levels: 13, subclass: 'medic' }],
      equipment: allGear.slice(i, i + 10).map(g => ({ id: g.id, type: 'gear' as const })),
      togglesOn: true,
    })
  }
  // Multiclass.
  const multi: Array<[string, Array<[string, number, string]>]> = [
    ['adept-vanguard', [['adept', 6, 'blackstar'], ['vanguard', 5, 'nemesis']]],
    ['engineer-infiltrator', [['engineer', 9, 'medic'], ['infiltrator', 8, 'sniper']]],
    ['sentinel-soldier', [['sentinel', 3, 'bastion'], ['soldier', 11, 'engi-knight']]],
    ['soldier-adept-engineer', [['soldier', 5, 'gladiator'], ['adept', 5, 'fury'], ['engineer', 5, 'drone-jockey']]],
    ['tracker-explorer', [['tracker', 7, 'bloodhound'], ['explorer', 7, 'path-of-war']]],
    ['musician-experiment', [['musician', 10, 'techno'], ['experiment', 4, 'biotic']]],
    ['vanguard-engineer-pact', [['vanguard', 12, 'nemesis'], ['engineer', 8, 'holosmith']]],
    ['infiltrator-sentinel', [['infiltrator', 2, ''], ['sentinel', 18, 'guardian']]],
  ]
  for (const [id, classes] of multi) {
    specs.push({
      id: `multi-${id}`,
      species: species[(id.length * 5) % species.length]!,
      classes: classes.map(([k, levels, sub]) => ({ id: k, levels, subclass: subclasses.some(s => s.id === sub && s.klass === k) ? sub : (levels >= 3 ? subclasses.find(s => s.klass === k)?.id : null) })),
      background: backgrounds[id.length % backgrounds.length],
      togglesOn: id.length % 2 === 0,
      used: true,
    })
  }
  // Settings overrides and options.
  specs.push({
    id: 'settings-overrides',
    species: 'drell',
    classes: [{ id: 'adept', levels: 8, subclass: 'justicar' }],
    settings: {
      acBonus: 2, attackMod: 1, attackMeleeMod: 1, attackRangedMod: 2, attackSpellMod: 1, damageMod: 1, damageMeleeMod: 2, damageRangedMod: 1, damageSpellMod: 2,
      damageRes: ['fire'], damageImm: ['poison'], damageVul: ['cold'], conditionImm: ['charmed'], expertise: ['athletics'], skill: ['athletics'],
      weapon: ['sniper_rifle'], armor: ['heavy'], savingThrow: ['str'], tool: ['chemist'], speeds: { walk: 0, swim: 20, fly: 0, burrow: 0, climb: 0 },
      senses: { darkvision: 30, tremorsense: 0, blindsight: 0, 'infrared-vision': 0, truesight: 0 }, powercasting: { adept: 'cha' },
    },
    equipment: [{ id: 'm-8-avenger', type: 'weapon' }, { id: 'stock-heavy-armor', type: 'armor' }],
  })
  specs.push({
    id: 'settings-hard-overrides',
    species: 'batarian',
    classes: [{ id: 'soldier', levels: 4, subclass: 'legionnaire' }],
    settings: { hp: 99, acOverride: 21, shields: 30, regen: 10 },
    options: { armorSpeedPenalty: false, armorProficiencyPenalty: false, weaponSlots: false },
    equipment: [{ id: 'm-8-avenger', type: 'weapon' }],
  })
  return specs
}
