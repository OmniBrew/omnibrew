import type { Character } from '../character/schema'
import type { Game } from '../schemas/game'
import { choiceMechanics, collectMechanics, type Collected } from './collect'
import type { RulesContent } from './content'
import { CORE_FORMULAS, evaluateFormula } from './formula'
import { HandlerRegistry } from './handlers'
import { computeAbilities, type AbilityScore } from './sections/abilities'
import { computeAc, computeArmorBreakdown, type ArmorBreakdown } from './sections/armor'
import { computeActions, computeCard, type ResolvedCard } from './sections/cards'
import { computeDefenses, computeInitiative, computeSaves, computeSenses, computeSpeeds, type Defenses, type SaveScore } from './sections/defenses'
import { computeEquipment, type EquipmentView } from './sections/equipment'
import { computePowercasting, computePowers, type Powercasting, type PowerCard } from './sections/powers'
import { computeProfs, computeSkills, type Profs, type SkillScore } from './sections/skills'
import { computeSpecies, speciesSources, type SpeciesView } from './sections/species'
import { computeWeaponAttacks, type WeaponAttacks } from './sections/weapons'
import type { Formula, GameRules, Mech, MechanicSource, Rec, SheetCard } from './types'

export interface ClassView {
  id: string
  levels: number
  subclass: string | null
  hitPoints: number[]
  asi: Record<string, 'asi' | 'feat' | null>
  data: Rec
  subclassData?: Rec
  /** Class features the character has, by level. */
  features: Rec[]
}

const PROF_BONUS = [0, 2, 2, 2, 2, 3, 3, 3, 3, 4, 4, 4, 4, 5, 5, 5, 5, 6, 6, 6, 6]

/**
 * A computed character sheet. Every value is computed on first read and kept
 * (the live site's getters, memoized the same way), so sections can read each
 * other in any order: AC reads Dex, a formula reads HP, HP reads Con.
 */
export class Sheet {
  readonly handlers: HandlerRegistry
  private readonly memo = new Map<string, unknown>()

  constructor(readonly character: Character, readonly content: RulesContent, readonly rules: GameRules, readonly game: Game, handlers?: HandlerRegistry) {
    this.handlers = handlers ?? new HandlerRegistry(rules.handlers)
  }

  get enums() {
    return this.game.enums
  }

  get powerSystem() {
    return this.game.def.powerSystem
  }

  protected cached<T>(key: string, fn: () => T): T {
    if (!this.memo.has(key)) this.memo.set(key, fn())
    return this.memo.get(key) as T
  }

  // --- choices and mechanics ---

  choiceKey(m: Mech) {
    return this.handlers.choiceKey(m)
  }

  get species(): SpeciesView | null {
    return this.cached('species', () => computeSpecies(this))
  }

  get background(): Rec | undefined {
    return this.cached('background', () => this.content.get('backgrounds', this.character.background))
  }

  get classes(): ClassView[] {
    return this.cached('classes', () => this.character.classes.map((entry, index) => {
      const data: Rec = { ...this.content.get('classes', entry.id) ?? { id: entry.id, name: entry.id, profs: {}, hitDie: 0 } }
      if (index > 0) data.profs = this.rules.multiclassProfs[entry.id] ?? {}
      const subclassData = entry.subclass ? this.content.get('subclasses', entry.subclass) : undefined
      const features = this.content.list('class-features')
        .filter(f => ((f.klass === entry.id && !f.subclass) || (entry.subclass ? f.subclass === entry.subclass : false)) && f.level <= entry.levels)
        .sort((a, b) => a.level - b.level)
      return { id: entry.id, levels: entry.levels, subclass: entry.subclass, hitPoints: entry.hitPoints, asi: entry.asi, data, subclassData, features }
    }))
  }

  get level(): number {
    return this.cached('level', () => this.character.classes.reduce((a, c) => a + c.levels, 0))
  }

  classLevels(id: string) {
    return this.character.classes.find(c => c.id === id)?.levels ?? 0
  }

  get profBonus(): number {
    return PROF_BONUS[this.level] ?? 0
  }

  get equipment(): EquipmentView {
    return this.cached('equipment', () => computeEquipment(this))
  }

  /** Mechanic sources in the live site's order: species, classes, background, game, equipment. */
  get sources(): MechanicSource[] {
    return this.cached('sources', () => [
      ...speciesSources(this),
      ...this.classSources(),
      ...(this.background ? [{ path: `background/${this.background.id}`, mechanics: this.background.mechanics ?? [] }] : []),
      ...(this.rules.sources?.(this) ?? []),
      ...this.equipment.sources,
    ])
  }

  private classSources(): MechanicSource[] {
    const out: MechanicSource[] = []
    for (const klass of this.classes) {
      const profs: Rec[] = []
      for (const prof of ['skill', 'saving-throw', 'tool', 'weapon', 'armor']) {
        const p = klass.data.profs?.[prof]
        if (!p) continue
        for (const value of p.has ?? []) profs.push({ type: prof, value })
        if (p.choices) profs.push({ type: `${prof}-choice`, limit: p.choices.items, selections: p.choices.count, options: true })
      }
      out.push({ path: `class/${klass.id}`, mechanics: profs })
      for (const [level, pick] of Object.entries(klass.asi)) {
        if (Number(level) > klass.levels) continue
        if (pick === 'asi') out.push({ path: `class/${klass.id}/${level}`, mechanics: [{ type: 'asi-choice', options: true }] })
        if (pick === 'feat') out.push({ path: `class/${klass.id}/${level}`, mechanics: [{ type: 'model-choice', model: 'feats', options: true }] })
      }
      for (const feature of klass.features) out.push({ path: `class/${feature.klass}/${feature.id}`, mechanics: feature.mechanics ?? [] })
    }
    return out
  }

