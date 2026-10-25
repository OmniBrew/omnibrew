/* eslint-disable @typescript-eslint/no-explicit-any -- reads the untyped Vuex getters of the old site */
import type { LegacyStore } from './legacy-store'
import { cardLine, signed, sorted, type ParityCard, type ParitySheet } from './sheet'

/**
 * Reads a ParitySheet off the old store. Most values are Vuex getters; the few
 * the old site computed inside components are transcribed here from them, line
 * for line (named in each comment). Action, attack and power cards go through
 * the old `CsActions` mixin itself, so hit, DC, damage text and `{{ }}`
 * placeholders are exactly what the live cards print.
 */
const ABILITIES = ['str', 'dex', 'con', 'int', 'wis', 'cha']
const SENSES = ['darkvision', 'tremorsense', 'blindsight', 'infrared-vision', 'truesight']

export function legacySheet(store: LegacyStore, mixins: { CsActions: Record<string, any> }): ParitySheet {
  const g = store.getters
  const get = (name: string) => g[`character/${name}`]
  const character = get('character')
  const mechanics: any[] = get('mechanics/mechanics')
  const mcBonus = get('mechanics/mcBonus')
  const breakdown = get('abilities/abilityBreakdown')
  const profBonus: number = get('profBonus')
  const card = cardReader(store, mixins.CsActions)

  // components/cs/MeCsSavingThrows.vue `items`
  const valueLookup = get('selections/valueLookup')
  const saveMechanics = mechanics.filter(i => i.type === 'saving-throw').map(i => (i.valueLookup ? { ...i, value: valueLookup(i.valueLookup) } : i))
  const saves: Record<string, string> = {}
  for (const ability of ABILITIES) {
    const proficient = !!saveMechanics.find(i => i.value?.includes(ability) && !i.effect) || get('profs/profs').savingThrow.includes(ability)
    const bonus = saveMechanics.filter(i => i.value?.includes(ability) && i.effect?.type === 'bonus').reduce((a, c) => a + mcBonus(c.effect.bonus), 0)
    saves[ability] = `${signed(breakdown[ability].mod + (proficient ? profBonus : 0) + bonus)}${proficient ? ' prof' : ''}`
  }

  const skills: Record<string, string> = {}
  for (const [id, s] of Object.entries<any>(get('skills/skills'))) {
    skills[id] = `${signed(s.mod)} passive ${s.passive}${s.expertise ? ' expertise' : s.proficient ? ' prof' : s.halfProf ? ' half' : ''}`
  }

  // components/cs/MeCsApsi.vue `initiativeBonus`, `initiativeAd`, `initiativeDis`
  const initiativeBonus = mechanics.filter(i => i.type === 'initiative' && i.effect.type === 'bonus').reduce((a, c) => a + mcBonus(c.effect.bonus), 0)
  const initiative = [signed(get('abilities/dexMod') + initiativeBonus), mechanics.some(i => i.type === 'initiative' && i.effect?.type === 'advantage') && 'adv', mechanics.some(i => i.type === 'initiative' && i.effect?.type === 'disadvantage') && 'dis'].filter(Boolean).join(' ')

  // components/cs/MeCsSenses.vue `senses`
  const senses: Record<string, number> = {}
  for (const sense of SENSES) {
    const distances = mechanics.filter(i => i.type === 'sense' && i.sense === sense).map(i => i.distance)
    senses[sense] = Math.max(0, character.settings.senses[sense], ...distances)
  }

  const speeds: Record<string, number | null> = {}
  for (const [k, v] of Object.entries<any>(get('speeds'))) speeds[k] = v ? v.distance : null

  const defenses: Record<string, string[]> = {}
  for (const [type, d] of Object.entries<any>(get('defenses/defenses'))) {
    defenses[type] = sorted(d.text.map((t: any) => [t.label || t.id, t.noteIndex !== undefined ? `(${d.notes[t.noteIndex]})` : ''].filter(Boolean).join(' ')))
  }

  const profs: Record<string, string[]> = {}
  for (const [type, list] of Object.entries<string[]>(get('profs/profs'))) profs[type] = sorted(list.map(String))

  const hp = get('hp/hp')
  const shields = get('hp/shields')
  const barrier = get('hp/barrier')
  const tp = get('powers/techPoints')
  const slots = get('powers/powerSlots')
  const pact = get('powers/pactSlots')

  // components/cs/powers/MeCsPowersMods.vue `groupedPowercastingAbilityStats`
  const stats: string[] = []
  const seen = new Set<string>()
  for (const ability of Object.values<string | false>(get('powers/klassPowercastingAbilities'))) {
    if (!ability || seen.has(ability)) continue
    seen.add(ability)
    const base = profBonus + get(`abilities/${ability}Mod`)
    const settingsMod = character.settings.attackSpellMod || 0
    stats.push(`${ability} mod ${signed(get(`abilities/${ability}Mod`))} attack ${signed(base + Number(settingsMod))} dc ${base + 8 + Number(settingsMod)}`)
  }
  const maxes: Record<string, string> = {}
  for (const [k, m] of Object.entries<any>(get('powers/klassPowercastingMaxes'))) {
    maxes[k] = `powers ${m.numPowers} cantrips ${m.numCantrips} max level ${m.maxPowerLevel}${m.learned ? '' : ' prepared'}${m.powercastingType ? ` ${m.powercastingType}` : ''}`
  }

  const powers = (get('powers/powers') as any[]).map((p) => {
    const c = card(p)
    const extra = [`mod ${p.mod}`, `src ${p.source}`, p.alwaysCastable ? 'at will' : '', p.altCasting?.length ? `alt ${p.altCasting.map((a: any) => a.unit).join(',')}` : '', `time ${p.castingTime?.unit}`, c.extra]
    return cardLine(`power ${p.id}@${p.level}${p.upcast ? '^' : ''} `, { ...c, extra: extra.filter(Boolean).join(' ') })
  })

  const weaponAttacks = get('equipment/weaponAttacks')
  const attacks = {} as ParitySheet['attacks']
  for (const key of ['attacks', 'twf', 'dt', 'bf'] as const) attacks[key] = sorted(weaponAttacks[key].map((a: any) => cardLine(`${key} `, card(a))))

  // components/cs/MeCsActions.vue: base actions, the barrier action, mechanic actions and the character's custom actions.
  const actions: string[] = []
  const actionsList: any[] = g.getData('actions')
  for (const type of ['action', 'bonus-action', 'reaction']) {
    for (const i of mechanics.filter(i => i.type === type && i.baseGroup)) actions.push(`base ${type} ${actionsList.find(j => j.name === i.name)?.name ?? i.name}`)
  }
  if (barrier.uses.max > 0) actions.push(cardLine('barrier ', card({ name: 'Barrier', shortDesc: `Gain ${barrier.ticks.max} barrier ticks (to a maximum of ${barrier.ticks.max})`, resource: { displayType: 'barrier', reset: 'short', id: 'barrier' } })))
  for (const a of get('mechanics/mechanicActions') as any[]) actions.push(cardLine(`${a.type}${a.group ? `[${a.group}]` : ''} `, card(a)))

  const resources: string[] = []
  for (const m of mechanics) {
    if (m.type && m.resource && typeof m.resource === 'object') resources.push(resourceLine(m.resource, mcBonus))
    if (m.toggle?.id) resources.push(`toggle ${m.toggle.id}${m.toggle.options ? ` options ${m.toggle.options.map((o: any) => o.id).join(',')}` : ''}`)
  }

  const setBonuses = (get('equipment/activeSetBonuses') as any[]).map(s => `${s.name}: ${s.activeBonuses.map((b: any) => b.threshold).join(',')} of ${s.max}`)
  const reputation = (get('reputation/thresholds') as any[]).map(t => `${t.threshold}: ${t.options.filter((o: any) => o.available).map((o: any) => o.id).join(',')}${t.selected ? ` selected ${t.selected}` : ''}${t.needsAttention ? ' needs attention' : ''}`)
  const caps = get('equipment/capacities')
  const thermal = get('equipment/thermalClips')

  // components/cs/MeCsGlobalNotes.vue `value`
  const globalNotes = mechanics.filter(i => i.type === 'global-note').map((note) => {
    if (note.value !== 'Sneak Attack') return `${note.subType ?? ''}: ${note.value}`
    const infil = get('klasses/selectedKlasses').find((i: any) => i.id === 'infiltrator')
    const numDice = Math.floor((infil.levels + 1) / 2) || 1
    const shadow = infil.subclass === 'shadow' ? ' (d8 w/ melee)' : ''
    const sniper = infil.subclass === 'sniper' && infil.levels >= 17 ? ` (${numDice + 3}d6 w/ sniper rifles)` : ''
    return `${note.subType ?? ''}: Sneak Attack: ${numDice}d6${shadow}${sniper}`
  })

  // components/cs/MeCsActions.vue `extraAttacks`
  const extraMax = Math.max(0, ...mechanics.filter(i => i.type === 'extra-attack').map(i => i.value))
  const extraAttacks = extraMax + mechanics.filter(i => i.type === 'extra-attack-add').length

  return {
    level: get('klasses/level'),
    profBonus,
    abilities: Object.fromEntries(ABILITIES.map(a => [a, `${breakdown[a].total} (${breakdown[a].mod === null ? '-' : signed(breakdown[a].mod)})`])),
    saves,
    skills,
    initiative,
    // A typed AC override was stored as text; the sheet showed it as is.
    ac: Number(get('ac/ac')),
    hp: `${hp.current}/${hp.max} temp ${get('hp/tempHp').value ?? 0}`,
    shields: `${shields.current}/${shields.max} regen ${shields.regen}`,
    barrier: `${barrier.dieCount}d${barrier.dieType} ticks ${barrier.ticks.used}/${barrier.ticks.max} uses ${barrier.uses.used}/${barrier.uses.max}`,
    speeds,
    senses,
    defenses,
    profs,
    powercasting: {
      abilities: get('powers/klassPowercastingAbilities'),
      maxes,
      slots: [1, 2, 3, 4, 5].map(l => slots[l].max),
      points: `${tp.used}/${tp.max} limit ${tp.limit}`,
      pact: `${pact.numSlots} at ${pact.slotLevel}`,
      stats: sorted(stats),
    },
    powers: sorted(powers),
    attacks,
    actions: sorted(actions),
    resources: sorted(resources),
    setBonuses: sorted(setBonuses),
    reputation,
    // components/cs/equipment/weapon/MeCsEquipmentWeaponList.vue `maxSlots` (the store's weaponSlots summed thermal clips)
    capacities: `grenades ${caps.grenadeSlots} medi-gel ${caps.medigelSlots} clips ${caps.thermalClips} weapons ${!character.options.weaponSlots ? 99 : mechanics.filter(i => i.type === 'weapon-slots').reduce((a, c) => a + c.value, 4)} clips equipped ${thermal.equipped}/${thermal.max}`,
    globalNotes: sorted(globalNotes),
    armorPenalties: [get('profs/disadvantageFromHeavierArmor') && 'disadvantage', get('profs/preventPowerCastingFromHeavierArmor') && 'no powercasting', `lacking ${get('profs/equippedArmorLackingProficiency')}`].filter(Boolean).join(' '),
    extraAttacks,
  }
}

