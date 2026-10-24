// ME5e theme stub. The palettes named here are defined as Tailwind @theme
// tokens in app/assets/css/main.css; Nuxt UI maps its semantic colors onto them.
export default defineAppConfig({
  game: {
    // ME5e shows metric by default and rounds 5 ft to 2 m.
    units: { default: 'metric', metersPerFoot: 0.4 },
  },
  ui: {
    colors: {
      primary: 'n7', // N7 red
      neutral: 'citadel', // cool slate
    },
  },
})