  private get collected(): Collected {
    return this.cached('collected', () => collectMechanics(this, this.sources))
  }

  /** Every mechanic in effect, with choices resolved and augments and toggles applied. */
  get mechanics(): Mech[] {
    return this.collected.mechanics
  }

  /** Choices the character made that no current mechanic asks for. */
  get unusedChoices() {
    return this.collected.unused
  }

  /** Mechanics of the given types. */
  ofType(...types: string[]): Mech[] {
    return this.mechanics.filter(m => types.includes(m.type))
  }

  /** Mechanics whose handler raises a flag (`cantrip-upcast-early`). */
  withFlag(flag: string): Mech[] {
    return this.mechanics.filter(m => this.handlers.flags(m.type).includes(flag))
  }

  hasFlag(flag: string) {
    return this.withFlag(flag).length > 0
  }

  formula = (f: Formula | undefined | null): number => evaluateFormula(f, this, { ...CORE_FORMULAS, ...this.rules.formulas })

  /** Picks stored under paths containing `<model>/<id>` (`valueLookup` in content). */
  valueLookup({ model, id, limit }: { model: string, id: string, limit?: string[] }) {
    const matches = this.character.choices.filter(c => c.path.includes(`${model}/${id}`)).flatMap((c) => {
      const key = c.path.slice(c.path.lastIndexOf('/') + 1)
      return choiceMechanics(key, c, false)
    })
    // With `limit`, picks of those mechanic types; an ability increase reads as its ability.
    if (limit) return matches.filter(m => limit.includes(m.type)).map(m => m.value || m.ability)
    return matches.map(m => m.value)
  }

  // --- sections ---

  get abilities(): Record<string, AbilityScore> {
    return this.cached('abilities', () => computeAbilities(this))
  }

  get profs(): Profs {
    return this.cached('profs', () => computeProfs(this))
  }

  get skills(): Record<string, SkillScore> {
    return this.cached('skills', () => computeSkills(this))
  }

  get saves(): Record<string, SaveScore> {
    return this.cached('saves', () => computeSaves(this))
  }

  get armorBreakdown(): ArmorBreakdown {
    return this.cached('armorBreakdown', () => computeArmorBreakdown(this))
  }

  /** Armor worn without proficiency: pieces lacking it, and the penalties they bring (when the option is on). */
  get armorPenalties(): { lacking: number, disadvantage: boolean, noPowercasting: boolean } {
    return this.cached('armorPenalties', () => {
      const { pieces } = this.armorBreakdown
      const lacking = Object.entries(pieces).filter(([type]) => !this.profs.armor.includes(type)).reduce((a, [, n]) => a + n, 0)
      const on = this.character.options.armorProficiencyPenalty
      const rules = this.rules.armor.proficiencyPenalty
      return { lacking, disadvantage: on && lacking >= rules.disadvantage, noPowercasting: on && lacking >= rules.noPowercasting }
    })
  }

  get ac(): number {
    return this.cached('ac', () => computeAc(this))
  }

  get hp(): { max: number, current: number } {
    return this.cached('hp', () => {
      let max = 0
      if (this.character.overrides.hp) max = this.character.overrides.hp
      else {
        for (const klass of this.character.classes) for (const hp of klass.hitPoints) max += hp
        max += this.level * (this.abilities.con?.mod ?? 0)
        max += this.ofType('hp').reduce((a, m) => a + this.formula(m.bonus), 0)
        max = Math.max(this.level, max)
      }
      return { max, current: Math.max(max - this.character.state.hitPointsLost, 0) }
    })
  }

  get tempHp(): { max: number, value: number } {
    return this.character.state.tempHp
  }

  get speeds() {
    return this.cached('speeds', () => computeSpeeds(this))
  }

  get senses(): Record<string, number> {
    return this.cached('senses', () => computeSenses(this))
  }

  get initiative() {
    return this.cached('initiative', () => computeInitiative(this))
  }

  get defenses(): Defenses {
    return this.cached('defenses', () => computeDefenses(this))
  }

  get powercastingAbilities(): Record<string, string | false> {
    return this.powercasting.abilities
  }

  get powercasting(): Powercasting {
    return this.cached('powercasting', () => computePowercasting(this))
  }

  get powers(): PowerCard[] {
    return this.cached('powers', () => computePowers(this))
  }

  get weaponAttacks(): WeaponAttacks {
    return this.cached('weaponAttacks', () => computeWeaponAttacks(this))
  }

  /** Card mechanics (actions, bonus actions, reactions, other, attacks) with attack augments applied. */
  get actions(): SheetCard[] {
    return this.cached('actions', () => computeActions(this))
  }

  /** Extra attacks with the Attack action. */
  get extraAttacks(): number {
    const max = Math.max(0, ...this.ofType('extra-attack').map(m => Number(m.value)))
    return max + this.ofType('extra-attack-add').length
  }

  get globalNotes(): Array<{ subType?: string, text: string, mechanic: Mech }> {
    return this.cached('globalNotes', () => this.ofType('global-note').map(m => ({ subType: m.subType, text: this.rules.noteText?.(m, this) ?? m.value, mechanic: m })))
  }

  /** A game section (`shields`, `reputation`...). */
  section<T = unknown>(id: string): T {
    return this.cached(`section:${id}`, () => {
      const fn = this.rules.sections?.[id]
      if (!fn) throw new Error(`no sheet section "${id}"`)
      return fn(this) as T
    })
  }

  /** Hit, DC, damage text and placeholders of one card, as the sheet prints it. */
  card(card: SheetCard): ResolvedCard {
    return computeCard(this, card)
  }
}
