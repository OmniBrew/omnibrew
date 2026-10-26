/**
 * ME5e power type colors for both modes (the theme's game colors, plan/23). The
 * type's icon and name always go with the color. Tested in test/equipment.test.ts.
 */
export const POWER_TYPE_COLORS: Record<string, string> = {
  biotic: 'text-violet-600 dark:text-violet-400',
  tech: 'text-orange-800 dark:text-orange-400',
  combat: 'text-rose-700 dark:text-rose-400',
}

/** Text color class for a power type; the primary color for any other. */
export const powerTypeClass = (type?: string | null) => POWER_TYPE_COLORS[type ?? ''] ?? 'text-primary'
