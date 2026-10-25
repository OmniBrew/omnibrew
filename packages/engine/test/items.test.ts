import { describe, expect, it } from 'vitest'
import {
  armorPlacement, armorSubtitle, gearSubtitle, gearTypeText, itemCost, itemCostValue, itemCredits, itemDamage, itemDamageAverage,
  itemDice, itemPropertyIds, itemPropertyText, itemPropertyValue, itemRange, itemTags, itemWeight, vehicleCargo, vehicleCrew,
  vehicleSubtitle, vehicleSystem, weaponSubtitle, type MeasureFormat,
} from '../app/utils/items'
import { uniqueOptions } from '../app/utils/lists'
import type { Translate } from '../app/utils/powers'

// A stand-in for vue-i18n's `t` over a few ME5e messages.
const messages: Record<string, string> = {
  'credits': 'no credits | credit | {n} credits',
  'dice': '{dieCount}d{dieType}',
  'dice_formulas.plus': '{dice} + {n}',
  'dice_formulas.minus': '{dice} - {n}',
  'damage_types.piercing': 'piercing',
  'damage_types.lightning': 'lightning',
  'damage_types.bludgeoning': 'bludgeoning',
  'lists.comma_list[1]': '{0}',
  'lists.comma_list[2]': '{0}, {1}',
  'tags.shields': 'Shield Capacity',
  'tags.set_bonus': 'Set Bonus',
  'rarities.uncommon': 'Uncommon',
  'rarities.rare': 'Rare',
  'rarities.spectre': 'Spectre',
  'weapon_item_subtitle': '{rarity} {weaponType}',
  'weapon_types.heavy_pistol': 'Heavy Pistol | Heavy Pistols',
  'armor_item_subtitle': '{rarity} {armorType}, {placement}',
  'armor_types.medium_armor': 'medium armor',
  'armor_types.light_armor': 'light armor',
  'armor_placements.arms': 'arms',
  'armor_placements.body_armor': 'body armor (chest, legs, and arms)',
  'gear_types.tool': 'Tool',
  'gear_types.gaming_set': 'Gaming Set',
  'gear_types.heavy_weapon': 'Heavy Weapon',
  'sizes.huge': 'huge',
  'vehicle_types.transport': 'Transport',
  'vehicles.combined': 'Combined',
  'vehicles.system_crew': '{n} crew',
  'vehicles.crew_range': 'min: {min}, max: {max}',
  'vehicles.cargo_tonnes': '{n} tonne | {n} tonnes',
}
const t = ((key: string, a?: unknown, b?: unknown) => {
  let text = messages[key] ?? key
  const plural = typeof a === 'number' ? a : typeof b === 'number' ? b : undefined
  if (text.includes(' | ')) {
    const forms = text.split(' | ')
    text = forms.length === 3 ? forms[plural === 0 ? 0 : plural === 1 ? 1 : 2]! : forms[plural === 1 ? 0 : 1]!
  }
  const named = Array.isArray(a) ? Object.fromEntries(a.map((v, i) => [i, v])) : typeof a === 'object' ? a as object : {}
  return text.replace(/\{(\w+)\}/g, (_, k: string) => String((named as Record<string, unknown>)[k]))
}) as Translate

// useUnits in metric, as ME5e converts: 5 ft = 2 m, 1 lb ≈ 0.45 kg.
const distance: MeasureFormat = (feet, opts) => {
  const m = feet * 0.4
  return opts.numOnly ? String(m) : `${m}m`
}
const weight: MeasureFormat = (pounds, opts) => {
  const kg = Math.round(pounds * 0.4536)
  return opts.numOnly ? String(kg) : `${kg === 0 ? '' : kg}kg`
}

