/** The "none" or "auto" option of a select (a select item's value can't be an empty string). */
export const NONE = '__none__'

/** A select's value back as a string, `''` for the `NONE` option. */
export const fromSelect = (v: unknown) => (v === NONE || v === null || v === undefined ? '' : String(v))
