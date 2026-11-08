import type { HomebrewParts } from '@omnibrew/engine/app/game-client'

const soldier = { str: 14, dex: 16, con: 14, int: 10, wis: 12, cha: 8 }
const caster = { str: 8, dex: 14, con: 14, int: 16, wis: 12, cha: 10 }

/**
 * Homebrew previews (plan/26 §1.3): sample characters, and where a mod goes. A weapon mod is
 * put on a weapon it fits (its availability), an armor mod on armor of its placement.
 */
export const meHomebrewParts: HomebrewParts = {
  samples: [
    { id: 'soldier', label: 'homebrew.samples.soldier', class: 'soldier', level: 5, species: 'human', scores: soldier, equipment: ['m-3-predator', 'colossus-chestplate'], defaultFor: ['weapons', 'armor', 'gear', 'mods', 'feats', 'powers'], powerTypes: ['combat'] },
    { id: 'adept', label: 'homebrew.samples.adept', class: 'adept', level: 5, species: 'asari', scores: caster, defaultFor: ['powers', 'feats'], powerTypes: ['biotic'] },
    { id: 'engineer', label: 'homebrew.samples.engineer', class: 'engineer', level: 5, species: 'salarian', scores: caster, defaultFor: ['powers', 'gear'], powerTypes: ['tech'] },
    { id: 'sentinel', label: 'homebrew.samples.sentinel', class: 'sentinel', level: 5, species: 'human', scores: caster, defaultFor: ['powers'], powerTypes: ['biotic', 'tech'] },
  ],
  place: (character, collection, record, content) => {
    if (collection !== 'mods') return null
    const c = structuredClone(character)
    const fits = (r: Record<string, unknown>) => (record.availability as string[] | undefined ?? []).includes(String(record.modType === 'weapon' ? r.weaponType : r.armorType))
    const host = record.modType === 'weapon'
      ? content.list('weapons').find(fits)
      : content.list('armor').find(r => fits(r) && (r.coverage === 'suit' || r.slot === record.placement))
    if (!host) return null
    c.equipment.push({ uuid: 'preview-host', id: String(host.id), kind: String(host.kind ?? (record.modType === 'weapon' ? 'weapon' : 'armor')), equipped: true, mods: [{ id: String(record.id), slot: String(record.placement) }] })
    return c
  },
}
