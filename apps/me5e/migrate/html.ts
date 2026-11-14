/**
 * Live homebrew HTML → markdown (plan/28 §1.3). The live editor was Quill with bold,
 * italic, underline and both lists (`<p>`, `<strong>`, `<em>`, `<u>`, `<ol>`/`<ul>`,
 * `ql-indent-N`, `<br>`), plus `<me-distance>`/`<me-condition>` tags typed by hand; a
 * record "based on" an official one starts with the live JSON's `html` (rendered
 * markdown: paragraphs, emphasis, lists, headings, links, the odd table).
 *
 * `<me-*>` tags pass through for `legacyTagsToMdc`. Any other tag is dropped (its text
 * kept) and reported, so no raw HTML is left for `validateRecord` to refuse.
 */
const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: '\'', nbsp: ' ', ndash: '–', mdash: '—', hellip: '…', rsquo: '’', lsquo: '‘', rdquo: '”', ldquo: '“', times: '×', deg: '°' }

export function decodeEntities(text: string): string {
  return text.replace(/&(#x[\da-f]+|#\d+|[a-z]+);/gi, (m, e: string) => {
    if (e[0] === '#') {
      const code = e[1] === 'x' || e[1] === 'X' ? Number.parseInt(e.slice(2), 16) : Number.parseInt(e.slice(1), 10)
      return Number.isFinite(code) ? String.fromCodePoint(code) : m
    }
    return ENTITIES[e.toLowerCase()] ?? m
  })
}

/** Characters markdown would read as syntax at the start of a line or around text. */
const escapeText = (text: string) => text.replace(/([\\*_`[\]])/g, '\\$1')

interface List { ordered: boolean, n: number }

const MARKS: Record<string, string> = { strong: '**', b: '**', em: '*', i: '*', s: '~~', strike: '~~', del: '~~', code: '`' }

const TOKEN = /<!--[\s\S]*?-->|<(\/?)([a-z][\w-]*)((?:\s+[^\s=/>]+(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s"'>][^\s>]*))?)*)\s*(\/?)>|([^<]+|<)/gi

export function htmlToMarkdown(html: string, dropped: (tag: string) => void = () => {}): string {
  if (!/<[a-z/!]/i.test(html)) return decodeEntities(html)
  let out = ''
  const lists: List[] = []
  const marks: Array<{ marker: string, at: number }> = []
  let href: string | null = null
  let linkStart = 0
  const block = () => {
    out = out.replace(/[ \t]+$/, '')
    if (out && !out.endsWith('\n\n')) out += out.endsWith('\n') ? '\n' : '\n\n'
  }
  const line = () => {
    out = out.replace(/[ \t]+$/, '')
    if (out && !out.endsWith('\n')) out += '\n'
  }
  for (const m of html.matchAll(TOKEN)) {
    const [, close, rawName, attrs = '', , text] = m
    if (text !== undefined) {
      const t = decodeEntities(text).replace(/\s+/g, ' ')
      out += out.endsWith('\n') || out === '' ? escapeText(t.trimStart()) : escapeText(t)
      continue
    }
    if (!rawName) continue // a comment
    const name = rawName.toLowerCase()
    if (name.startsWith('me-')) {
      out += m[0]
      continue
    }
    switch (name) {
      case 'p': case 'div':
        if (lists.length) break
        block()
        break
      case 'br':
        out += lists.length ? ' ' : '\n'
        break
      case 'strong': case 'b': case 'em': case 'i': case 's': case 'strike': case 'del': case 'code': {
        const marker = MARKS[name]!
        if (!close) {
          marks.push({ marker, at: out.length })
          out += marker
          break
        }
        const open = marks.pop()
        if (!open) break
        const inner = out.slice(open.at + marker.length)
        if (!inner.trim()) out = out.slice(0, open.at) + inner // an empty <strong></strong>
        else {
          // Markdown needs the marker against the text: `**x** `, not `**x **`.
          const trailing = /\s*$/.exec(inner)![0]
          out = `${out.slice(0, out.length - trailing.length)}${marker}${trailing}`
        }
        break
      }
      case 'u': case 'span': case 'sup': case 'sub':
        if (name !== 'span' && !close) dropped(name)
        break
      case 'h1': case 'h2': case 'h3': case 'h4': case 'h5': case 'h6':
        block()
        if (!close) out += `${'#'.repeat(Math.max(3, Number(name[1])))} `
        break
      case 'ul': case 'ol':
        if (close) {
          lists.pop()
          if (!lists.length) block()
        }
        else {
          if (!lists.length) block()
          lists.push({ ordered: name === 'ol', n: 0 })
        }
        break
      case 'li': {
        if (close) break
        line()
        const list = lists.at(-1) ?? { ordered: false, n: 0 }
        list.n++
        const indent = Number(/ql-indent-(\d+)/.exec(attrs)?.[1] ?? Math.max(0, lists.length - 1))
        out += `${'   '.repeat(indent)}${list.ordered ? `${list.n}.` : '-'} `
        break
      }
      case 'a':
        if (close) {
          if (href) out = `${out.slice(0, linkStart)}[${out.slice(linkStart)}](${href})`
          href = null
        }
        else {
          href = /href\s*=\s*"([^"]*)"/i.exec(attrs)?.[1] ?? null
          linkStart = out.length
        }
        break
      case 'hr':
        block()
        out += '---'
        block()
        break
      case 'tr':
        if (close) line()
        break
      case 'td': case 'th':
        if (!close) out += ' | '
        break
      case 'table': case 'tbody': case 'thead':
        if (!close) dropped(name)
        block()
        break
      default:
        if (!close) dropped(name)
    }
  }
  // Trailing spaces, three or more newlines.
  return out
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}
