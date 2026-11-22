import { describe, expect, it } from 'vitest'
import { uniqueAnchors } from '../app/utils/anchors'

const heading = (id: string) => ['h3', { id }, id]

describe('uniqueAnchors', () => {
  it('renames heading ids that repeat a section id, keeping section ids', () => {
    const sections = [
      { id: 'skills', record: { body: { type: 'minimark', value: [heading('strength'), ['p', {}, 'Athletics'], heading('dexterity')] } } },
      { id: 'strength', record: { body: { type: 'minimark', value: [heading('strength-checks')] } } },
      { id: 'dexterity', record: { body: { type: 'minimark', value: [] } } },
    ]
    const out = uniqueAnchors(sections)
    expect(out.map(s => s.id)).toEqual(['skills', 'strength', 'dexterity'])
    expect(out[0]!.record.body.value).toEqual([['h3', { id: 'skills-strength' }, 'strength'], ['p', {}, 'Athletics'], ['h3', { id: 'skills-dexterity' }, 'dexterity']])
    expect(out[1]!.record.body.value).toEqual([heading('strength-checks')])
    // The input is not changed.
    expect(sections[0]!.record.body.value[0]).toEqual(heading('strength'))
  })

  it('renames a heading that repeats an earlier heading, in MDC element trees too', () => {
    const el = (id: string) => ({ type: 'element', tag: 'h2', props: { id }, children: [{ type: 'text', value: id }] })
    const out = uniqueAnchors([
      { id: 'a', record: { body: { type: 'root', children: [el('systems')] } } },
      { id: 'b', record: { body: { type: 'root', children: [el('systems'), { type: 'element', tag: 'p', props: { id: 'systems' }, children: [] }] } } },
    ])
    expect(out[0]!.record.body.children[0].props.id).toBe('systems')
    expect(out[1]!.record.body.children[0].props.id).toBe('b-systems')
    // Only headings are renamed.
    expect(out[1]!.record.body.children[1].props.id).toBe('systems')
  })

  it('leaves sections without a body alone', () => {
    const s = { id: 'x' }
    expect(uniqueAnchors([s])[0]).toBe(s)
  })
})
