import type { LegacyContext } from '@omnibrew/engine/schemas'

/**
 * Maps today's masseffect-5e-data records onto the engine shape, in memory.
 * Each `ctx.note` is one change the content migration has to make for real.
 */
type Rec = Record<string, unknown>

const ARMOR_PIECES = new Set(['head', 'chest', 'arms', 'legs'])

/** Copy of `rec` without `keys`. */
function omit(rec: Rec, ...keys: string[]): Rec {
  return Object.fromEntries(Object.entries(rec).filter(([k]) => !keys.includes(k)))
}

function rename(rec: Rec, from: string, to: string, ctx: LegacyContext, rule: string): Rec {
  if (!(from in rec)) return rec
  ctx.note(rule, `\`${from}\` is \`${to}\``, [from])
  return { ...omit(rec, from), [to]: rec[from] }
}

export function meLegacy(input: Rec, ctx: LegacyContext): Rec {
  let rec: Rec = { ...input }
  switch (ctx.collection) {
    case 'powers': {
      rec = rename(rec, 'type', 'powerType', ctx, 'power-type-field')
      rec = rename(rec, 'mechanics', 'casting', ctx, 'power-casting-field')
      if (Array.isArray(rec.advancements)) {
        rec.advancements = rec.advancements.map((a: unknown) =>
          a && typeof a === 'object' && 'mechanics' in a ? { ...omit(a as Rec, 'mechanics'), casting: (a as Rec).mechanics } : a)
      }
      break
    }
    case 'weapons': {
      rec = rename(rec, 'type', 'weaponType', ctx, 'item-type-field')
      rec = rename(rec, 'addDamages', 'additionalDamage', ctx, 'weapon-additional-damage')
      const raw = Array.isArray(rec.properties) ? rec.properties : []
      if (raw.some(p => typeof p === 'string')) {
        ctx.note('weapon-property-objects', 'weapon properties become `{ id, value? }` objects', ['properties'])
      }
      const props = raw.map(p => (typeof p === 'string' ? { id: p } : p) as Rec)
      if ('heat' in rec) {
        if (typeof rec.heat === 'number') props.push({ id: 'heat', value: rec.heat })
        ctx.note('weapon-heat-property', '`heat: n` becomes the property `{ id: heat, value: n }`', ['heat'])
      }
      if ('versatile' in rec) {
        const existing = props.find(p => p.id === 'versatile')
        if (existing) existing.value = rec.versatile
        else props.push({ id: 'versatile', value: rec.versatile })
        ctx.note('weapon-versatile-property', '`versatile` damage moves into the versatile property value', ['versatile'])
      }
      rec = { ...omit(rec, 'heat', 'versatile'), properties: props }
      break
    }
    case 'armor': {
      rec = rename(rec, 'type', 'armorType', ctx, 'item-type-field')
      const placement = rec.placement
      ctx.note('armor-coverage', '`placement` becomes `coverage: suit` (body_armor) or `coverage: piece` + `slot`', ['placement'])
      rec = omit(rec, 'placement')
      if (placement === 'body_armor') rec.coverage = 'suit'
      else rec = { ...rec, coverage: 'piece', slot: ARMOR_PIECES.has(placement as string) ? placement : placement }
      break
    }
    case 'gear':
      rec = rename(rec, 'type', 'gearType', ctx, 'item-type-field')
      break
    case 'mods':
      rec = rename(rec, 'type', 'modType', ctx, 'item-type-field')
      break
  }
  return rec
}
