import { coreEffect, homebrewEffect as effect, homebrewField as f, type FieldGroup, type HomebrewDefinition } from '@omnibrew/engine/schemas'

/**
 * What ME5e players write as homebrew (plan/26 §1.3): weapons, armor, gear, mods, powers
 * and feats, with forms close to the live editor's tabs, and the effects "Add effect"
 * offers: the core ones plus ME's shields and capacities. Labels: `homebrew.*` in the
 * content repo's messages/en.yml.
 */
const basics = (extra: ReturnType<typeof f>[] = []): FieldGroup => ({
  title: 'homebrew.tabs.basics',
  fields: [
    f('name', 'homebrew.fields.name', { kind: 'text' }, { required: true }),
    ...extra,
    f('rarity', 'homebrew.fields.rarity', { kind: 'enum', enum: 'rarities', labels: 'rarities.{v}' }),
    f('cost', 'homebrew.fields.cost', { kind: 'number', min: 0, step: 100 }),
    f('weight', 'homebrew.fields.weight', { kind: 'number', min: 0, step: 0.5 }),
    f('image', 'homebrew.fields.image', { kind: 'text', placeholder: 'https://…' }, { help: 'homebrew.fields.image_help' }),
    f('flavor', 'homebrew.fields.flavor', { kind: 'text', long: true }),
  ],
})
const description: FieldGroup = { title: 'homebrew.tabs.description', fields: [f('body', 'homebrew.fields.body', { kind: 'markdown' }, { help: 'homebrew.fields.body_help' })] }
const effects: FieldGroup = { title: 'homebrew.tabs.effects', fields: [f('mechanics', 'homebrew.fields.effects', { kind: 'effects' }, { help: 'homebrew.fields.effects_help' })] }

