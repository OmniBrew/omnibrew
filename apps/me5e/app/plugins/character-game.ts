import { meCharacter } from '../../game/character'

/** ME5e's character model parts for the engine's data layer (validated before every save). */
export default defineNuxtPlugin({
  name: 'character-game',
  setup: () => ({ provide: { characterGame: { id: 'me5e', character: meCharacter } } }),
})
