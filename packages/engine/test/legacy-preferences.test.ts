import { describe, expect, it } from 'vitest'
import { importLegacyPreferences } from '../app/utils/legacy-preferences'

const keys = { preferences: 'omnibrew:preferences', colorMode: 'nuxt-color-mode', flag: 'omnibrew:legacy-preferences' }
const store = (init: Record<string, string> = {}) => {
  const m = new Map(Object.entries(init))
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), m }
}
const config = { key: 'v140', imperial: 'user.imperial', darkMode: 'user.darkMode' }

describe('importLegacyPreferences (plan/28 §2)', () => {
  it('brings the old site\'s units and color mode over once', () => {
    const s = store({ v140: JSON.stringify({ user: { imperial: true, darkMode: false } }) })
    expect(importLegacyPreferences(config, s, keys)).toEqual({ units: 'imperial', colorMode: 'light' })
    expect(s.m.get('omnibrew:preferences')).toBe('{"units":"imperial"}')
    expect(s.m.get('nuxt-color-mode')).toBe('light')
    s.m.delete('omnibrew:preferences')
    expect(importLegacyPreferences(config, s, keys)).toEqual({})
  })

  it('never replaces units chosen on this site; color mode applies over the module default', () => {
    const s = store({ 'v140': JSON.stringify({ user: { imperial: true, darkMode: false } }), 'omnibrew:preferences': '{"units":"metric"}', 'nuxt-color-mode': 'dark' })
    expect(importLegacyPreferences(config, s, keys)).toEqual({ colorMode: 'light' })
  })

  it('does nothing without a config, an old key, or readable data', () => {
    expect(importLegacyPreferences(null, store(), keys)).toEqual({})
    expect(importLegacyPreferences(config, store(), keys)).toEqual({})
    expect(importLegacyPreferences(config, store({ v140: '{oops' }), keys)).toEqual({})
  })
})
