// ME5e theme stub. The palettes named here are defined as Tailwind @theme
// tokens in app/assets/css/main.css; Nuxt UI maps its semantic colors onto them.
export default defineAppConfig({
  game: {
    // ME5e shows metric by default, rounds 5 ft to 2 m and a mile to 1.6 km.
    units: { default: 'metric', metersPerFoot: 0.4, kmPerMile: 1.6 },
    sources: {
      races: { title: 'Races from the Relay', url: 'https://www.gmbinder.com/share/-L7HA1pIhxcx3bVb8vqf' },
      wiki: { title: 'Mass Effect Wiki', url: 'https://masseffect.fandom.com/wiki/', pageInUrl: true },
    },
  },
  ui: {
    colors: {
      primary: 'n7', // N7 red
      neutral: 'citadel', // cool slate
    },
  },
})
