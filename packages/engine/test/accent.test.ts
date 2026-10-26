import { describe, expect, it } from 'vitest'
import { sheetAccent } from '../app/utils/accent'

const theme = { accents: ['alliance', 'adept', 'soldier'], defaultAccent: 'alliance' }

describe('sheet accent', () => {
  it('uses the player\'s pick when the theme has it', () => {
    expect(sheetAccent({ sheetColor: 'soldier', classes: [{ id: 'adept' }] }, theme)).toBe('soldier')
  })

  it('matches the first class when there is no pick, or an unknown one', () => {
    expect(sheetAccent({ classes: [{ id: 'adept' }, { id: 'soldier' }] }, theme)).toBe('adept')
    expect(sheetAccent({ sheetColor: 'gone', classes: [{ id: 'soldier' }] }, theme)).toBe('soldier')
  })

  it('falls back to the default for a class without an accent, or no class', () => {
    expect(sheetAccent({ classes: [{ id: 'homebrew-class' }] }, theme)).toBe('alliance')
    expect(sheetAccent({ classes: [] }, theme)).toBe('alliance')
    expect(sheetAccent({}, { ...theme, defaultAccent: 'missing' })).toBe('alliance')
  })

  it('leaves the sheet alone when the game has no accents', () => {
    expect(sheetAccent({ sheetColor: 'adept', classes: [{ id: 'adept' }] }, { accents: [], defaultAccent: '' })).toBeUndefined()
  })
})
