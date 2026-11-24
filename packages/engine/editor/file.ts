import { parseFrontMatter, stringifyRecord, toCrlf } from '../content/format'

/**
 * A record file as the editor holds it (plan/33 §1.4): the front matter's fields in their
 * file order, the markdown body, and the file's line endings. Writing goes through the
 * engine's one record writer (B26), so a file read and written with no change comes back
 * byte for byte (2,062 of ME's 2,063 files; the other one only changes quote style).
 */
export interface RecordFile {
  attributes: Record<string, unknown>
  body: string
  /** The file used CRLF line endings (the content repo is checked out with them). */
  crlf: boolean
}

export interface ReadRecordFile extends RecordFile {
  /** YAML errors (the file can't be edited in forms until they're fixed). */
  errors: string[]
  warnings: string[]
  /** The front matter was opened and never closed. */
  unterminated: boolean
}

/** Reads a record file's text. */
export function readRecordFile(text: string): ReadRecordFile {
  const parsed = parseFrontMatter(text)
  return {
    attributes: parsed.attributes,
    body: parsed.body.replace(/\s+$/, ''),
    crlf: text.includes('\r\n'),
    errors: parsed.errors,
    warnings: parsed.warnings,
    unterminated: parsed.unterminated,
  }
}

/** Writes a record file: the engine's writer, then CRLF when the file had it. */
export function writeRecordFile(file: RecordFile): string {
  const text = stringifyRecord(file.attributes, file.body)
  return file.crlf ? toCrlf(text) : text
}

/** The record as validators and the rules take it: fields plus `id` and `body`. */
export function fileRecord(file: Pick<RecordFile, 'attributes' | 'body'>, id: string): Record<string, unknown> {
  return { ...file.attributes, id, ...(file.body.trim() ? { body: file.body } : {}) }
}

/** The record's fields and body back as a file (`id` is the file name, never a field). */
export function recordFile(record: Record<string, unknown>, crlf: boolean): RecordFile {
  const { id: _id, body, ...attributes } = record
  return { attributes, body: typeof body === 'string' ? body : '', crlf }
}
