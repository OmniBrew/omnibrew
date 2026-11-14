import type { BundleOptions } from '@omnibrew/engine/rules'

/**
 * What the rules bundle leaves out (plan/24 §1.2): collections the sheet never reads, and
 * the ones whose body it does. Shared by the site's bundle (`nuxt.config.ts`) and the
 * migration Lambda's copy of the content (plan/28 §1.1), so both see the same records.
 */
export const rulesBundleOptions = {
  exclude: ['attributions', 'bestiary', 'changelog', 'guide', 'manual', 'navigation', 'npc-stats', 'ship-upgrades', 'vehicles'],
  keepBody: ['weapon-properties'],
} satisfies BundleOptions
