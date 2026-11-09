import { describe, expect, it } from 'vitest'
import { pictureFileError, squareCrop } from '../app/utils/profile-picture'

describe('profile pictures', () => {
  it('crops the centered square', () => {
    expect(squareCrop(400, 300)).toEqual({ sx: 50, sy: 0, side: 300 })
    expect(squareCrop(300, 501)).toEqual({ sx: 0, sy: 100, side: 300 })
    expect(squareCrop(256, 256)).toEqual({ sx: 0, sy: 0, side: 256 })
  })

  it('takes common image types up to 10 MB', () => {
    expect(pictureFileError({ type: 'image/png', size: 1000 })).toBeNull()
    expect(pictureFileError({ type: 'image/jpeg', size: 9_000_000 })).toBeNull()
    expect(pictureFileError({ type: 'image/svg+xml', size: 1000 })).toBe('profile.picture.wrong_type')
    expect(pictureFileError({ type: 'image/png', size: 11_000_000 })).toBe('profile.picture.too_big')
  })
})
