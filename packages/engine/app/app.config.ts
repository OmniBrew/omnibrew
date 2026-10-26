import type { NavItem, SearchGroup } from './types/site'

// Engine defaults. A game app overrides `game` in its own app.config.ts.
export default defineAppConfig({
  game: {
    /**
     * i18n keys for the site name (and a short form for phones, optional) and the
     * footer's tagline (optional), and the logo shown next to the name.
     */
    brand: { title: 'title', shortTitle: '', tagline: '', logo: '' },
    /**
     * Sheet colors: the accents a game's theme defines (`data-accent` values, each
     * with its palette in the game's CSS) and the one used when nothing else applies.
     * A character sheet takes the player's pick, else the first class's id when it
     * is an accent, else `defaultAccent` (utils/accent.ts). Empty: sheets keep the
     * site's primary color.
     */
    theme: { accents: [] as string[], defaultAccent: '' },
    /** The production site's address, for canonical links (no trailing slash). */
    siteUrl: '',
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
    /** Sidebar navigation. */
    navigation: [] as NavItem[],
    /** Links in the header bar (wide screens) and the footer. */
    headerLinks: [] as NavItem[],
    footerLinks: [] as NavItem[],
    /**
     * Where a record's page is, per collection: `{field}` is replaced from the
     * record (`{id}`, `{klass}`, `{species.0}`); `{chapter}` is the chapter of a
     * navigation file listing the record. Collections not listed are at
     * `/<collection>/{id}`; `false` means the records have no page.
     */
    routes: {} as Record<string, string | false>,
    /** Site search: which collections it indexes, grouped for the result filters. */
    search: [] as SearchGroup[],
  },
})
