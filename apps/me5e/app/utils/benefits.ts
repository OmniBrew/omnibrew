/**
 * Reputation benefits (edges of type `benefits`): which side of the
 * Paragon/Renegade scale a benefit needs, its prerequisite as text, and the
 * appendix page's tiers by reputation threshold. Pure functions, tested in
 * test/benefits.test.ts.
 */
export type BenefitSide = 'paragon' | 'balanced' | 'renegade'

interface Reputation {
  min?: number
  /** Balanced: Paragon within this many points of Renegade. */
  within?: number
  greaterThan?: 'paragon' | 'renegade'
}

export interface BenefitPrereq {
  paragon?: Reputation
  renegade?: Reputation
}

export interface BenefitNode {
  name?: string | null
  threshold?: number | null
  prereq?: BenefitPrereq | null
}

/** The vue-i18n `t` calls these helpers make. */
type Translate = (key: string, named?: Record<string, unknown>) => string

const SIDES: BenefitSide[] = ['paragon', 'balanced', 'renegade']

/** Paragon or Renegade when the prerequisite asks for a minimum of it, balanced when it asks them to stay close. */
export function benefitSide(prereq?: BenefitPrereq | null): BenefitSide {
  const rep = prereq?.paragon ?? prereq?.renegade
  if (!rep || rep.within !== undefined) return 'balanced'
  return prereq?.paragon ? 'paragon' : 'renegade'
}

/** "Paragon ≥ 10 and Paragon ≥ Renegade", or "Paragon = Renegade ± 5". */
export function benefitPrereqText(t: Translate, prereq?: BenefitPrereq | null): string {
  const side = benefitSide(prereq)
  const rep = prereq?.paragon ?? prereq?.renegade
  if (!rep) return ''
  if (side === 'balanced') return t('benefits.prereq_within', { within: rep.within })
  const other = side === 'paragon' ? 'renegade' : 'paragon'
  const named = { side: t(`benefits.${side}`), other: t(`benefits.${other}`), min: rep.min ?? 0 }
  return t(rep.greaterThan === other ? 'benefits.prereq_min_over' : 'benefits.prereq_min', named)
}

/** Benefits by threshold, lowest first; in each tier Paragon, balanced, then Renegade, then by name. */
export function benefitTiers<B extends BenefitNode>(benefits: B[]): Array<{ threshold: number, benefits: B[] }> {
  const thresholds = [...new Set(benefits.map(b => b.threshold ?? 0))].sort((a, b) => a - b)
  const order = (b: B) => SIDES.indexOf(benefitSide(b.prereq))
  return thresholds.map(threshold => ({
    threshold,
    benefits: benefits
      .filter(b => (b.threshold ?? 0) === threshold)
      .sort((a, b) => order(a) - order(b) || String(a.name ?? '').localeCompare(String(b.name ?? ''))),
  }))
}