export const meHomebrew: HomebrewDefinition = {
  kinds: [
    {
      collection: 'weapons',
      icon: 'i-lucide-crosshair',
      defaults: () => ({ name: '', weaponType: 'heavy_pistol', rarity: 'common', cost: 1000, weight: 1, damage: { dieCount: 1, dieType: 4, type: 'piercing' }, range: { short: 30, long: 90 }, properties: [{ id: 'heat', value: 4 }], slots: 1 }),
      groups: [
        basics([f('weaponType', 'homebrew.fields.weapon_type', { kind: 'enum', enum: 'weaponTypes', labels: 'weapon_types.{v}' }, { required: true })]),
        {
          title: 'homebrew.tabs.attack',
          fields: [
            f('damage.dieCount', 'homebrew.fields.die_count', { kind: 'number', min: 0, max: 20 }, { required: true }),
            f('damage.dieType', 'homebrew.fields.die_type', { kind: 'choice', options: [4, 6, 8, 10, 12], labels: 'homebrew.dice.d{v}' }, { required: true }),
            f('damage.type', 'homebrew.fields.damage_type', { kind: 'enum', enum: 'damageTypes', labels: 'damage_types.{v}' }, { required: true }),
            f('additionalDamage', 'homebrew.fields.additional_damage', { kind: 'damage-list', max: 2 }),
            f('range.short', 'homebrew.fields.range_short', { kind: 'number', min: 0, step: 5 }, { required: true }),
            f('range.long', 'homebrew.fields.range_long', { kind: 'number', min: 0, step: 5 }),
            f('properties', 'homebrew.fields.properties', { kind: 'properties', collection: 'weapon-properties' }, { help: 'homebrew.fields.properties_help' }),
            f('slots', 'homebrew.fields.slots', { kind: 'number', min: 0, max: 4 }, { help: 'homebrew.fields.slots_help' }),
            f('andromeda', 'homebrew.fields.andromeda', { kind: 'boolean' }),
          ],
        },
        effects,
        description,
      ],
    },
    {
      collection: 'armor',
      icon: 'i-lucide-shield',
      defaults: () => ({ name: '', coverage: 'piece', slot: 'chest', armorType: 'light', rarity: 'common', cost: 1000, mechanics: [{ type: 'ac', bonus: { type: 'flat', value: 1 } }] }),
      groups: [
        basics([
          f('coverage', 'homebrew.fields.coverage', { kind: 'choice', options: ['piece', 'suit'], labels: 'homebrew.coverage.{v}' }, { required: true }),
          f('slot', 'homebrew.fields.slot', { kind: 'enum', enum: 'armorSlots', labels: 'armor_placements.{v}' }, { required: true, when: { path: 'coverage', is: ['piece'] } }),
          f('ac.base', 'homebrew.fields.base_ac', { kind: 'number', min: 0, max: 30 }, { when: { path: 'coverage', is: ['suit'] } }),
          f('armorType', 'homebrew.fields.armor_type', { kind: 'enum', enum: 'armorTypes', labels: 'armor_types.{v}' }, { required: true }),
          f('stealthDisadvantage', 'homebrew.fields.stealth_disadvantage', { kind: 'boolean' }),
          f('andromeda', 'homebrew.fields.andromeda', { kind: 'boolean' }),
        ]),
        effects,
        description,
      ],
    },
    {
      collection: 'gear',
      icon: 'i-lucide-backpack',
      defaults: () => ({ name: '', gearType: 'tool', rarity: 'common', cost: 100, weight: 1 }),
      groups: [
        basics([
          f('gearType', 'homebrew.fields.gear_type', { kind: 'enum', enum: 'gearTypes', labels: 'gear_types.{v}' }, { required: true }),
          f('consumable', 'homebrew.fields.consumable', { kind: 'boolean' }),
          f('equippable', 'homebrew.fields.equippable', { kind: 'boolean' }),
        ]),
        effects,
        description,
      ],
    },
    {
      collection: 'mods',
      icon: 'i-lucide-cpu',
      defaults: () => ({ name: '', modType: 'weapon', placement: 'barrel', availability: ['heavy_pistol'], rarity: 'common', cost: 1000 }),
      groups: [
        basics([
          f('modType', 'homebrew.fields.mod_type', { kind: 'choice', options: ['weapon', 'armor'], labels: 'homebrew.mod_type.{v}' }, { required: true }),
          f('placement', 'homebrew.fields.placement', { kind: 'enum', enum: 'modPlacements', labels: 'mod_placements.{v}' }, { required: true }),
          f('availability', 'homebrew.fields.availability', { kind: 'enum', enum: 'weaponTypes', multiple: true, labels: 'weapon_types.{v}' }, { required: true, when: { path: 'modType', is: ['weapon'] } }),
          f('availability', 'homebrew.fields.availability', { kind: 'enum', enum: 'armorTypes', multiple: true, labels: 'armor_types.{v}' }, { required: true, when: { path: 'modType', is: ['armor'] } }),
        ]),
        effects,
        description,
      ],
    },
    {
      collection: 'powers',
      icon: 'i-lucide-flame',
      defaults: () => ({
        name: '',
        level: 1,
        powerType: 'biotic',
        classes: ['adept'],
        casting: [{ castingTime: { length: 1, unit: 'action' }, duration: { length: 0, unit: 'instant' }, concentration: false, range: { short: 60 } }],
      }),
      groups: [
        {
          title: 'homebrew.tabs.basics',
          fields: [
            f('name', 'homebrew.fields.name', { kind: 'text' }, { required: true }),
            f('powerType', 'homebrew.fields.power_type', { kind: 'enum', enum: 'powerTypes', labels: 'power_types.{v}' }, { required: true }),
            f('level', 'homebrew.fields.level', { kind: 'number', min: 0, max: 5 }, { required: true, help: 'homebrew.fields.level_help' }),
            f('classes', 'homebrew.fields.classes', { kind: 'record', collection: 'classes', multiple: true }, { required: true }),
            f('tags', 'homebrew.fields.tags', { kind: 'enum', enum: 'powerTags', multiple: true, labels: 'tags.{v}' }),
          ],
        },
        {
          title: 'homebrew.tabs.casting',
          fields: [
            f('casting.0.castingTime.unit', 'homebrew.fields.casting_time', { kind: 'enum', enum: 'timeUnits', labels: 'times.{v}_title' }, { required: true }),
            f('casting.0.duration.length', 'homebrew.fields.duration_length', { kind: 'number', min: 0 }),
            f('casting.0.duration.unit', 'homebrew.fields.duration_unit', { kind: 'enum', enum: 'timeUnits', labels: 'times.{v}_title' }, { required: true }),
            f('casting.0.concentration', 'homebrew.fields.concentration', { kind: 'boolean' }),
            f('casting.0.range.short', 'homebrew.fields.range', { kind: 'number', min: 0, step: 5 }),
            f('casting.0.range.aoe.type', 'homebrew.fields.aoe_type', { kind: 'enum', enum: 'aoeShapes', labels: 'aoe_types.{v}' }),
            f('casting.0.range.aoe.size', 'homebrew.fields.aoe_size', { kind: 'number', min: 0, step: 5 }),
          ],
        },
        {
          title: 'homebrew.tabs.attack',
          fields: [
            f('casting.0.attack', 'homebrew.fields.attack', { kind: 'attack' }),
            f('casting.0.dc', 'homebrew.fields.save', { kind: 'save' }),
            f('casting.0.damage', 'homebrew.fields.damage', { kind: 'damage-list', max: 3 }),
            f('casting.0.conditions', 'homebrew.fields.conditions', { kind: 'record', collection: 'conditions', multiple: true }),
            f('casting.0.primes', 'homebrew.fields.primes', { kind: 'enum', enum: 'damageTypes', labels: 'damage_types.{v}' }, { help: 'homebrew.fields.primes_help' }),
            f('casting.0.detonates', 'homebrew.fields.detonates', { kind: 'boolean' }),
            f('casting.0.resource', 'homebrew.fields.uses', { kind: 'resource' }),
          ],
        },
        { title: 'homebrew.tabs.upcasts', fields: [f('casting', 'homebrew.fields.upcasts', { kind: 'upcasts' }, { help: 'homebrew.fields.upcasts_help' })] },
        { title: 'homebrew.tabs.advancements', fields: [f('advancements', 'homebrew.fields.advancements', { kind: 'advancements' }, { help: 'homebrew.fields.advancements_help' })] },
        description,
      ],
    },
    {
      collection: 'feats',
      icon: 'i-lucide-award',
      defaults: () => ({ name: '', mechanics: [] }),
      groups: [
        {
          title: 'homebrew.tabs.basics',
          fields: [
            f('name', 'homebrew.fields.name', { kind: 'text' }, { required: true }),
            f('prerequisite', 'homebrew.fields.prerequisite', { kind: 'text' }, { help: 'homebrew.fields.prerequisite_help' }),
            f('note', 'homebrew.fields.note', { kind: 'text', long: true }),
          ],
        },
        effects,
        description,
      ],
    },
  ],
  effects: [
    ...['asi', 'ac', 'hp', 'resistance', 'immunity', 'vulnerability', 'condition-immunity', 'critical-immunity', 'evasion'].map(coreEffect),
    effect('me:shields', 'homebrew.effect_groups.defenses', [
      f('capacity', 'homebrew.effects.me_shields.capacity', { kind: 'formula' }),
      f('regen', 'homebrew.effects.me_shields.regen', { kind: 'formula' }),
    ], () => ({ capacity: { type: 'flat', value: 5 }, regen: { type: 'flat', value: 5 } })),
    ...['saving-throw', 'skill', 'skill-check', 'initiative', 'speed', 'speed-bonus', 'sense', 'attack-augment', 'adjust-weapon-props'].map(coreEffect),
    effect('me:weapon-heat-increase', 'homebrew.effect_groups.attacks', [f('value', 'homebrew.effects.me_weapon-heat-increase.value', { kind: 'number', min: 1 }, { required: true })], () => ({ value: 2 })),
    ...(['me:thermal-clip-capacity', 'me:medi-gel-capacity', 'me:grenade-capacity'] as const).map(type =>
      effect(type, 'homebrew.effect_groups.equipment', [f('value', `homebrew.effects.${type.replace(':', '_')}.value`, { kind: 'number', min: 0 }, { required: true })], () => ({ value: 1 }))),
    effect('me:shoulder-mounts', 'homebrew.effect_groups.equipment', [
      f('max', 'homebrew.effects.me_shoulder-mounts.max', { kind: 'number', min: 1 }, { required: true }),
      f('slots', 'homebrew.effects.me_shoulder-mounts.slots', { kind: 'number', min: 1 }, { required: true }),
    ], () => ({ max: 1, slots: 2 })),
    ...['action', 'bonus-action', 'reaction', 'other'].map(coreEffect),
  ],
}
