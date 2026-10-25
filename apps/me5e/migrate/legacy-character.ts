/**
 * The live site's own character migrations (`store/character/migrator.js`),
 * ported line for line: characters saved before cbVersion 1.0.2 are brought
 * to 1.0.2 exactly as the old site would on load. The 1.0.2 → engine model
 * step is `character.ts`.
 */
type Rec = Record<string, any> // eslint-disable-line @typescript-eslint/no-explicit-any -- old untyped character JSON

export const LEGACY_VERSIONS = ['1.0.1', '1.0.2'] as const
export const LEGACY_CURRENT = '1.0.2'

const CLASS_ASI: Record<string, number[]> = {
  adept: [4, 8, 12, 16, 19],
  engineer: [4, 8, 12, 16, 19],
  infiltrator: [4, 8, 10, 12, 16, 19],
  sentinel: [4, 8, 12, 16, 19],
  soldier: [4, 6, 8, 12, 14, 16, 19],
  vanguard: [4, 8, 12, 16, 19],
}

const SUBGROUND_LIMITS: Record<string, string> = {
  artisan: '[{"attr":"id","value":["BG_armorsmith","BG_brewer","BG_chemist","BG_cook","BG_mechanic","BG_painter","BG_tailor","BG_weaponsmith"]}]',
  criminal: '[{"attr":"id","value":["BG_assassin","BG_blackmailer","BG_fence","BG_gambler","BG_gang-member","BG_pickpocket","BG_smuggler","BG_thief"]}]',
  scholar: '[{"attr":"id","value":["BG_chemistry","BG_astronomy","BG_engineering","BG_physics","BG_computer-science","BG_biology","BG_philosophy","BG_general-studies"]}]',
}

export function toV101(c: Rec): Rec {
  c.meta = { remote: false, version: '1.0.1' }
  return c
}

