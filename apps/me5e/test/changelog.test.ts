import { describe, expect, it } from 'vitest'
import { isJoke, latestVersion } from '../app/utils/changelog'

describe('ME5e changelog', () => {
  it('names the newest release, ignoring posts that are not releases', () => {
    expect(latestVersion([
      { stem: 'changelog/1-4-3', title: 'v1.4.3', date: '2022-10-01' },
      { stem: 'changelog/1-4-4', title: 'v1.4.4', date: '2023-01-01' },
      { stem: 'changelog/april-fools-2023', title: 'v100.N7.314', date: '2023-04-01' },
    ])).toBe('v1.4.4')
    expect(latestVersion([])).toBe('')
  })

  it('keeps the April Fools\' posts off the list', () => {
    expect(isJoke('april-fools-2022')).toBe(true)
    expect(isJoke('1-4-4')).toBe(false)
  })
})
