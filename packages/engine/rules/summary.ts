import { vitalPools } from './actions'
import type { Sheet } from './sheet'
import type { SheetCard } from './types'

/**
 * A sheet as lines of text, for the homebrew preview's "What changes" (plan/26 §1.3): the
 * sample character's sheet with and without the record, compared line by line. Keys are
 * stable (`ac`, `save.dex`, `attack.<name>`); the page turns them into labels.
 */
export interface SummaryLine {
  key: string
  value: string
}

const signed = (n: number) => (n >= 0 ? `+${n}` : String(n))

function cardText(sheet: Sheet, card: SheetCard): string {
  const r = sheet.card(card)
  return [
    r.hit ? signed(r.hit.bonus) : null,
    r.dc ? `DC ${r.dc.target}${r.dc.save ? ` ${r.dc.save}` : ''}` : null,
    ...(r.damages ?? []).map(d => d.text),
    r.range ? `${r.range.short}${r.range.long ? `/${r.range.long}` : ''}` : null,
  ].filter(Boolean).join(' · ')
}

export function sheetSummary(sheet: Sheet): SummaryLine[] {
  const out: SummaryLine[] = []
  const add = (key: string, value: unknown) => {
    if (value === undefined || value === null || value === '') return
    out.push({ key, value: String(value) })
  }
  add('ac', sheet.ac)
  add('hp', sheet.hp.max)
  for (const p of vitalPools(sheet)) add(`pool.${p.id}`, p.max)
  const init = sheet.initiative
  add('initiative', `${signed(init.bonus)}${init.advantage ? ' adv' : ''}${init.disadvantage ? ' dis' : ''}`)
  for (const [k, a] of Object.entries(sheet.abilities)) add(`ability.${k}`, a.total)
  for (const [k, s] of Object.entries(sheet.saves)) add(`save.${k}`, `${signed(s.mod)}${s.proficient ? ' ●' : ''}`)
  for (const [k, s] of Object.entries(sheet.skills)) add(`skill.${k}`, `${signed(s.mod)}${s.proficient ? ' ●' : ''}${s.expertise ? '●' : ''}${s.notes.length ? ` (${s.notes.map(n => n.effect?.type ?? n.type).join(', ')})` : ''}`)
  for (const [k, v] of Object.entries(sheet.speeds)) if (v) add(`speed.${k}`, v.distance)
  for (const [k, v] of Object.entries(sheet.senses)) if (v > 0) add(`sense.${k}`, v)
  for (const [k, list] of Object.entries(sheet.defenses)) if (list.length) add(`defense.${k}`, list.map(d => d.id).sort().join(', '))
  for (const d of sheet.specialDefenses) add(`special.${d.id}`, '✓')
  for (const card of sheet.weaponAttacks.attacks) add(`attack.${card.name}`, cardText(sheet, card))
  const seen = new Set<string>()
  for (const p of sheet.powers) {
    const key = `power.${p.name}`
    if (seen.has(key)) continue
    seen.add(key)
    add(key, cardText(sheet, p as unknown as SheetCard))
  }
  for (const card of sheet.actions) add(`card.${card.type}.${card.name}`, cardText(sheet, card) || '✓')
  return out
}
