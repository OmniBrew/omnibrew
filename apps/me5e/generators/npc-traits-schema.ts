import { Id } from '@omnibrew/engine/schemas'
import { z } from 'zod'

/**
 * The NPC generator's species traits as content (`npc-traits/<species id>.md`, Luke
 * 2026-11-15): their names and texts, which the Discord mods edit. What a trait does (AC,
 * skills, resistances, damage budgets) stays in `npc-traits.ts`, which finds each text by
 * its id. A trait listed here that the generator doesn't know is added as it is, a plain
 * feature (or action), so new flavor traits need no code.
 *
 * Placeholders in `text`: `{{ name }}` (the NPC, lowercase: "the asari adept"), `{{ dc }}`
 * (its save DC), and per trait the values `TRAIT_VALUES` lists.
 */
export const npcTraitsShape = () => ({
  id: Id,
  body: z.string().optional(),
  traits: z.array(z.strictObject({
    id: Id,
    name: z.string(),
    /** Markdown with the game's MDC components and `{{ placeholders }}`. Optional for an attack (the vorcha's Bite). */
    text: z.string().optional(),
    /** For a trait the generator doesn't know: a feature (default) or an action. */
    kind: z.enum(['feature', 'action']).optional(),
  })).min(1),
})

/**
 * The traits the generator applies, by species, and the placeholders each one's text may
 * use beyond `name` and `dc`. The validator refuses a species file missing one of them.
 */
export const TRAIT_VALUES: Record<string, Record<string, string[]>> = {
  'angara': { 'innate-powercasting': ['powercasting'], 'bio-electric-ward': [], 'solar-dependency': [] },
  'asari': { 'innate-powercasting': ['powercasting'], 'mind-meld': [] },
  'batarian': { 'four-eyes': [], 'saving-face': [] },
  'drell': { 'raw-agility': [] },
  'elcor': { careful: [] },
  'geth': { 'hunter-mode': [], 'repair-matrix': [] },
  'hanar': { 'amphibious': [], 'bioluminescence': [], 'contra-gravitic-levitation': [], 'tentacles': [], 'secrete-toxin': [] },
  'krogan': { 'blood-rage': ['temporaryHitPoints'] },
  'quarian': { 'hermetic-suit': [], 'mind-shielding-unit': [], 'overclock-unit': [], 'clarity-unit': [], 'keen-eyesight': [], 'revival-unit': [] },
  'salarian': { amphibious: [] },
  'turian': { 'esprit-de-corps': [] },
  'volus': { 'fury-of-the-small': ['extraDamage'], 'lucky': [], 'hermetic-suit': [] },
  'vorcha': { 'non-differentiated-cells': [], 'bite': [], 'amphibious': [], 'zero-g-aptitude': [] },
}

/** Placeholders a trait's text uses (`{{ name }}`). */
export const placeholders = (text: string) => [...text.matchAll(/\{\{\s*([\w.-]+)\s*\}\}/g)].map(m => m[1]!)

/** Problems with one species' traits file, in plain words (the ME content checks report them). */
export function npcTraitProblems(species: string, traits: { id: string, text?: string }[]): string[] {
  const problems: string[] = []
  const known = TRAIT_VALUES[species] ?? {}
  for (const id of Object.keys(known)) {
    if (!traits.some(t => t.id === id)) problems.push(`the generator needs a trait "${id}"`)
  }
  const seen = new Set<string>()
  for (const t of traits) {
    if (seen.has(t.id)) problems.push(`trait "${t.id}" is listed twice`)
    seen.add(t.id)
    const allowed = new Set(['name', 'dc', ...(known[t.id] ?? [])])
    for (const p of placeholders(t.text ?? '')) if (!allowed.has(p)) problems.push(`trait "${t.id}": no placeholder {{ ${p} }} (it can use ${[...allowed].join(', ')})`)
  }
  return problems
}
