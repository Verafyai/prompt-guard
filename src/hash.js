// Canonical JSON (sorted keys, no whitespace) and SHA-256, so two machines that
// compile the same evidence always agree on the guard record's hash.
import { createHash } from 'node:crypto'

export function canonical(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value)
  if (Array.isArray(value)) return '[' + value.map(canonical).join(',') + ']'
  const keys = Object.keys(value).filter(k => value[k] !== undefined).sort()
  return '{' + keys.map(k => JSON.stringify(k) + ':' + canonical(value[k])).join(',') + '}'
}

export function sha256(value) {
  const text = typeof value === 'string' ? value : canonical(value)
  return createHash('sha256').update(text, 'utf8').digest('hex')
}
