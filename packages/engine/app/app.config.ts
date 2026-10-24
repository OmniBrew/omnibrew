// Engine defaults. A game app overrides `game` in its own app.config.ts.
export default defineAppConfig({
  game: {
    units: {
      /** Unit system shown by default. Content stores imperial values (feet, miles, inches, pounds). */
      default: 'imperial' as 'imperial' | 'metric',
      /** Meters per foot when showing metric (ME5e rounds 5 ft to 2 m). */
      metersPerFoot: 0.3048,
      kmPerMile: 1.609,
      cmPerInch: 2.54,
      kgPerPound: 0.4536,
    },
    /**
     * Works that `::source-reference{source="srd" pages="12"}` can credit.
     * `pageInUrl`: `pages` is appended to the URL (a wiki article) instead of shown as page numbers.
     */
    sources: {
      srd: { title: 'Dungeons & Dragons System Reference Document 5.1', url: 'https://media.wizards.com/2016/downloads/DND/SRD-OGL_V5.1.pdf' },
      basic: { title: 'Dungeons & Dragons: Player\'s Basic Rules Version 0.3', url: 'https://media.wizards.com/2016/downloads/DND/PlayerBasicRulesV03.pdf' },
    } as Record<string, { title: string, url: string, pageInUrl?: boolean }>,
  },
})
