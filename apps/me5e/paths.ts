import { fileURLToPath } from 'node:url'

/**
 * The ME5e content repo (OmniBrew/masseffect-5e-data): the sibling checkout
 * `../omnibrew-me5e-data`, or ME5E_CONTENT_DIR.
 */
export const contentRoot = process.env.ME5E_CONTENT_DIR ?? fileURLToPath(new URL('../../../omnibrew-me5e-data/', import.meta.url))
