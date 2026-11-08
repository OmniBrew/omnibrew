import { describe, expect, it } from 'vitest'
import { cardImage } from '../schemas'

describe('cardImage', () => {
  it('uses thumbnail, then img, for collections the game does not name', () => {
    expect(cardImage({}, 'species', { img: '/a.png' })).toBe('/a.png')
    expect(cardImage({}, 'species', { thumbnail: '/t.webp', img: '/a.png' })).toBe('/t.webp')
    expect(cardImage({}, 'species', { bodyImg: '/b.png' })).toBe('')
  })

  it('reads the fields a game names, in order, skipping empty ones', () => {
    const def = { cardImage: { species: ['thumbnail', 'bodyImg', 'img'] } }
    expect(cardImage(def, 'species', { thumbnail: '', bodyImg: '/b.png', img: '/a.png' })).toBe('/b.png')
    expect(cardImage(def, 'species', null)).toBe('')
  })
})
