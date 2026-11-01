import type { ResolvedCard, Sheet, SheetCard } from '@omnibrew/engine/rules'

/**
 * The open character's sheet for sheet components: the computed `Sheet` (never a
 * second computation in components), whether the viewer may change it, and `apply`
 * for actions (rules/actions.ts). Only used under the sheet and builder pages, which
 * render their content once the character is ready.
 */
export function useSheet() {
  const store = useCharacterStore()
  const sheet = computed(() => store.sheet as Sheet)
  const character = computed(() => sheet.value.character)
  return { store, sheet, character, editable: computed(() => store.editable), apply: store.apply }
}

/** Which of the sheet's dialogs and side panels is open (one at a time). */
export const useSheetUi = defineStore('sheetUi', () => {
  const panel = ref<string | null>(null)
  const arg = shallowRef<unknown>(null)
  function open(name: string, value: unknown = null) {
    arg.value = value
    panel.value = name
  }
  function close() {
    panel.value = null
  }
  const model = (name: string) => computed({
    get: () => panel.value === name,
    set: (v: boolean) => (v ? open(name) : close()),
  })
  return { panel, arg, open, close, model }
})

/** Extra damage dice on a crit (weapon augments put `addCritDie` on the first damage roll). */
export const critDie = (card: SheetCard) => Number((card.damage as Array<{ addCritDie?: unknown }> | undefined)?.[0]?.addCritDie) || 0

export type RollMode = 'advantage' | 'disadvantage' | null

/** An attack waiting for the roll dialog (B62: options to answer, advantage to pick). */
export interface PendingAttack {
  card: SheetCard
  label: string
  mode: RollMode
}

/**
 * Rolling from the sheet (plan/24 §1.5): checks, saves and skills; attacks, which
 * offer their damage next (doubled on a crit); damage; custom notation. Attacks with
 * per-attack options open the roll dialog first. Each roll shows as a toast and goes
 * to the character's roll log.
 */
export function useSheetRolls() {
  const rolls = useRollStore()
  const ui = useSheetUi()
  const toast = useToast()
  const { t } = useI18n()

  function show(entry: RollEntry) {
    const dice = entry.dice.map(d => (d.dropped ? `(${d.value})` : String(d.value))).join(', ')
    const crit = entry.crit ? ` · ${t('sheet.roll.crit')}` : entry.fumble ? ` · ${t('sheet.roll.fumble')}` : ''
    toast.add({
      id: `roll-${entry.id}`,
      title: `${entry.label}: ${entry.total}`,
      description: `${t(`sheet.roll.kind.${entry.kind}`)} · ${entry.notation}${dice ? ` [${dice}]` : ''}${crit}`,
      icon: 'i-lucide-dices',
      color: entry.crit ? 'success' : entry.fumble ? 'error' : 'primary',
      ...(entry.damage
        ? { actions: [{ label: entry.crit ? t('sheet.roll.crit_damage') : t('sheet.roll.damage'), icon: 'i-lucide-swords', color: 'primary' as const, variant: 'outline' as const, onClick: () => damage(entry.label, entry.damage!.damages, { crit: entry.crit, addCritDie: entry.damage!.addCritDie }) }] }
        : {}),
    })
  }

  /** A d20 roll with a bonus: ability check, save, skill, initiative. */
  function check(label: string, bonus: number, kind: string, mode: RollMode = null) {
    show(rolls.roll({ label, kind, notation: `1d20${signed(bonus)}`, advantage: mode }))
  }

  /** Rolls a resolved card's attack; its damage follows from the toast or log. */
  function rollAttack(label: string, resolved: ResolvedCard, mode: RollMode, addCritDie = 0) {
    if (!resolved.hit) return
    const damages = resolved.damages ?? []
    show(rolls.roll({
      label,
      kind: 'attack',
      notation: `1d20${signed(resolved.hit.bonus)}`,
      advantage: mode,
      ...(damages.length ? { damage: { damages, crit: resolved.hit.crit, addCritDie } } : {}),
    }, resolved.hit.crit))
  }

  /**
   * Attacks with a card: straight away, or through the roll dialog when the card asks
   * per-attack questions (`ask` augments) or the player wants to choose advantage.
   */
  function attack(sheet: Sheet, card: SheetCard, mode: RollMode = null, dialog = false) {
    const label = card.name ?? t('sheet.roll.kind.attack')
    if (dialog || (card.options as unknown[] | undefined)?.length) {
      ui.open('roll-dialog', { card, label, mode } satisfies PendingAttack)
      return
    }
    rollAttack(label, sheet.card(card), mode, critDie(card))
  }

  function damage(label: string, damages: DamageSpec[], options: { crit?: boolean, addCritDie?: number } = {}) {
    if (!damages.length) return
    show(rolls.rollDamage(label, damages, options))
  }

  function custom(notation: string, label = t('sheet.roll.custom')) {
    show(rolls.roll({ label, kind: 'custom', notation }))
  }

  return { check, attack, rollAttack, damage, custom, show }
}
