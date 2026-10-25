import type { CharacterExtension } from '@omnibrew/engine/character'

declare module '#app' {
  interface NuxtApp {
    /** The game's character model parts, provided by the game app (plan/20). */
    $characterGame: { id: string, character?: CharacterExtension }
  }
}

export {}
