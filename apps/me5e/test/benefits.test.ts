import { describe, expect, it } from 'vitest'
import { benefitPrereqText, benefitSide, benefitTiers } from '../app/utils/benefits'

const messages: Record<string, string> = {
  'benefits.paragon': 'Paragon',
  'benefits.renegade': 'Renegade',
  'benefits.prereq_min': '{side} ≥ {min}',
  'benefits.prereq_min_over': '{side} ≥ {min} and {side} ≥ {other}',
  'benefits.prereq_within': 'Paragon = (Renegade ± {within})',
}
const t = (key: string, named: Record<string, unknown> = {}) => (messages[key] ?? key).replace(/\{(\w+)\}/g, (_, k: string) => String(named[k]))

const convince = { name: 'Convince', threshold: 15, prereq: { paragon: { min: 10, greaterThan: 'renegade' as const } } }
const obfuscate = { name: 'Obfuscate', threshold: 15, prereq: { paragon: { within: 5 } } }
const presence = { name: 'Presence', threshold: 15, prereq: { renegade: { min: 10, greaterThan: 'paragon' as const } } }
const fear = { name: 'Fear', threshold: 30, prereq: { renegade: { min: 20, greaterThan: 'paragon' as const } } }
const beguile = { name: 'Beguile', threshold: 30, prereq: { paragon: { within: 10 } } }

describe('reputation benefits', () => {
  it('knows the side a benefit needs', () => {
    expect([convince, obfuscate, presence].map(b => benefitSide(b.prereq))).toEqual(['paragon', 'balanced', 'renegade'])
    expect(benefitSide(undefined)).toBe('balanced')
  })

  it('writes the prerequisite as the live site did', () => {
    expect(benefitPrereqText(t, convince.prereq)).toBe('Paragon ≥ 10 and Paragon ≥ Renegade')
    expect(benefitPrereqText(t, presence.prereq)).toBe('Renegade ≥ 10 and Renegade ≥ Paragon')
    expect(benefitPrereqText(t, obfuscate.prereq)).toBe('Paragon = (Renegade ± 5)')
    expect(benefitPrereqText(t, { paragon: { min: 40 } })).toBe('Paragon ≥ 40')
    expect(benefitPrereqText(t, null)).toBe('')
  })

  it('groups benefits by threshold: Paragon, balanced, Renegade', () => {
    const tiers = benefitTiers([fear, presence, beguile, obfuscate, convince])
    expect(tiers.map(tier => [tier.threshold, tier.benefits.map(b => b.name)])).toEqual([
      [15, ['Convince', 'Obfuscate', 'Presence']],
      [30, ['Beguile', 'Fear']],
    ])
  })
})
