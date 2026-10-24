#!/usr/bin/env node
import { writeFileSync } from 'node:fs'
import { isAbsolute, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { parseArgs } from 'node:util'
import type { GameDefinition } from '../schemas/game'
import { renderBacklog, renderMarkdown, renderText } from './report'
import { validateContent } from './validate'

const HELP = `omnibrew-validate: check a content repo against a game's schemas

Usage:
  pnpm validate --game <game module> --content <content repo> [options]

Options:
  --game <path>       module exporting a GameDefinition (default export or named export)
  --content <dir>     content repo root (folder holding data/ and text/)
  --format <f>        text (default) | md | json | backlog (rules written as notes)
  --link-prefix <p>   backlog: prefix for links to content files (e.g. ../omnibrew-me5e-data/)
  --out <file>        write the report to a file instead of stdout
  --title <text>      report title (md)
  --fail-on <level>   error (default) | warning | none: exit 1 at or above this level
`

async function main() {
  const { values } = parseArgs({
    options: {
      'game': { type: 'string' },
      'content': { type: 'string' },
      'format': { type: 'string', default: 'text' },
      'out': { type: 'string' },
      'title': { type: 'string' },
      'link-prefix': { type: 'string' },
      'fail-on': { type: 'string', default: 'error' },
      'help': { type: 'boolean', short: 'h' },
    },
  })
  if (values.help || !values.game || !values.content) {
    process.stdout.write(HELP)
    process.exit(values.help ? 0 : 2)
  }
  const cwd = process.env.INIT_CWD ?? process.cwd()
  const abs = (p: string) => (isAbsolute(p) ? p : resolve(cwd, p))
  const mod = await import(pathToFileURL(abs(values.game)).href) as Record<string, unknown>
  const def = (mod.default ?? Object.values(mod).find(v => typeof v === 'object' && v !== null && 'sources' in v)) as GameDefinition | undefined
  if (!def) throw new Error(`${values.game} exports no GameDefinition`)

  const result = validateContent(abs(values.content), def)
  const command = `pnpm validate --game ${values.game} --content ${values.content}${values.format !== 'text' ? ` --format ${values.format}` : ''}`
  const renderers: Record<string, () => string> = {
    json: () => JSON.stringify(result, null, 2),
    md: () => renderMarkdown(result, { title: values.title ?? `${def.name} content validation`, command }),
    backlog: () => renderBacklog(result, { title: values.title ?? `${def.name}: rules written as notes`, command, linkPrefix: values['link-prefix'] }),
    text: () => renderText(result),
  }
  const render = renderers[values.format ?? 'text']
  if (!render) throw new Error(`unknown --format "${values.format}"`)
  const output = render()
  if (values.out) writeFileSync(abs(values.out), output)
  else process.stdout.write(`${output}\n`)

  const levels = values['fail-on'] === 'none' ? [] : values['fail-on'] === 'warning' ? ['error', 'warning'] : ['error']
  if (result.issues.some(i => levels.includes(i.severity))) process.exitCode = 1
}

main().catch((err) => {
  console.error(err)
  process.exit(2)
})
