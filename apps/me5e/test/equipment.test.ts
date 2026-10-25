import { describe, expect, it } from 'vitest'
import { modAvailability, modAvailabilityName, modSubtitle, rarityClass, weaponHeat } from '../app/utils/equipment'

// A stand-in for vue-i18n's `t` over the ME5e messages these helpers use.
const messages: Record<string, string> = {
  'lists.comma_list[1]': '{0}',
  'lists.comma_list[2]': '{0}, {1}',
  'rarities.spectre': 'Spectre',
  'mod_item_subtitle': '{rarity} {modType}',
  'mod_types.armor': 'Armor Mod',
  'mod_availabilities.all_armor': 'All armor',
  'mod_availabilities.all_ranged': 'All ranged',
  'armor_types.light_armor_title': 'Light Armor',
  'armor_types.medium_armor_title': 'Medium Armor',
  'weapon_types.heavy_pistol': 'Heavy Pistol | Heavy Pistols',
  'weapon_types.melee': 'Melee | Melee',
}
const t = (key: string, a?: unknown, b?: unknown) => {
  let text = messages[key] ?? key
  const plural = typeof a === 'number' ? a : typeof b === 'number' ? b : undefined
  if (text.includes(' | ')) text = text.split(' | ')[plural === 1 ? 0 : 1]!
  const named = Array.isArray(a) ? Object.fromEntries(a.map((v, i) => [i, v])) : typeof a === 'object' ? a as object : {}
  return text.replace(/\{(\w+)\}/g, (_, k: string) => String((named as Record<string, unknown>)[k]))
}

describe('ME5e equipment', () => {
  it('reads a weapon\'s heat from its heat property', () => {
    expect(weaponHeat({ properties: [{ id: 'light' }, { id: 'heat', value: 6 }] })).toBe(6)
    expect(weaponHeat({ properties: [{ id: 'two-handed' }] })).toBeUndefined()
    expect(weaponHeat({})).toBeUndefined()
  })

  it('colors rarities, with a default for unknown ones', () => {
    expect(rarityClass('rare')).toContain('text-blue')
    expect(rarityClass(undefined)).toBe('text-highlighted')
  })

  it('describes mods and what they fit', () => {
    expect(modSubtitle(t, { rarity: 'spectre', modType: 'armor' })).toBe('Spectre Armor Mod')
    expect(modAvailabilityName(t, 'light')).toBe('Light Armor')
    expect(modAvailabilityName(t, 'heavy_pistol')).toBe('Heavy Pistol')
    expect(modAvailability(t, { modType: 'armor', availability: ['light', 'medium', 'heavy'] })).toBe('All armor')
    expect(modAvailability(t, { modType: 'armor', availability: ['light', 'medium'] })).toBe('Light Armor, Medium Armor')
    expect(modAvailability(t, { modType: 'weapon', availability: ['assault_rifle', 'heavy_pistol', 'shotgun', 'smg', 'sniper_rifle'] })).toBe('All ranged')
    expect(modAvailability(t, { modType: 'weapon', availability: ['melee'] })).toBe('Melee')
    expect(modAvailability(t, { modType: 'weapon' })).toBe('-')
  })
})
