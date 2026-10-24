/**
 * Field renames from the pre-2026 masseffect-5e-data shape to the engine shape
 * (plan/04 R6). This was the validator's in-memory "legacy adapter"; it now runs
 * once, in the migration. Each `ctx.note` names one kind of change, for the
 * migration's summary. Renamed keys keep their position in the record.
 */
type Rec = Record<string, unknown>

export interface LegacyContext {
  collection: string
  note: (rule: string, message: string) => void
}

const ARMOR_PIECES = new Set(['head', 'chest', 'arms', 'legs'])

/** Copy of `rec` without `keys`. */
function omit(rec: Rec, ...keys: string[]): Rec {
  return Object.fromEntries(Object.entries(rec).filter(([k]) => !keys.includes(k)))
}

/** Replaces `key` with `entries`, in place. */
function replaceKey(rec: Rec, key: string, entries: Rec): Rec {
  const out: Rec = {}
  for (const [k, v] of Object.entries(rec)) {
    if (k === key) Object.assign(out, entries)
    else out[k] = v
  }
  return out
}

function rename(rec: Rec, from: string, to: string, ctx: LegacyContext, rule: string): Rec {
  if (!(from in rec)) return rec
  ctx.note(rule, `\`${from}\` is \`${to}\``)
  return replaceKey(rec, from, { [to]: rec[from] })
}

export function meLegacy(input: Rec, ctx: LegacyContext): Rec {
  let rec: Rec = { ...input }
  switch (ctx.collection) {
    case 'powers': {
      rec = rename(rec, 'type', 'powerType', ctx, 'power-type-field')
      rec = rename(rec, 'mechanics', 'casting', ctx, 'power-casting-field')
      if (Array.isArray(rec.advancements)) {
        rec.advancements = rec.advancements.map((a: unknown) =>
          a && typeof a === 'object' && 'mechanics' in a ? rename(a as Rec, 'mechanics', 'casting', ctx, 'power-advancement-casting-field') : a)
      }
      break
    }
    case 'weapons': {
      rec = rename(rec, 'type', 'weaponType', ctx, 'item-type-field')
      rec = rename(rec, 'addDamages', 'additionalDamage', ctx, 'weapon-additional-damage')
      const raw = Array.isArray(rec.properties) ? rec.properties : []
      if (raw.some(p => typeof p === 'string')) {
        ctx.note('weapon-property-objects', 'weapon properties become `{ id, value? }` objects')
      }
      const props = raw.map(p => (typeof p === 'string' ? { id: p } : p) as Rec)
      if ('heat' in rec) {
        if (typeof rec.heat === 'number') props.push({ id: 'heat', value: rec.heat })
        ctx.note('weapon-heat-property', '`heat: n` becomes the property `{ id: heat, value: n }`')
      }
      if ('versatile' in rec) {
        const existing = props.find(p => p.id === 'versatile')
        if (existing) existing.value = rec.versatile
        else props.push({ id: 'versatile', value: rec.versatile })
        ctx.note('weapon-versatile-property', '`versatile` damage moves into the versatile property value')
      }
      rec = omit({ ...rec, properties: props }, 'heat', 'versatile')
      break
    }
    case 'armor': {
      rec = rename(rec, 'type', 'armorType', ctx, 'item-type-field')
      const placement = rec.placement as string
      ctx.note('armor-coverage', '`placement` becomes `coverage: suit` (body_armor) or `coverage: piece` + `slot`')
      if (placement === 'body_armor') rec = replaceKey(rec, 'placement', { coverage: 'suit' })
      else if (ARMOR_PIECES.has(placement)) rec = replaceKey(rec, 'placement', { coverage: 'piece', slot: placement })
      else throw new Error(`armor placement "${placement}" is not body_armor, head, chest, arms or legs`)
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
