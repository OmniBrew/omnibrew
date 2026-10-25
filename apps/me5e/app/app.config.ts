import { recordRoutes } from '../routes'

// ME5e site configuration. Labels are i18n keys from the content repo's messages/en.yml.
export default defineAppConfig({
  game: {
    brand: { title: 'title', logo: '/icon.png' },
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
  ui: {
    colors: {
      primary: 'alliance',
      secondary: 'n7',
      neutral: 'citadel',
    },
  },
})
