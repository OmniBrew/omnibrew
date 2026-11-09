/**
 * The game's parts for the character pages (`#game-client`, plan/24), which a game app
 * points at its own module: the browser-safe game definition, the old-character
 * importer, and its sheet panels and resource displays. Only the character pages import
 * it, so reference pages never load (or prefetch) any of it. This default has none:
 * the character pages then say the site has no rules.
 */
import type { Component } from 'vue'
import type { Character } from '@omnibrew/engine/character'
import type { PreviewSample, Rec, RulesContent } from '@omnibrew/engine/rules'
import type { Game, GameDefinition } from '@omnibrew/engine/schemas'

/** What a game's migrator says about an old character it converted: issues by kind (unknown ids, renamed...). */
export interface ImportReport {
  from: string
  [kind: string]: string | Array<{ at: string, id?: string, message: string }>
}

/** Converts one of the game's old characters (the old site's export) to the model. */
export type LegacyImporter = (raw: Record<string, unknown>, opts: { game: Game, content: RulesContent }) => { character: Character, report: ImportReport }

export const definition: GameDefinition | null = null

/** The game's old-character migrator, for importing the old site's exports. */
export const importLegacy: (() => Promise<LegacyImporter>) | null = null

export interface SheetParts {
  /** Panels by slot: `side` (the right column), `gear` (the Gear tab), `settings` (Settings & Overrides). */
  slots: Record<string, Component[]>
  /** Components for the game's resource display types (`gear-consumable`), by type. */
  resources: Record<string, Component>
}

export const sheet: SheetParts = { slots: {}, resources: {} }

/** The game's parts for the homebrew pages (plan/26 §1.3). */
export interface HomebrewParts {
  /** Sample characters for the editor's preview. */
  samples: PreviewSample[]
  /** Places a record the engine can't (`placeRecord` returns null): ME mods go on a host item. */
  place?: (character: Character, collection: string, record: Rec, content: RulesContent) => Character | null
}

export const homebrew: HomebrewParts | null = null
