// The red team scoreboard. Every attack anyone has contributed, run through the
// guard inside ordinary evidence, under every obfuscation. No model is called.
//
//   node redteam/run.mjs              # prints the scoreboard, writes results/redteam.json
//   node redteam/run.mjs --strict     # also fails if an attack the baseline caught now gets through
//
// An attack file is JSONL in redteam/attacks/. One attack per line:
//   {"id": "you-2026-11-10-1", "author": "github handle", "payload": "the text", "goal": "what it tries to make the model do", "transforms": false}
// "transforms": false runs the payload only as written, for attacks whose
// obfuscation is already part of the payload.
import { readFileSync, writeFileSync, readdirSync, existsSync, mkdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { scan, GUARD_VERSION } from '../src/index.js'
import { TRANSFORMS, benignDocs, plant, rng } from '../bench/suite.mjs'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const DIR = join(ROOT, 'redteam', 'attacks')
const attacks = readdirSync(DIR).filter(f => f.endsWith('.jsonl')).sort().flatMap(f =>
  readFileSync(join(DIR, f), 'utf8').split('\n').filter(l => l.trim()).map((l, i) => {
    let a
    try { a = JSON.parse(l) } catch { throw new Error(`${f} line ${i + 1} is not JSON`) }
    for (const k of ['id', 'author', 'payload', 'goal']) if (typeof a[k] !== 'string' || !a[k]) throw new Error(`${f} line ${i + 1} needs "${k}"`)
    return { ...a, file: f }
  }))
const ids = new Set()
for (const a of attacks) { if (ids.has(a.id)) throw new Error(`duplicate attack id ${a.id}`); ids.add(a.id) }

const docs = benignDocs()
const caughtIn = (text, start, end) => scan(text).flags.some(f => f.rule !== 'lookalike' && f.start < end && f.end > start)
const rows = attacks.map((a) => {
  const r = rng([...a.id].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7))
  const transforms = a.transforms === false ? { 'as written': t => t } : TRANSFORMS
  const results = Object.fromEntries(Object.entries(transforms).map(([name, t]) => {
    const p = plant(docs[Math.floor(r() * docs.length)], t(a.payload), r)
    return [name, caughtIn(p.text, p.start, p.end)]
  }))
  const through = Object.entries(results).filter(([, ok]) => !ok).map(([k]) => k)
  return { id: a.id, author: a.author, goal: a.goal, file: a.file, caught: through.length === 0, through }
})

const out = { version: GUARD_VERSION, ranAt: new Date().toISOString(), label: 'measured', attacks: rows.length, caught: rows.filter(r => r.caught).length, rows }
mkdirSync(join(ROOT, 'results'), { recursive: true })
writeFileSync(join(ROOT, 'results', 'redteam.json'), JSON.stringify(out, null, 2) + '\n')

console.log(`${out.caught} of ${out.attacks} attacks caught under every transform (${GUARD_VERSION})`)
const byAuthor = {}
for (const r of rows) (byAuthor[r.author] ??= { attacks: 0, through: 0 }), byAuthor[r.author].attacks++, r.caught || byAuthor[r.author].through++
console.log('by author:', Object.entries(byAuthor).map(([k, v]) => `${k} ${v.through} of ${v.attacks} got through`).join(', '))
for (const r of rows.filter(r => !r.caught)) console.log(`  through: ${r.id} (${r.author}) via ${r.through.join(', ')}`)

if (process.argv.includes('--strict')) {
  const base = join(ROOT, 'redteam', 'baseline.json')
  if (!existsSync(base)) { console.error('no redteam/baseline.json yet'); process.exit(0) }
  const caught = new Set(JSON.parse(readFileSync(base, 'utf8')).caught)
  const regressed = rows.filter(r => caught.has(r.id) && !r.caught)
  if (regressed.length) { console.error(`regressions: ${regressed.map(r => r.id).join(', ')}`); process.exit(1) }
  console.log('no regressions against the baseline')
}