export function toV102(c: Rec, now = new Date().toISOString()): Rec {
  c.meta.version = '1.0.2'
  c.selected = []
  c.subspecies = null
  c.options = { tashas: false }
  c.currentStats.credits = c.credits
  delete c.credits
  c.currentStats.omnigel = c.omnigel
  delete c.omnigel
  c.currentStats.medigel = c.medigel
  c.currentStats.renegade = 0
  c.currentStats.paragon = 0
  c.currentStats.resources = []

  const abilityScores: Rec = {}
  for (const key of ['str', 'dex', 'con', 'int', 'wis', 'cha']) abilityScores[key] = { value: null, other: null, override: null }
  const method = c.abilityScores.genMethod.value
  for (const [key, score] of Object.entries(c.abilityScores[method] ?? {})) {
    abilityScores[key].value = score
    if (c.abilityScores.other?.[key]) abilityScores[key].other = Number.parseInt(c.abilityScores.other[key], 10) || null
    if (c.abilityScores.override?.[key]) abilityScores[key].override = Number.parseInt(c.abilityScores.override[key], 10) || null
  }
  c.options.asiGenMethod = method
  c.abilityScores = abilityScores

  for (const fs of c.fightingStyles ?? []) {
    const klassId = fs.id.split('-').slice(-1)
    c.selected.push({ path: `klass/${klassId}/fighting-style-${klassId}/fighting-styles`, value: [{ type: 'fighting-styles', value: `FS_${fs.name.toLowerCase().replaceAll(' ', '-')}` }] })
  }
  delete c.fightingStyles

  for (const klass of c.classes) {
    klass.asi = {}
    for (const level of CLASS_ASI[klass.id] ?? []) klass.asi[level] = null
    for (const selection of c.selections ?? []) {
      if (!selection.source.startsWith(`klass-${klass.id}`)) continue
      if (selection.type === 'profs' && selection.value.length) {
        c.selected.push({ path: `klass/${klass.id}/${selection.subType}`, value: selection.value.map((i: unknown) => ({ type: selection.subType, value: i })) })
      }
      const level = Number.parseInt(selection.source.split('-')[2], 10)
      if (Number.isNaN(level)) continue
      if (selection.type === 'abi' && selection.value.length) {
        klass.asi[level] = 'asi'
        c.selected.push({
          path: `klass/${klass.id}/${level}/asi`,
          value: selection.value.length > 1
            ? selection.value.map((i: string) => ({ type: 'asi', ability: i, amount: 1 }))
            : [{ type: 'asi', ability: selection.value[0], amount: 2 }],
        })
      }
      if (selection.type === 'feat' && selection.value.length) {
        klass.asi[level] = 'feat'
        c.selected.push({ path: `klass/${klass.id}/${level}/feats`, value: [{ type: 'feats', value: selection.value }] })
      }
    }
  }

  for (const prof of ['armor', 'weapon', 'savingThrow', 'tool']) {
    const p = (c.selections ?? []).find((i: Rec) => i.source === `custom-${prof}`)
    c.settings[prof] = p?.value || []
  }

  if (c.background) {
    const stuff = (c.selections ?? []).filter((i: Rec) => i.source.startsWith(`background-${c.background}`))
    const basePath = `background/${c.background}`
    const limit = SUBGROUND_LIMITS[c.background]
    if (limit) c.selected.push(...subgrounds(basePath, stuff, limit))
    else {
      for (const s of stuff) {
        if (s.value?.length) c.selected.push({ path: `${basePath}/${s.subType}`, value: s.value.map((i: unknown) => ({ type: s.subType, value: i })) })
      }
    }
  }

  const equipment: Rec[] = []
  if (c.medigel && c.medigel > 0) equipment.push({ id: 'medi-gel', notes: '', subType: 'medi_gel', type: 'gear', uses: c.medigel, uuid: `medi-gel_${now}` })
  // The live code read `character.omnigel` after deleting it, so omni-gel never became an item;
  // it stayed in `currentStats.omnigel`, and `character.ts` turns it into one.
  if (c.omnigel && c.omnigel > 0) equipment.push({ id: 'omni-gel', notes: '', subType: 'omni-gel', type: 'gear', uses: c.omnigel, uuid: `omni-gel_${now}` })
  for (const eq of c.equipment ?? []) {
    if (eq.type === 'weapon') {
      const { stats, ...rest } = eq
      equipment.push({ ...rest, overrides: stats })
    }
    else if (eq.type === 'armor' && eq.custom) {
      const { stats, ...rest } = eq
      equipment.push({ ...rest, custom: { ...eq.custom, ...stats } })
    }
    else equipment.push(eq)
  }
  c.equipment = equipment
  delete c.selections

  c.currentStats = {
    ...c.currentStats,
    resources: { ...c.featuresTimesUsed },
    paragon: 0,
    renegade: 0,
    shieldsLost: c.settings.shields - (c.currentStats.shields?.value || 0),
    barrier: {
      used: c.currentStats.featuresTimesUsed?.barrier || c.currentStats.barrier?.used,
      ticksUsed: c.currentStats.barrier?.ticksUsed,
    },
  }
  c.settings = { ...c.settings, skill: c.settings.skills, hp: 0, powercasting: {} }
  delete c.settings.skills
  delete c.settings.power
  return c
}

function subgrounds(basePath: string, stuff: Rec[], limit: string) {
  const out: Rec[] = []
  for (const bgs of stuff) {
    const [, , oldSubground, subground, swsProfType] = bgs.source.split('-')
    if (oldSubground && !subground) out.push({ path: `${basePath}/subgrounds`, value: [{ value: `BG_${bgs.value}`, type: 'subgrounds', limit }] })
    if (subground && !swsProfType && ['skill', 'tool'].includes(bgs.subType) && bgs.value?.length) {
      out.push({ path: `${basePath}/subgrounds/BG_${subground.replace('_', '-')}/${swsProfType}`, value: bgs.value.map((i: unknown) => ({ type: swsProfType, value: i })) })
    }
    if (swsProfType && bgs.value?.length) {
      out.push({ path: `${basePath}/subgrounds/BG_${subground.replace('_', '-')}/${swsProfType}`, value: bgs.value.map((i: unknown) => ({ type: swsProfType, value: i })) })
    }
  }
  return out
}

/** Runs the old migrations a character needs (the live `migrate` action). Throws where the old site returned false. */
export function legacyMigrate(character: Rec, now?: string): Rec {
  let c = structuredClone(character)
  if (!c.meta?.version) c = toV101(c)
  const from = LEGACY_VERSIONS.indexOf(c.meta.version)
  if (from < 0) throw new Error(`unknown legacy character version ${JSON.stringify(c.meta.version)}`)
  for (let i = from + 1; i < LEGACY_VERSIONS.length; i++) {
    if (LEGACY_VERSIONS[i] === '1.0.2') c = toV102(c, now)
  }
  return c
}
