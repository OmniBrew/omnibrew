import type { Rec, Sheet, SheetCard } from '@omnibrew/engine/rules'
import type { Barrier } from '../game/rules'
import { cardLine, signed, sorted, type ParityCard, type ParitySheet } from './sheet'

/** Reads a ParitySheet off the new engine, in the same format as `legacy-sheet.ts`. */
export function engineSheet(sheet: Sheet): ParitySheet {
  const card = (item: SheetCard): ParityCard => {
    const c = sheet.card(item)
    const range = item.range
      ? [item.range.short ? `${item.range.short}${item.range.long ? `/${item.range.long}` : ''}` : '', item.range.aoe ? `${item.range.aoe.type} ${item.range.aoe.size}` : ''].filter(Boolean).join(' ')
      : undefined
    const notes = c.notes.map(n => n.text ?? (n as Rec).tooltipText).filter(Boolean)
    return {
      name: item.name ?? '',
      hit: c.hit ? `${signed(c.hit.bonus)}${c.hit.crit < 20 ? ` crit ${c.hit.crit}` : ''}` : undefined,
      dc: c.dc ? `${c.dc.target}${c.dc.save ? ` ${c.dc.save}` : ''}` : undefined,
      damage: c.damages?.map(d => d.text),
      text: c.shortDesc || undefined,
      resource: item.resource ? resourceLine(sheet, item.resource) : undefined,
      range: range || undefined,
      extra: notes.length ? `notes ${notes.join('; ')}` : '',
    }
  }

  const saves: Record<string, string> = {}
  for (const [a, s] of Object.entries(sheet.saves)) saves[a] = `${signed(s.mod)}${s.proficient ? ' prof' : ''}`
  const skills: Record<string, string> = {}
  for (const [id, s] of Object.entries(sheet.skills)) skills[id] = `${signed(s.mod)} passive ${s.passive}${s.expertise ? ' expertise' : s.proficient ? ' prof' : s.halfProf ? ' half' : ''}`
  const init = sheet.initiative
  const speeds: Record<string, number | null> = {}
  for (const [k, v] of Object.entries(sheet.speeds)) speeds[k] = v ? v.distance : null
  const defenses: Record<string, string[]> = {}
  for (const [type, list] of Object.entries(sheet.defenses)) defenses[type] = sorted(list.map(d => [d.label || d.id, d.note ? `(${d.note})` : ''].filter(Boolean).join(' ')))
  const profs: Record<string, string[]> = {}
  for (const [type, list] of Object.entries(sheet.profs)) profs[type] = sorted(list.map(String))

  const pc = sheet.powercasting
  const stats: string[] = []
  const seen = new Set<string>()
  for (const ability of Object.values(pc.abilities)) {
    if (!ability || seen.has(ability)) continue
    seen.add(ability)
    const base = sheet.profBonus + (sheet.abilities[ability]?.mod ?? 0)
    stats.push(`${ability} mod ${signed(sheet.abilities[ability]?.mod ?? 0)} attack ${signed(base + sheet.character.overrides.attack.power)} dc ${base + 8 + sheet.character.overrides.attack.power}`)
  }
  const maxes: Record<string, string> = {}
  for (const [k, m] of Object.entries(pc.byClass)) maxes[k] = `powers ${m.numPowers} cantrips ${m.numCantrips} max level ${m.maxPowerLevel}${m.learned ? '' : ' prepared'}${m.powercastingType ? ` ${m.powercastingType}` : ''}`
  const points = Object.values(pc.points)[0] ?? { max: 0, used: 0, limit: 0 }

  const powers = sheet.powers.map((p) => {
    const c = card(p)
    const extra = [`mod ${p.mod}`, `src ${p.source}`, p.alwaysCastable ? 'at will' : '', p.altCasting?.length ? `alt ${p.altCasting.map((a: Rec) => a.unit).join(',')}` : '', `time ${p.castingTime?.unit}`, c.extra]
    return cardLine(`power ${p.id}@${p.level}${p.upcast ? '^' : ''} `, { ...c, extra: extra.filter(Boolean).join(' ') })
  })

  const wa = sheet.weaponAttacks
  const attacks = {} as ParitySheet['attacks']
  for (const key of ['attacks', 'twf', 'dt', 'bf'] as const) attacks[key] = sorted((wa[key] ?? []).map(a => cardLine(`${key} `, card(a))))

  const actions: string[] = []
  for (const type of ['action', 'bonus-action', 'reaction']) {
    for (const m of sheet.mechanics.filter(i => i.type === type && i.baseGroup)) actions.push(`base ${type} ${sheet.content.list('actions').find(a => a.name === m.name)?.name ?? m.name}`)
  }
  for (const a of sheet.rules.actions?.(sheet) ?? []) actions.push(cardLine('barrier ', card(a)))
  for (const a of sheet.actions) actions.push(cardLine(`${a.type}${a.group ? `[${a.group}]` : ''} `, card(a)))

  const resources: string[] = []
  for (const m of sheet.mechanics) {
    if (m.type && m.resource && typeof m.resource === 'object') resources.push(resourceLine(sheet, m.resource))
    if (m.toggle?.id) resources.push(`toggle ${m.toggle.id}${m.toggle.options ? ` options ${m.toggle.options.map((o: Rec) => o.id).join(',')}` : ''}`)
  }

  const shields = sheet.section<{ max: number, current: number, regen: number }>('shields')
  const barrier = sheet.section<Barrier>('barrier')
  const caps = sheet.section<{ grenades: number, mediGel: number, thermalClips: number, weaponSlots: number }>('capacities')
  const clips = sheet.section<{ max: number, equipped: number }>('thermalClips')
  const reputation = sheet.section<Array<{ threshold: number, options: Array<{ id: string, available: boolean }>, selected: string | null, needsAttention: boolean }>>('reputation')
  const penalties = sheet.armorPenalties

  return {
    level: sheet.level,
    profBonus: sheet.profBonus,
    abilities: Object.fromEntries(Object.entries(sheet.abilities).map(([a, s]) => [a, `${s.total} (${s.mod === null ? '-' : signed(s.mod)})`])),
    saves,
    skills,
    initiative: [signed(init.bonus), init.advantage && 'adv', init.disadvantage && 'dis'].filter(Boolean).join(' '),
    ac: sheet.ac,
    hp: `${sheet.hp.current}/${sheet.hp.max} temp ${sheet.tempHp.value ?? 0}`,
    shields: `${shields.current}/${shields.max} regen ${shields.regen}`,
    barrier: `${barrier.dieCount}d${barrier.dieType} ticks ${barrier.ticks.used}/${barrier.ticks.max} uses ${barrier.uses.used}/${barrier.uses.max}`,
    speeds,
    senses: sheet.senses,
    defenses,
    profs,
    powercasting: {
      abilities: pc.abilities,
      maxes,
      slots: [1, 2, 3, 4, 5].map(l => pc.slots[l]?.max ?? 0),
      points: `${points.used}/${points.max} limit ${points.limit}`,
      pact: `${pc.pact.numSlots} at ${pc.pact.slotLevel}`,
      stats: sorted(stats),
    },
    powers: sorted(powers),
    attacks,
    actions: sorted(actions),
    resources: sorted(resources),
    setBonuses: sorted(sheet.equipment.setBonuses.map(s => `${s.id}: ${s.bonuses.map(b => b.threshold).join(',')} of ${s.max}`)),
    reputation: reputation.map(t => `${t.threshold}: ${t.options.filter(o => o.available).map(o => o.id).join(',')}${t.selected ? ` selected ${t.selected}` : ''}${t.needsAttention ? ' needs attention' : ''}`),
    capacities: `grenades ${caps.grenades} medi-gel ${caps.mediGel} clips ${caps.thermalClips} weapons ${caps.weaponSlots} clips equipped ${clips.equipped}/${clips.max}`,
    globalNotes: sorted(sheet.globalNotes.map(n => `${n.subType ?? ''}: ${n.text}`)),
    armorPenalties: [penalties.disadvantage && 'disadvantage', penalties.noPowercasting && 'no powercasting', `lacking ${penalties.lacking}`].filter(Boolean).join(' '),
    extraAttacks: sheet.extraAttacks,
  }
}

/** A resource as the sheet tracks it: defaults under it, max through the formula. */
export function resourceLine(sheet: Sheet, resource: Rec) {
  const item: Rec = { displayType: 'checkbox', reset: 'long', ...resource, max: { type: 'flat', value: 1, min: 1, ...resource.max } }
  return `resource ${item.id} max ${sheet.formula(item.max)} ${item.reset} ${item.displayType}${item.increment && item.increment !== 1 ? ` +${item.increment}` : ''}`
}
