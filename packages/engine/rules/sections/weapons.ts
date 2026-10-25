import type { Sheet } from '../sheet'
import type { AttackAugments, Mech, Rec, SheetCard, WeaponContext } from '../types'
import { dieIncrease, emptyAugments, extraDamage } from './cards'
import { adjustProperties } from './equipment'
import { dieSteps } from './powers'

export interface WeaponAttacks {
  /** One card per equipped weapon, natural weapon and built-in strike. */
  attacks: SheetCard[]
  /** Off-hand attacks (two-weapon fighting). */
  twf: SheetCard[]
  /** Special attacks a game defines (ME `bf` burst fire, `dt` double tap), by group. */
  [group: string]: SheetCard[]
}

export type WeaponAugments = Record<string, AttackAugments>

/**
 * Attack augments for one weapon attack: the base ones, and one set per
 * special attack (`attackLimit.special`) the weapon can make.
 */
function weaponAugments(sheet: Sheet, q: { attackType: string, weaponType: string, abilityMod: string }, special: Record<string, boolean>, extra: Mech[]): WeaponAugments {
  const base = emptyAugments()
  const out: WeaponAugments = { base }
  for (const key of Object.keys(special)) out[key] = { ...base, addDamage: [] }
  const all = [...sheet.ofType('attack-augment'), ...extra.filter(m => m.type === 'attack-augment')]
  for (const m of all) {
    if (m.attackLimit?.type && m.attackLimit.type !== q.attackType) continue
    if (m.attackLimit?.model && m.attackLimit.model !== 'weapon') continue
    if (m.attackLimit?.modelTypes && !m.attackLimit.modelTypes.includes(q.weaponType)) continue
    const bonus = m.abilityMod ? sheet.formula({ type: 'mod', value: q.abilityMod }) : sheet.formula(m.bonus)
    const reroll = m.rerollIfLessThan || 0
    const increase = m.dieIncrease || 0
    let key = 'base'
    if (m.attackLimit?.special) {
      if (!special[m.attackLimit.special]) continue
      key = m.attackLimit.special
    }
    const a = out[key]!
    for (const at of m.augmentTypes as string[]) {
      if (at === 'notes') {
        a.notes.push(...m.notes ?? [])
        continue
      }
      if (at === 'damage' && (reroll || increase)) {
        a.reroll = Math.max(reroll, a.reroll)
        a.dieIncrease += increase
      }
      if (at === 'damage') {
        a.addCritDie += m.addCritDie || 0
        a.addDamage.push(...m.addDamage ?? [])
      }
      if (at === 'hit') a.crit = Math.min(m.crit || 20, a.crit)
      if (typeof (a as unknown as Record<string, unknown>)[at] === 'number') (a as unknown as Record<string, number>)[at]! += bonus
    }
  }
  return out
}

/** Natural weapons: the built-in unarmed strike, improved by `replacesUnarmedStrike` ones, plus the others. */
export function naturalWeapons(sheet: Sheet): Rec[] {
  const natural = sheet.ofType('natural-weapon')
  const unarmed: Rec = structuredClone(sheet.rules.weapons.unarmed)
  for (const n of natural.filter(m => m.replacesUnarmedStrike)) {
    const v = n.value
    if (v.name) unarmed.name = v.name
    if (v.damage?.dieCount) unarmed.damage.dieCount = Math.max(unarmed.damage.dieCount, v.damage.dieCount)
    if (v.damage?.dieType) unarmed.damage.dieType = Math.max(unarmed.damage.dieType, v.damage.dieType)
    if (unarmed.damage.type === 'bludgeoning' && v.damage && v.damage.type !== 'bludgeoning') unarmed.damage.type = v.damage.type
    if (v.range) unarmed.range = v.range.short !== undefined ? { ...unarmed.range, short: Math.max(unarmed.range.short ?? 0, v.range.short) } : unarmed.range
    if (v.notes?.length) unarmed.notes = [...unarmed.notes, ...v.notes]
    if (v.properties?.length) unarmed.properties = [...unarmed.properties, ...v.properties]
    if (v.moreInfo) unarmed.moreInfo = v.moreInfo
    if (v.damageModOverride) unarmed.damageModOverride = v.damageModOverride
  }
  return [unarmed, ...natural.filter(m => !m.replacesUnarmedStrike).map(m => m.value)]
}

