import type { Sheet } from './sheet'
import type { Rec, SheetCard } from './types'

/**
 * What the sheet's Actions tab lists, by section (the live MeCsActions): attacks,
 * actions, bonus actions, reactions and other, each a list of cards and titled groups
 * (the base actions in combat, a weapon's special attacks, powers by casting time,
 * content groups). Pure, so the page only renders it.
 */
export interface ActionGroup {
  /** i18n key, or the content's own title (`text`). */
  title: { key: string, params?: Record<string, unknown> } | { text: string }
  items: SheetCard[]
  /** `base`: rules text only (the actions in combat); `powers`: power cards. */
  kind: 'base' | 'powers' | 'cards'
}

export type ActionEntry = { card: SheetCard } | { group: ActionGroup }

export const ACTION_SECTIONS = ['attacks', 'action', 'bonus-action', 'reaction', 'other'] as const
export type ActionSection = (typeof ACTION_SECTIONS)[number]

const CASTING_UNITS: Record<string, string> = { action: 'action', attack: 'attacks', bonus_action: 'bonus-action', reaction: 'reaction' }

/** A custom feature as a card: a checkbox tracker when it has uses. */
export function customFeatureCard(f: Sheet['character']['customFeatures'][number]): SheetCard {
  return {
    name: f.name,
    type: f.type,
    html: f.html,
    custom: true,
    ...(f.uses ? { resource: { displayType: 'checkbox', reset: f.recharge || 'long', max: { type: 'flat', value: f.uses }, id: f.id } } : {}),
  }
}

export function actionSections(sheet: Sheet): Record<ActionSection, ActionEntry[]> {
  const base = sheet.content.list('actions')
  const mechanics = sheet.actions
  const weapons = sheet.weaponAttacks
  const special = sheet.rules.weapons.special ?? {}
  const custom = sheet.character.customFeatures.map(customFeatureCard)

  // Powers castable as an action, attack, bonus action or reaction: their base level only.
  const powers = sheet.powers.filter(p => !p.upcast).sort((a, b) => a.level - b.level)
  const powersBy = (section: string) => powers.filter(p => [p.castingTime?.unit, ...((p.altCasting ?? []) as Rec[]).map(a => a.unit)].some(u => CASTING_UNITS[u] === section))

  const group = (title: ActionGroup['title'], items: SheetCard[], kind: ActionGroup['kind'] = 'cards'): ActionEntry[] => (items.length ? [{ group: { title, items, kind } }] : [])
  const cards = (items: SheetCard[]): ActionEntry[] => items.map(card => ({ card }))

  /** Mechanic actions with a content group, by group title. */
  const contentGroups = (type: string): ActionEntry[] => {
    const out = new Map<string, SheetCard[]>()
    for (const m of mechanics.filter(x => x.type === type && x.group)) out.set(m.group, [...out.get(m.group) ?? [], m])
    return [...out].map(([text, items]) => ({ group: { title: { text }, items, kind: 'cards' as const } }))
  }

  const baseOf = (type: string) => {
    const extras = mechanics.filter(m => m.type === type && m.baseGroup).map(m => base.find(b => b.name === m.name) ?? m)
    return [...base.filter(b => b.type === type), ...extras]
  }

  const specialOf = (actionType: string) => Object.entries(special)
    .filter(([, s]) => (s.actionType ?? 'action') === actionType)
    .flatMap(([key]) => group({ key: `sheet.actions.special.${key}` }, weapons[key] ?? []))

  const plain = (type: string) => mechanics.filter(m => m.type === type && !m.group && !m.baseGroup)
  const game = (type: string) => sheet.gameActions.filter(a => a.type === type)

  return {
    'attacks': cards([...weapons.attacks, ...mechanics.filter(m => m.type === 'attack'), ...powersBy('attacks')]),
    'action': [
      ...group({ key: 'sheet.actions.in_combat.action' }, baseOf('action'), 'base'),
      ...specialOf('action'),
      ...group({ key: 'sheet.actions.powers' }, powersBy('action'), 'powers'),
      ...contentGroups('action'),
      ...cards([...game('action'), ...plain('action'), ...custom.filter(c => c.type === 'action')]),
    ],
    'bonus-action': [
      ...group({ key: 'sheet.actions.in_combat.bonus-action' }, baseOf('bonus-action'), 'base'),
      ...group({ key: 'sheet.actions.special.twf' }, weapons.twf),
      ...specialOf('bonus-action'),
      ...group({ key: 'sheet.actions.powers' }, powersBy('bonus-action'), 'powers'),
      ...contentGroups('bonus-action'),
      ...cards([...game('bonus-action'), ...plain('bonus-action'), ...custom.filter(c => c.type === 'bonus-action')]),
    ],
    'reaction': [
      ...group({ key: 'sheet.actions.in_combat.reaction' }, baseOf('reaction'), 'base'),
      ...group({ key: 'sheet.actions.powers' }, powersBy('reaction'), 'powers'),
      ...contentGroups('reaction'),
      ...cards([...game('reaction'), ...plain('reaction'), ...custom.filter(c => c.type === 'reaction')]),
    ],
    'other': [...contentGroups('other'), ...cards([...game('other'), ...plain('other'), ...custom.filter(c => !['action', 'bonus-action', 'reaction'].includes(c.type))])],
  }
}

/** Every toggle on the character's cards (the toggle chips over the Actions tab). */
export function sheetToggles(sheet: Sheet): Array<{ toggle: Rec, card: SheetCard }> {
  const seen = new Set<string>()
  const out: Array<{ toggle: Rec, card: SheetCard }> = []
  for (const card of [...sheet.actions, ...sheet.mechanics.filter(m => m.toggle && !sheet.actions.includes(m))]) {
    const toggle = card.toggle as Rec | undefined
    if (!toggle?.id || seen.has(toggle.id)) continue
    seen.add(toggle.id)
    out.push({ toggle, card })
  }
  return out
}
