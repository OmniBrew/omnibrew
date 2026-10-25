/**
 * The live site's custom armor pieces (`store/character/equipment.js`
 * `customArmor`): generic chest, arm, leg and head pieces a character can own
 * without picking a named armor. Arm pieces mirror the leg pieces. The sheet
 * offers them as built-in armor records, in the engine's armor shape.
 */
const CUSTOM = [
  ['ca-chest-light-2', 'Light Chest Armor II', 'uncommon', 'chest', 'light', 8000, 2],
  ['ca-chest-medium-2', 'Medium Chest Armor II', 'uncommon', 'chest', 'medium', 10000, 2],
  ['ca-chest-heavy-2', 'Heavy Chest Armor II', 'uncommon', 'chest', 'heavy', 12000, 2],
  ['ca-chest-light-3', 'Light Chest Armor III', 'rare', 'chest', 'light', 28000, 3],
  ['ca-chest-medium-3', 'Medium Chest Armor III', 'rare', 'chest', 'medium', 30000, 3],
  ['ca-chest-heavy-3', 'Heavy Chest Armor III', 'rare', 'chest', 'heavy', 32000, 3],
  ['ca-legs-light-0', 'Light Leg Armor', 'common', 'legs', 'light', 2000, 0],
  ['ca-legs-medium-0', 'Medium Leg Armor', 'common', 'legs', 'medium', 3000, 0],
  ['ca-legs-heavy-0', 'Heavy Leg Armor', 'common', 'legs', 'heavy', 4000, 0],
  ['ca-legs-light-1', 'Light Leg Armor I', 'uncommon', 'legs', 'light', 22000, 1],
  ['ca-legs-medium-1', 'Medium Leg Armor I', 'uncommon', 'legs', 'medium', 23000, 1],
  ['ca-legs-heavy-1', 'Heavy Leg Armor I', 'uncommon', 'legs', 'heavy', 24000, 1],
  ['ca-legs-light-2', 'Light Leg Armor II', 'rare', 'legs', 'light', 42000, 2],
  ['ca-legs-medium-2', 'Medium Leg Armor II', 'rare', 'legs', 'medium', 43000, 2],
  ['ca-legs-heavy-2', 'Heavy Leg Armor II', 'rare', 'legs', 'heavy', 44000, 2],
  ['ca-head-light-1', 'Light Helmet I', 'uncommon', 'head', 'light', 5000, 1],
  ['ca-head-medium-1', 'Medium Helmet I', 'uncommon', 'head', 'medium', 5000, 1],
  ['ca-head-heavy-1', 'Heavy Helmet I', 'uncommon', 'head', 'heavy', 5000, 1],
  ['ca-head-light-2', 'Light Helmet II', 'rare', 'head', 'light', 25000, 2],
  ['ca-head-medium-2', 'Medium Helmet II', 'rare', 'head', 'medium', 25000, 2],
  ['ca-head-heavy-2', 'Heavy Helmet II', 'rare', 'head', 'heavy', 25000, 2],
  ['ca-head-light-3', 'Light Helmet III', 'spectre', 'head', 'light', 45000, 3],
  ['ca-head-medium-3', 'Medium Helmet III', 'spectre', 'head', 'medium', 45000, 3],
  // The live id says 4; kept so saved characters still find it.
  ['ca-head-heavy-4', 'Heavy Helmet III', 'spectre', 'head', 'heavy', 45000, 3],
] as const

const MECHANICS: Record<string, Array<Record<string, unknown>>> = {
  chest: [
    { type: 'me:thermal-clip-capacity', value: 6 },
    { type: 'me:shields', capacity: { type: 'flat', value: 5 }, regen: { type: 'flat', value: 5 } },
    { type: 'me:medi-gel-capacity', value: 2 },
  ],
  legs: [{ type: 'me:thermal-clip-capacity', value: 2 }, { type: 'me:grenade-capacity', value: 2 }],
  arms: [{ type: 'me:thermal-clip-capacity', value: 2 }, { type: 'me:medi-gel-capacity', value: 2 }],
  head: [],
}

export function customArmor() {
  const piece = ([id, name, rarity, slot, armorType, cost, slots]: readonly [string, string, string, string, string, number, number]) => ({
    id,
    name,
    rarity,
    kind: 'armor',
    coverage: 'piece',
    slot,
    armorType,
    cost,
    slots,
    mechanics: MECHANICS[slot],
    ...(slots > 0 ? { body: `You may add ${slots} armor mod${slots > 1 ? 's' : ''} to this custom armor piece` } : {}),
  })
  const out = []
  for (const row of CUSTOM) {
    // Arm pieces come first, made from the leg pieces (as the live list did).
    if (row[3] === 'legs') out.push(piece([row[0].replace('-legs-', '-arms-'), row[1].replace(' Leg ', ' Arm '), row[2], 'arms', row[4], row[5], row[6]]))
  }
  return [...out, ...CUSTOM.map(piece)]
}
