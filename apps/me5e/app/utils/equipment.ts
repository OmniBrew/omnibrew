/**
 * ME5e equipment: the rarity order and colors, a weapon's heat, and the mod
 * texts (subtitle, what a mod fits). Pure functions, tested in
 * test/equipment.test.ts; the engine's item helpers do the rest.
 */

/** vue-i18n's `t`: a key, then named values, a list or a plural count. */
type Translate = (key: string, ...args: unknown[]) => string

/** Rarities in the order filters list them (the live site's). */
export const RARITY_ORDER = ['varies', 'common', 'uncommon', 'rare', 'very_rare', 'spectre']

/** The live site's rarity text colors (config.rarityTextColors), as Tailwind classes for both modes. */
export const RARITY_COLORS: Record<string, string> = {
  varies: 'text-highlighted',
  common: 'text-highlighted',
  uncommon: 'text-green-700 dark:text-green-400',
  rare: 'text-blue-700 dark:text-blue-400',
  very_rare: 'text-purple-700 dark:text-purple-400',
  spectre: 'text-red-700 dark:text-red-500',
}

/** Text color class for a rarity. */
export const rarityClass = (rarity?: string | null) => RARITY_COLORS[rarity ?? ''] ?? 'text-highlighted'

/** A weapon's heat: the value of its `heat` property (plan/04 B8). */
export function weaponHeat(weapon: { properties?: unknown[] | null }): number | undefined {
  const heat = (weapon.properties as { id: string, value?: unknown }[] | null | undefined)?.find(p => p.id === 'heat')?.value
  return typeof heat === 'number' ? heat : undefined
}

const ARMOR_TYPES = ['light', 'medium', 'heavy']
const RANGED_TYPES = ['assault_rifle', 'heavy_pistol', 'shotgun', 'smg', 'sniper_rifle']

/** "Spectre Armor Mod". */
export const modSubtitle = (t: Translate, mod: { rarity?: string | null, modType?: string | null }) =>
  t('mod_item_subtitle', { rarity: mod.rarity ? t(`rarities.${mod.rarity}`) : '', modType: t(`mod_types.${mod.modType}`) }).trim()

/** One kind of gear a mod fits: "Light Armor", "Heavy Pistol". */
export const modAvailabilityName = (t: Translate, value: string) =>
  ARMOR_TYPES.includes(value) ? t(`armor_types.${value}_armor_title`) : t(`weapon_types.${value}`, 1)

/** What a mod fits: "All armor", "All ranged", or the list ("Heavy Pistol, SMG"). */
export function modAvailability(t: Translate, mod: { modType?: string | null, availability?: string[] | null }): string {
  const fits = mod.availability ?? []
  if (mod.modType === 'armor' && ARMOR_TYPES.every(a => fits.includes(a))) return t('mod_availabilities.all_armor')
  if (mod.modType === 'weapon' && RANGED_TYPES.every(w => fits.includes(w)) && !fits.includes('melee')) return t('mod_availabilities.all_ranged')
  return fits.length ? t(`lists.comma_list[${fits.length}]`, fits.map(v => modAvailabilityName(t, v))) : '-'
}
