/**
 * Formats content measurements in the reader's unit system. Content stores
 * imperial values (feet, miles, inches, pounds); the game's app config says how
 * they convert (ME5e: 5 ft = 2 m) and which system shows by default.
 */
export type ImperialUnit = 'ft' | 'mi' | 'in' | 'lb'
type UnitSystem = 'imperial' | 'metric'

export interface MeasureOptions {
  /** Short unit name, no space: `9m`. */
  abbr?: boolean
  /** Adjective form, hyphenated and singular: `9-meter`. */
  adj?: boolean
  /** The number alone. */
  numOnly?: boolean
  /** Text shown instead of the unit name; `{metric}` is replaced by the unit name. */
  override?: string
  /** Show only `override`, and only in this unit system. */
  textIf?: UnitSystem
}

const NAMES: Record<string, [singular: string, plural: string, abbr: string]> = {
  ft: ['foot', 'feet', 'ft'],
  mi: ['mile', 'miles', 'mi'],
  in: ['inch', 'inches', 'in'],
  lb: ['pound', 'pounds', 'lb'],
  m: ['meter', 'meters', 'm'],
  km: ['kilometer', 'kilometers', 'km'],
  cm: ['centimeter', 'centimeters', 'cm'],
  kg: ['kilogram', 'kilograms', 'kg'],
}
const METRIC: Record<ImperialUnit, string> = { ft: 'm', mi: 'km', in: 'cm', lb: 'kg' }

export function useUnits() {
  const { game } = useAppConfig()
  const units = game.units
  const system = useState<UnitSystem>('units:system', () => units.default as UnitSystem)

  function toMetric(value: number, unit: ImperialUnit): number {
    switch (unit) {
      case 'ft': {
        // Short distances round to half meters (1 ft → 0.5 m), as the ME5e site did.
        const m = value * units.metersPerFoot
        return m === 0 || m >= 2 ? Math.round(m * 10) / 10 : Math.max(0.5, Math.round(m * 2) / 2)
      }
      case 'mi': return Math.round(value * units.kmPerMile)
      case 'in': return Math.round(value * units.cmPerInch)
      case 'lb': return Math.round(value * units.kgPerPound)
    }
  }

  function measure(value: number, unit: ImperialUnit, opts: MeasureOptions = {}): string {
    if (opts.textIf) return opts.textIf === system.value ? (opts.override ?? '') : ''
    const metric = system.value === 'metric'
    const shown = metric ? toMetric(value, unit) : value
    if (opts.numOnly) return String(shown)
    const [singular, plural, abbr] = NAMES[metric ? METRIC[unit] : unit]!
    const name = opts.abbr ? abbr : opts.adj || shown === 1 ? singular : plural
    const text = opts.override ? opts.override.replace('{metric}', name) : name
    const separator = opts.adj ? '-' : opts.abbr ? '' : ' '
    return `${shown === 0 ? '' : shown}${separator}${text}`
  }

  /** Feet (or miles with `large`, inches with `tiny`). */
  const distance = (feet: number, opts: MeasureOptions & { large?: boolean, tiny?: boolean } = {}) =>
    measure(feet, opts.large ? 'mi' : opts.tiny ? 'in' : 'ft', opts)

  const weight = (pounds: number, opts: MeasureOptions = {}) => measure(pounds, 'lb', opts)

  return { system, measure, distance, weight }
}