const ids = (props: unknown): string[] => (Array.isArray(props) ? props.map(p => (typeof p === 'string' ? p : (p as Rec).id)) : [])

export function computeWeaponAttacks(sheet: Sheet): WeaponAttacks {
  const rules = sheet.rules.weapons
  const out: WeaponAttacks = { attacks: [], twf: [] }
  for (const key of Object.keys(rules.special ?? {})) out[key] = []
  const overrides = sheet.character.overrides
  const globalHit = (type: string) => overrides.attack.all + (type === 'melee' ? overrides.attack.melee : overrides.attack.ranged)
  const globalDamage = (type: string) => overrides.damage.all + (type === 'melee' ? overrides.damage.melee : overrides.damage.ranged)
  const weaponProfs = sheet.profs.weapon
  const equipped = sheet.equipment.equippedWeapons
  // The record's own properties decide two-weapon fighting (as the live sheet did), not mod-adjusted ones.
  const twfEligible = equipped.filter(w => ids(w.data.properties).includes('light') && !ids(w.data.properties).includes('two-handed')).length > 1
  const propertyRecords = sheet.content.list('weapon-properties')

  const toProcess: WeaponContext[] = [
    ...equipped.map((w) => {
      // Features adjust properties of their weapon types along with the weapon's mods.
      const fromFeatures = sheet.ofType('adjust-weapon-props').filter(m => m.limit?.includes(w.data.weaponType))
      return { entry: w.entry as unknown as Rec, data: { ...w.data, propertyValues: w.propertyValues }, properties: adjustProperties(w.baseProperties, [...w.adjust, ...fromFeatures]), mechanics: w.mechanics }
    }),
    ...naturalWeapons(sheet).map(data => ({ entry: { bonusHit: 0, bonusDamage: 0 }, data, properties: ids(data.properties), mechanics: [] })),
    ...(rules.extraAttacks?.(sheet) ?? []).map(data => ({ entry: { bonusHit: 0, bonusDamage: 0 }, data, properties: ids(data.properties), mechanics: [] })),
  ]
  for (const weapon of toProcess) {
    const { data, properties } = weapon
    const type: string = data.weaponType ?? data.type
    const light = properties.includes('light')
    const twoHanded = properties.includes('two-handed')
    const finesse = properties.some(p => rules.finesse.includes(p))
    const versatileDamage = data.propertyValues?.versatile ?? data.versatile
    const versatile = properties.includes('versatile')
    const dexOrStr = (sheet.abilities.dex?.mod ?? 0) > (sheet.abilities.str?.mod ?? 0) ? 'dex' : 'str'
    const melee = rules.meleeTypes.includes(type)
    const attackType = melee ? 'melee' : 'ranged'
    const weaponType = melee ? 'melee' : type
    const standardMod = finesse ? dexOrStr : weaponType === 'melee' ? 'str' : 'dex'

    let abilityMod = standardMod
    const overridesMod = sheet.ofType('override-weapon-attack-mod')
    if (overridesMod.length) {
      let best = sheet.abilities[standardMod]?.mod ?? 0
      for (const m of overridesMod) {
        if (m.limit && m.limit !== attackType) continue
        const ability = m.mod === 'pc' ? sheet.powercastingAbilities[m.klass] : m.mod
        if (!ability) continue
        const score = sheet.abilities[ability]?.mod ?? 0
        if (score > best) {
          abilityMod = ability
          best = score
        }
      }
    }
    abilityMod = rules.ability?.(weapon, sheet) ?? abilityMod

    const special: Record<string, boolean> = { twf: twfEligible }
    for (const [key, s] of Object.entries(rules.special ?? {})) special[key] = properties.includes(s.property)
    const augments = weaponAugments(sheet, { attackType, weaponType, abilityMod }, special, weapon.mechanics)
    const a = augments.base!
    const mode = rules.mode?.(weapon, sheet)

    const attack = mode?.dc
      ? false
      : {
          proficient: (rules.alwaysProficient ?? []).includes(type) || weaponProfs.includes(weaponType),
          mod: abilityMod,
          bonus: { type: 'flat', value: (weapon.entry.bonusHit || 0) + globalHit(attackType) + a.hit + (mode?.hitBonus || 0) },
          crit: a.crit || 20,
        }
    const damageMod = data.damageModOverride === 'noMod' ? false : data.damageModOverride || abilityMod
    const { dieType, overflow } = dieIncrease(data.damage.dieType, dieSteps.weapon, a.dieIncrease)
    const dieCount = typeof data.damage.dieCount === 'object' ? sheet.formula(data.damage.dieCount) : data.damage.dieCount
    const damage: Rec[] = [{
      dieType,
      dieCount: dieCount * (mode?.damageMultiplier || 1),
      type: mode?.damageType || data.damage.type,
      mod: damageMod,
      bonus: { type: 'flat', value: (weapon.entry.bonusDamage || 0) + globalDamage(attackType) + a.damage + overflow },
      reroll: a.reroll || false,
      addCritDie: a.addCritDie || false,
    }]
    if (data.additionalDamage) damage.push(...data.additionalDamage)
    if (mode?.addDamage) damage.push(...mode.addDamage.map(d => ({ ...d, reroll: a.reroll || false })))
    if (versatile) {
      if (versatileDamage && typeof versatileDamage === 'object') {
        damage.push({ ...damage[0], ...versatileDamage, bonus: { type: 'flat', value: damage[0]!.bonus.value } })
      }
      else {
        const v = dieIncrease(damage[0]!.dieType, dieSteps.weapon, 1)
        damage.push({ ...damage[0], dieType: v.dieType, bonus: { type: 'flat', value: damage[0]!.bonus.value + v.overflow } })
      }
    }
    damage.push(...extraDamage(a, damage))
    const range: Rec = { short: (data.range?.short || 0) + a.range, long: data.range?.long || null }
    const notes: unknown[] = [
      ...propertyRecords.filter(p => properties.includes(p.id)).map(p => ({ type: 'tooltip', text: p.name, tooltipText: p.body, isHtml: true })),
      ...data.notes ?? [],
      ...a.notes,
    ]
    let card: SheetCard = {
      type: 'attack',
      attackType,
      attack,
      dc: mode?.dc || false,
      name: data.name,
      damage,
      resource: null,
      range,
      notes,
      properties: [attackType === 'melee' ? 'Melee' : 'Ranged'],
      data,
      bonus: { type: 'flat', value: 0 },
      moreInfo: weapon.entry.uuid ? { equipment: weapon.entry.uuid } : data.moreInfo,
      toggle: false,
      weaponType,
      augments,
    }
    card = rules.attack?.(card, weapon, sheet) ?? card
    out.attacks.push(card)

    if (light && twfEligible && !twoHanded && card.attack) {
      const t = augments.twf!
      out.twf.push({
        ...card,
        damage: card.damage.map((x: Rec) => {
          const d = dieIncrease(x.dieType, dieSteps.weapon, t.dieIncrease)
          return { ...x, mod: false, dieType: d.dieType || x.dieType, bonus: { type: 'flat', value: (x.bonus?.value || 0) + t.damage + d.overflow }, reroll: t.reroll || x.reroll }
        }),
        attack: { ...card.attack, bonus: { type: 'flat', value: card.attack.bonus.value + t.hit } },
        properties: [...card.properties, '2W-Fight'],
      })
    }
    for (const [key, s] of Object.entries(rules.special ?? {})) {
      if (!special[key]) continue
      const built = s.build(card, weapon, augments[key]!, sheet)
      if (built) out[key]!.push(built)
    }
  }
  return out
}
