#!/usr/bin/env node
import { isAbsolute, resolve } from 'node:path'
import { parseArgs } from 'node:util'
import { renderText, validateContent } from '@omnibrew/engine/validator'
import { me5e } from '../game'
import { migrateContent } from '.'

const HELP = `migrate-me5e: move masseffect-5e-data from data/ + text/en/ to content/

Usage:
  pnpm migrate:me5e --from <old-layout checkout> [--to <content repo>] [options]

Options:
  --from <dir>      checkout in the old layout (data/ and text/en/)
  --to <dir>        where to write content/ and messages/ (default: --from; data/ and
                    text/ are then removed)
  --eol <e>         auto (default: CRLF if the target repo has core.autocrlf=true) | lf | crlf
  --force           replace an existing content/ and messages/
  --dry-run         migrate in memory and print the summary; write nothing
`

function main() {
  const { values } = parseArgs({
    options: {
      'from': { type: 'string' },
      'to': { type: 'string' },
      'eol': { type: 'string', default: 'auto' },
      'force': { type: 'boolean' },
      'dry-run': { type: 'boolean' },
      'help': { type: 'boolean', short: 'h' },
    },
  })
  if (values.help || !values.from) {
    process.stdout.write(HELP)
    process.exit(values.help ? 0 : 2)
  }
  if (!['auto', 'lf', 'crlf'].includes(values.eol!)) throw new Error(`--eol must be auto, lf or crlf`)
  const cwd = process.env.INIT_CWD ?? process.cwd()
  const abs = (p: string) => (isAbsolute(p) ? p : resolve(cwd, p))
  const from = abs(values.from)
  const to = abs(values.to ?? values.from)

  const result = migrateContent({ from, to, eol: values.eol as 'auto' | 'lf' | 'crlf', force: values.force, dryRun: values['dry-run'] })
  const total = Object.values(result.records).reduce((a, b) => a + b, 0)
  const out = [`${total} records in ${Object.keys(result.records).length} collections, ${result.files.size} files${values['dry-run'] ? ' (dry run, nothing written)' : ` written to ${to}`}`, '']
  for (const [rule, messages] of [...result.notes].sort()) {
    const n = [...messages.values()].reduce((a, b) => a + b, 0)
    out.push(`${String(n).padStart(6)}  ${rule}`)
    for (const [message, count] of [...messages].sort((a, b) => b[1] - a[1]).slice(0, 12)) out.push(`${String(count).padStart(14)}  ${message}`)
  }
  for (const i of result.issues) out.push(`${i.severity}: ${i.file}: ${i.message}`)
  process.stdout.write(`${out.join('\n')}\n`)

  if (!values['dry-run']) {
    const validation = validateContent(to, me5e)
    process.stdout.write(`\nValidation of ${to}:\n${renderText(validation)}\n`)
    if (validation.issues.some(i => i.severity === 'error')) process.exitCode = 1
  }
}

try {
  main()
}
catch (err) {
  console.error((err as Error).message)
  process.exit(2)
}
