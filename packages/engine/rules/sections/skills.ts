import type { Sheet } from '../sheet'
import type { Mech } from '../types'

export interface Profs {
  skill: string[]
  weapon: string[]
  armor: string[]
  tool: string[]
  savingThrow: string[]
}

export interface SkillScore {
  id: string
  name: string
  proficient: boolean
  expertise: boolean
  halfProf: boolean
  mod: number
  passive: number
  /** Advantage, disadvantage and die-bonus effects on the skill. */
  notes: Mech[]
}

/**
 * Proficiencies from mechanics plus the ones typed on the sheet. Saving throw
 * proficiencies here are only the typed ones: class and feature saves are
 * `saving-throw` mechanics, read by the saves section (as on the live site).
 */
export function computeProfs(sheet: Sheet): Profs {
  const typed = sheet.character.overrides.profs
  const of = (type: string, extra: string[]) => [...new Set([...sheet.ofType(type).map(m => m.value), ...extra])]
  return {
    skill: of('skill', typed.skill),
    weapon: of('weapon', typed.weapon),
    armor: of('armor', typed.armor),
    tool: of('tool', typed.tool),
    savingThrow: of('savingThrow', typed.savingThrow),
  }
}

export function expertises(sheet: Sheet): string[] {
  return [...sheet.ofType('skill').filter(m => m.expertise).map(m => m.value), ...sheet.character.overrides.profs.expertise]
}

/** Resolves `valueLookup` (picks made elsewhere) into `value`. */
export const withLookup = (sheet: Sheet, m: Mech): Mech => (m.valueLookup ? { ...m, value: sheet.valueLookup(m.valueLookup) } : m)

export function computeSkills(sheet: Sheet): Record<string, SkillScore> {
  const profs = sheet.profs.skill
  const expert = expertises(sheet)
  const orExpertise = sheet.ofType('skill-or-expertise')
  const half = sheet.ofType('half-proficiency')
  const checks = sheet.ofType('skill-check').map(m => withLookup(sheet, m))
  const pb = sheet.profBonus
  const out: Record<string, SkillScore> = {}
  for (const skill of sheet.content.list('skills')) {
    const proficient = profs.includes(skill.id) || orExpertise.some(m => m.value.includes(skill.id))
    const expertise = expert.includes(skill.id) || (orExpertise.some(m => m.value.includes(skill.id)) && profs.includes(skill.id))
    const halfProf = expertise || proficient ? false : half.some(m => (m.limit ? m.limit.includes(skill.id) : true))
    const profPart = expertise ? pb * 2 : proficient ? pb : halfProf ? Math.floor(pb / 2) : 0
    const base = (sheet.abilities[skill.link]?.mod ?? 0) + profPart
    const mechanics = checks.filter(m => m.value?.includes(skill.id) || (m.value === 'proficient' && proficient))
    const bonus = mechanics.filter(m => m.effect?.type === 'bonus').reduce((a, m) => a + sheet.formula(m.effect.bonus), 0)
    const mod = base + bonus
    const passive = sheet.ofType('passive').filter(m => m.value.includes(skill.id)).reduce((a, m) => a + sheet.formula(m.bonus), 0)
    out[skill.id] = { id: skill.id, name: skill.name, proficient, expertise, halfProf, mod, passive: 10 + mod + passive, notes: mechanics.filter(m => m.effect?.type !== 'bonus') }
  }
  return out
}
