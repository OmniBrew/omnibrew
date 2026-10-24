// Engine defaults. A game app overrides `game` in its own app.config.ts.
export default defineAppConfig({
  game: {
    units: {
      /** Unit system shown by default. Content stores distances in feet. */
      default: 'imperial' as 'imperial' | 'metric',
      /** Meters per foot when showing metric (ME5e rounds 5 ft to 2 m). */
      metersPerFoot: 0.3048,
    },
  },
})
