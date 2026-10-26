import { recordRoutes } from '../routes'

// ME5e site configuration. Labels are i18n keys from the content repo's messages/en.yml.
export default defineAppConfig({
  game: {
    brand: { title: 'title', shortTitle: 'short_title', tagline: 'homepage.subtitle', logo: '/icon.png' },
    // Sheet colors: Alliance plus one per class (palettes and `data-accent` rules in main.css).
    theme: {
      accents: ['alliance', 'adept', 'engineer', 'explorer', 'infiltrator', 'musician', 'sentinel', 'soldier', 'tracker', 'vanguard', 'experiment'],
      defaultAccent: 'alliance',
    },
    siteUrl: 'https://n7.world',
    // ME5e shows metric by default, rounds 5 ft to 2 m and a mile to 1.6 km.
    units: { default: 'metric', metersPerFoot: 0.4, kmPerMile: 1.6 },
    sources: {
      races: { title: 'Races from the Relay', url: 'https://www.gmbinder.com/share/-L7HA1pIhxcx3bVb8vqf' },
      wiki: { title: 'Mass Effect Wiki', url: 'https://masseffect.fandom.com/wiki/', pageInUrl: true },
    },
    // The live site's navigation drawer, minus the signed-in tools (Phase 3).
    navigation: [
      { label: 'manual.title', heading: true, children: [
        { label: 'manual.intro', icon: 'i-lucide-book-open', to: '/manual/intro' },
        { label: 'rules_title', icon: 'i-lucide-gavel', to: '/manual', chapters: 'manual' },
        { label: 'character_title', count: 1, icon: 'i-lucide-user-round', children: [
          { label: 'class_title', count: 2, to: '/classes' },
          { label: 'species_title', count: 2, to: '/species' },
          { label: 'feat_title', count: 2, to: '/feats' },
          { label: 'background_title', count: 2, to: '/backgrounds' },
        ] },
        { label: 'equipment_title', count: 2, icon: 'i-lucide-wrench', children: [
          { label: 'weapon_title', count: 2, to: '/weapons' },
          { label: 'armor_title', count: 2, to: '/armor' },
          { label: 'mod_title', count: 2, to: '/mods' },
          { label: 'gear_title', count: 2, to: '/gear' },
          { label: 'vehicle_title', count: 2, to: '/vehicles' },
        ] },
        { label: 'power_title', count: 2, icon: 'i-lucide-flame', to: '/powers' },
        { label: 'bestiary_title', count: 2, icon: 'i-lucide-paw-print', to: '/bestiary' },
        { label: 'appendix_title', icon: 'i-lucide-columns-2', children: [
          { label: 'conditions_title', to: '/appendix/conditions' },
          { label: 'benefits_title', to: '/appendix/benefits' },
          { label: 'random_height_weight_title', to: '/appendix/random-height-weight' },
          { label: 'skills_title', to: '/appendix/skills' },
          { label: 'tool_profs_title', to: '/appendix/tool-profs' },
          { label: 'weapon_props_title', to: '/appendix/weapon-properties' },
        ] },
      ] },
      { label: 'tools_guides_title', heading: true, children: [
        { label: 'guide.title', icon: 'i-lucide-puzzle', to: '/guide', chapters: 'guide' },
      ] },
      { label: 'title', heading: true, children: [
        { label: 'assets_title', icon: 'i-lucide-download', to: '/assets' },
        { label: 'changelog_title', icon: 'i-lucide-history', to: '/changelog' },
        { label: 'about_title', icon: 'i-lucide-info', to: '/about' },
      ] },
    ],
    headerLinks: [
      { label: 'manual.title', to: '/manual/intro' },
      { label: 'about_title', to: '/about' },
    ],
    footerLinks: [
      { label: 'about_title', to: '/about' },
      { label: 'license_title', to: '/license' },
      { label: 'legal.privacy', to: '/legal/privacy' },
      { label: 'legal.terms', to: '/legal/terms' },
      { label: 'legal.cookies', to: '/legal/cookies' },
      { label: 'legal.acceptable_use', to: '/legal/acceptable-use' },
    ],
    routes: recordRoutes,
    // build-index.js's groups and collections.
    search: [
      { id: 'character', label: 'character_title', icon: 'i-lucide-user-round', collections: ['backgrounds', 'feats', 'species', 'traits', 'class-features'] },
      { id: 'equipment', label: 'equipment_title', icon: 'i-lucide-wrench', collections: ['gear', 'vehicles', 'mods', 'armor', 'weapons'] },
      { id: 'manual', label: 'manual.title', icon: 'i-lucide-gavel', collections: ['manual', 'conditions', 'weapon-properties'] },
      { id: 'power', label: 'power_title', icon: 'i-lucide-flame', collections: ['powers'] },
      { id: 'bestiary', label: 'bestiary_title', icon: 'i-lucide-paw-print', collections: ['bestiary'] },
    ],
  },
  // The "Codex" theme (plan/23): palettes from main.css, then the component looks that aren't tokens.
  ui: {
    colors: {
      primary: 'alliance',
      secondary: 'n7',
      neutral: 'citadel',
      success: 'emerald',
      info: 'alliance',
      warning: 'amber',
      error: 'red',
      brand: 'n7',
    },
    // Short labels in the label face; brand is white on n7-600 in both modes.
    button: {
      slots: { base: 'font-label font-semibold tracking-[0.02em]' },
      compoundVariants: [{ color: 'brand', variant: 'solid', class: 'text-white bg-brand-600 hover:bg-brand-700 active:bg-brand-700 disabled:bg-brand-600 aria-disabled:bg-brand-600 focus-visible:outline-brand-600' }],
    },
    badge: {
      slots: { base: 'font-label font-semibold uppercase tracking-[0.08em]' },
      variants: { size: { md: { base: 'text-[11px]/3 px-1.5 h-5 rounded-xs' }, sm: { base: 'text-[10px]/3 px-1 h-4 rounded-xs' } } },
      defaultVariants: { variant: 'subtle' },
    },
    kbd: { base: 'font-mono normal-case' },
    tabs: {
      slots: { trigger: 'font-label font-semibold tracking-[0.02em]' },
      variants: { variant: { link: { indicator: 'rounded-none' } } },
    },
    // Placeholders move from dimmed to muted for 4.5:1.
    input: { slots: { base: 'placeholder:text-muted' } },
    textarea: { slots: { base: 'placeholder:text-muted' } },
    select: { slots: { placeholder: 'text-muted' } },
    selectMenu: { slots: { placeholder: 'text-muted' } },
    inputMenu: { slots: { base: 'placeholder:text-muted' } },
    table: {
      slots: {
        th: 'bg-muted font-label text-[11.5px]/4 uppercase tracking-[0.1em] text-muted py-2.5 px-3',
        td: 'text-default py-2.5 px-3',
      },
    },
    header: {
      slots: {
        root: 'bg-default border-b border-default h-(--ui-header-height) sticky top-0 z-50',
        center: 'hidden min-[900px]:flex self-stretch',
        toggle: 'min-[900px]:hidden',
        content: 'min-[900px]:hidden',
        overlay: 'min-[900px]:hidden',
      },
    },
    // Sidebar: eyebrow section labels, 32 px rows, a primary wash on the active item.
    navigationMenu: {
      slots: {
        label: 'eyebrow text-muted px-2 pt-3',
        link: 'text-sm min-h-8',
        linkLeadingIcon: 'size-4',
        linkTrailingIcon: 'size-4',
      },
      compoundVariants: [
        { orientation: 'vertical', variant: 'pill', active: true, highlight: true, level: false, class: { link: 'before:bg-primary/10 after:hidden' } },
      ],
    },
    prose: {
      h1: { slots: { base: 'font-display text-[2.125rem]/10 tracking-[-0.01em]' } },
      // The section rule above every h2: hairline plus the brand tick.
      h2: { slots: { base: 'font-display text-2xl/8 font-bold mt-11 mb-4 pt-4.5 border-t border-default before:absolute before:left-0 before:-top-0.5 before:w-8 before:h-[3px] before:bg-(--ui-tick)' } },
      h3: { slots: { base: 'font-display text-[1.1875rem]/[1.625rem] font-semibold mt-8 mb-2' } },
      h4: { slots: { base: 'font-label' } },
      p: { base: 'my-4 leading-[1.7]' },
      a: { base: 'text-primary underline decoration-primary/45 underline-offset-3 hover:decoration-current focus-visible:outline-3 outline-primary/25 rounded-xs' },
      table: { slots: { root: 'border border-default rounded-md', base: 'border-separate border-spacing-0' } },
      thead: { base: 'bg-muted' },
      th: { base: 'py-2 px-3 font-label font-semibold text-[11.5px]/4 uppercase tracking-[0.1em] text-muted border-0 border-b border-accented first:border-s-0' },
      td: { base: 'py-2 px-3 border-0 border-b border-default first:border-s-0 [tr:last-child>&]:border-b-0' },
      callout: {
        slots: { base: 'rounded-md text-base/[1.65] [&_p]:text-default [&_li]:text-default' },
        variants: {
          color: {
            info: { base: 'border-info/35 bg-info/7 text-default' },
            success: { base: 'border-success/35 bg-success/7 text-default' },
            warning: { base: 'border-warning/35 bg-warning/7 text-default' },
            secondary: { base: 'border-secondary/35 bg-secondary/7 text-default' },
          },
        },
      },
    },
  },
})