/** components/cs/action/MeCsActionResource.vue: defaults merged under the resource, max through mcBonus. */
export function resourceLine(resource: any, mcBonus: (f: unknown) => number) {
  const item = { displayType: 'checkbox', reset: 'long', ...resource, max: { type: 'flat', value: 1, min: 1, ...resource.max } }
  return `resource ${item.id} max ${mcBonus(item.max)} ${item.reset} ${item.displayType}${item.increment && item.increment !== 1 ? ` +${item.increment}` : ''}`
}

/** One card through the old CsActions mixin, as MeCsActionCard / MeCsActionCardsPower render it. */
function cardReader(store: LegacyStore, CsActions: Record<string, any>) {
  const $store = {
    getters: new Proxy({}, { get: (_, n) => store.get(String(n)), has: () => true }),
    _modulesNamespaceMap: { 'character/': { context: {} } },
    dispatch: () => undefined,
    commit: () => undefined,
  }
  const mixins = [...(CsActions.mixins ?? []), CsActions]
  const mcBonus = store.get('character/mechanics/mcBonus')
  return (item: any): ParityCard => {
    const vm: Record<string, any> = { item, $store, $vuetify: { theme: { dark: true } } }
    for (const mixin of mixins) {
      for (const [k, fn] of Object.entries<any>(mixin.methods ?? {})) vm[k] = fn.bind(vm)
      for (const [k, def] of Object.entries<any>(mixin.computed ?? {})) {
        const getter = typeof def === 'function' ? def : def.get
        Object.defineProperty(vm, k, { get: () => getter.call(vm), configurable: true })
      }
      Object.assign(vm, mixin.data?.call(vm) ?? {})
    }
    const range = item.range
      ? [item.range.short ? `${item.range.short}${item.range.long ? `/${item.range.long}` : ''}` : '', item.range.aoe ? `${item.range.aoe.type} ${item.range.aoe.size}` : ''].filter(Boolean).join(' ')
      : undefined
    const notes = (vm.notes as any[]).map(n => n.text ?? n.tooltipText).filter(Boolean)
    return {
      name: item.name ?? '',
      hit: vm.hit ? `${signed(vm.hit.bonus)}${vm.hit.crit < 20 ? ` crit ${vm.hit.crit}` : ''}` : undefined,
      dc: vm.dc ? `${vm.dc.target}${vm.dc.save ? ` ${vm.dc.save}` : ''}` : undefined,
      damage: vm.damages ? vm.damages.map((d: any) => d.text) : undefined,
      text: vm.interpolatedShortDesc || undefined,
      resource: item.resource ? resourceLine(item.resource, mcBonus) : undefined,
      range: range || undefined,
      extra: [item.extra, notes.length ? `notes ${notes.join('; ')}` : ''].filter(Boolean).join(' '),
    }
  }
}
