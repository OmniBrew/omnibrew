/** Formats content distances (stored in feet) in the reader's unit system. */
export function useUnits() {
  const { game } = useAppConfig()
  const system = useState('units:system', () => game.units.default as 'imperial' | 'metric')

  function distance(feet: number, opts: { abbr?: boolean, adj?: boolean } = {}) {
    const metric = system.value === 'metric'
    const value = metric ? Math.round(feet * game.units.metersPerFoot * 10) / 10 : feet
    const unit = metric
      ? opts.abbr ? 'm' : value === 1 || opts.adj ? 'meter' : 'meters'
      : opts.abbr ? 'ft.' : value === 1 || opts.adj ? 'foot' : 'feet'
    return `${value}${opts.adj ? '-' : ' '}${unit}`
  }

  return { system, distance }
}
