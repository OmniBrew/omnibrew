import { newCharacter, type Character, type CharacterExtension } from '../character'
import type { RulesContent } from './content'
import type { Rec } from './types'

/**
 * The homebrew editor's sample characters (plan/26 §1.3): a character of a class and level
 * with fixed scores, and the record being written put on it as a player would (equipped,
 * learned, taken as a feat). The page computes it with and without the record and shows
 * the difference. Game-neutral; a game names its samples (`#game-client`) and may place
 * records the engine doesn't know how to (ME mods go on a host weapon or armor).
 */
export interface PreviewSample {
  id: string
  /** i18n key of its name in the sample picker. */
  label: string
  class: string
  level: number
  species?: string
  scores: Record<'str' | 'dex' | 'con' | 'int' | 'wis' | 'cha', number>
  /** Content items it carries, equipped. */
  equipment?: string[]
  /** Kinds (collections) this sample is the default for, and power types it suits. */
  defaultFor?: string[]
  powerTypes?: string[]
}

export function sampleCharacter(sample: PreviewSample, content: RulesContent, game: { id: string, character?: CharacterExtension }, level = sample.level, klass = sample.class): Character {
  const c = newCharacter(game, 'Sample')
  const data = content.get('classes', klass)
  const hitDie = Number(data?.hitDie) || 8
  c.species = sample.species ?? null
  c.classes = [{
    id: klass,
    levels: level,
    subclass: null,
    hitPoints: Array.from({ length: level }, (_, i) => (i === 0 ? hitDie : Math.floor(hitDie / 2) + 1)),
    rolledHitPoints: false,
    asi: {},
  }]
  c.abilityScores = { ...c.abilityScores, method: 'manual', base: { ...sample.scores } }
  c.equipment = (sample.equipment ?? []).flatMap((id, i) => {
    const item = itemRecord(content, id)
    return item ? [{ uuid: `sample-${i}`, id, kind: String(item.kind), equipped: true }] : []
  })
  return c
}

const ITEM_COLLECTIONS = ['weapons', 'armor', 'gear', 'mods']
function itemRecord(content: RulesContent, id: string): Rec | undefined {
  for (const c of ITEM_COLLECTIONS) {
    const r = content.get(c, id)
    if (r) return r
  }
  return undefined
}

/**
 * The sample with a record placed on it: items are added equipped, powers learned with the
 * sample's class, feats taken at the class's first ability score improvement. Returns null
 * for a kind it can't place (the game's `place` hook handles those).
 */
export function placeRecord(character: Character, collection: string, record: Rec, content: RulesContent): Character | null {
  const c = structuredClone(character)
  const id = String(record.id)
  if (ITEM_COLLECTIONS.includes(collection) && record.kind !== 'mod') {
    c.equipment.push({ uuid: `preview-${id}`, id, kind: String(record.kind ?? collection), equipped: true })
    return c
  }
  if (collection === 'powers') {
    c.powers.push({ id, class: c.classes[0]?.id ?? null, advancement: null })
    return c
  }
  if (collection === 'feats') {
    const klass = c.classes[0]
    const data = klass ? content.get('classes', klass.id) : undefined
    const level = ((data?.progression as { abi?: number[] } | undefined)?.abi ?? []).find(l => l <= (klass?.levels ?? 0))
    if (!klass || level === undefined) return null
    klass.asi = { ...klass.asi, [level]: 'feat' }
    c.choices.push({ path: `class/${klass.id}/${level}/feats`, values: [id] })
    return c
  }
  return null
}