describe('item stats', () => {
  it('formats costs in credits, words and dashes', () => {
    expect(itemCost(13500)).toBe('13,500')
    expect(itemCost(1250000, '.')).toBe('1.250.000')
    expect(itemCost(0)).toBe('-')
    expect(itemCost(undefined)).toBe('-')
    expect(itemCost('military')).toBe('Military')
    expect(itemCredits(t, 82500)).toBe('82,500 credits')
    expect(itemCredits(t, 'Varies')).toBe('Varies')
    expect(itemCostValue('Varies')).toBeUndefined()
    expect(itemCostValue(500)).toBe(500)
  })

  it('formats damage dice, extra damage and averages', () => {
    expect(itemDice(t, { dieCount: 2, dieType: 6 })).toBe('2d6')
    expect(itemDice(t, { dieCount: { type: 'level' }, dieType: 8 })).toBe('Xd8')
    expect(itemDice(t, { dieCount: 1, dieType: 4, bonus: { type: 'flat', value: 2 } })).toBe('1d4 + 2')
    expect(itemDice(t, { dieCount: 1, dieType: 4, bonus: { type: 'flat', value: -1 } })).toBe('1d4 - 1')
    expect(itemDamage(t, { dieCount: 2, dieType: 8, type: 'piercing' })).toBe('2d8 piercing')
    expect(itemDamage(t, { dieCount: 1, dieType: 6, type: 'bludgeoning' }, [{ dieCount: 1, dieType: 4, type: 'lightning' }]))
      .toBe('1d6 bludgeoning + 1d4 lightning')
    expect(itemDamage(t, undefined)).toBe('-')
    expect(itemDamageAverage({ dieCount: 2, dieType: 6 })).toBe(7)
    expect(itemDamageAverage({ dieCount: { type: 'level' }, dieType: 6 })).toBe(0)
  })

  it('formats range and weight in the reader\'s units', () => {
    expect(itemRange({ short: 60, long: 180 }, distance)).toBe('24/72m')
    expect(itemRange({ short: 5 }, distance)).toBe('2m')
    expect(itemRange(undefined, distance)).toBe('-')
    expect(itemWeight(18, weight)).toBe('8kg')
    expect(itemWeight(1, weight)).toBe('<1kg')
    expect(itemWeight(0, weight)).toBe('-')
    expect(itemWeight(undefined, weight)).toBe('-')
  })

  it('names properties with their values', () => {
    const properties = [{ id: 'light' }, { id: 'heat', value: 6 }, { id: 'versatile', value: { dieCount: 1, dieType: 12, type: 'bludgeoning' } }]
    expect(itemPropertyIds(properties, ['heat'])).toEqual(['light', 'versatile'])
    expect(itemPropertyValue(properties, 'heat')).toBe(6)
    expect(itemPropertyValue(properties, 'reload')).toBeUndefined()
    expect(itemPropertyText(t, 'Light', undefined, distance)).toBe('Light')
    expect(itemPropertyText(t, 'Heat', 6, distance)).toBe('Heat (6)')
    expect(itemPropertyText(t, 'Versatile', properties[2]!.value, distance)).toBe('Versatile (1d12)')
    expect(itemPropertyText(t, 'Thrown', { short: 20, long: 60 }, distance)).toBe('Thrown (8/24m)')
  })

  it('lists tags and builds filter options from property ids', () => {
    expect(itemTags(t, ['shields', 'set_bonus'])).toBe('Shield Capacity, Set Bonus')
    expect(itemTags(t, [])).toBe('-')
    const weapons = [{ properties: [{ id: 'light' }, { id: 'heat', value: 3 }] }, { properties: [{ id: 'two-handed' }, { id: 'heat', value: 1 }] }]
    const names: Record<string, string> = { 'light': 'Light', 'two-handed': 'Two-Handed', 'heat': 'Heat' }
    expect(uniqueOptions(weapons, w => itemPropertyIds(w.properties, ['heat']), id => names[id] ?? id))
      .toEqual([{ value: 'light', label: 'Light' }, { value: 'two-handed', label: 'Two-Handed' }])
  })
})

describe('item subtitles', () => {
  it('describes weapons, armor and gear', () => {
    expect(weaponSubtitle(t, { rarity: 'uncommon', weaponType: 'heavy_pistol' })).toBe('Uncommon Heavy Pistol')
    expect(armorPlacement({ coverage: 'piece', slot: 'arms' })).toBe('arms')
    expect(armorPlacement({ coverage: 'suit' })).toBe('body_armor')
    expect(armorSubtitle(t, { rarity: 'rare', armorType: 'medium', coverage: 'piece', slot: 'arms' })).toBe('Rare medium armor, arms')
    expect(armorSubtitle(t, { rarity: 'spectre', armorType: 'light', coverage: 'suit' })).toBe('Spectre light armor, body armor (chest, legs, and arms)')
    expect(gearTypeText(t, { gearType: 'tool', subType: 'gaming_set' })).toBe('Tool (Gaming Set)')
    expect(gearSubtitle(t, { rarity: 'spectre', gearType: 'heavy_weapon' })).toBe('Spectre Heavy Weapon')
    expect(gearSubtitle(t, { gearType: 'tool' })).toBe('Tool')
  })

  it('describes vehicles, their systems, crew and cargo', () => {
    expect(vehicleSubtitle(t, { size: 'huge', type: 'transport', subtype: 'air or space' })).toBe('Huge Transport (air or space)')
    expect(vehicleSystem(t, { type: 'Helm', crew: 1 })).toEqual({ label: 'Helm', crew: '1 crew' })
    expect(vehicleSystem(t, { type: 'combined', crew: 1, systems: ['Helm', 'Weapons'] })).toEqual({ label: 'Combined, Helm / Weapons', crew: '1 crew' })
    expect(vehicleCrew(t, { min: 2, max: '100+' })).toBe('min: 2, max: 100+')
    expect(vehicleCargo(t, 1)).toBe('1 tonne')
    expect(vehicleCargo(t, 4)).toBe('4 tonnes')
    expect(vehicleCargo(t, '100+')).toBe('100+ tonnes')
  })
})
