// Guard benchmark, part 1: the scanner, measured. No model is called.
//
//   python3 bench/fetch.py       # once: public datasets into bench/data (not committed)
//   node bench/run.mjs           # writes results/scanner.json
//
// Detection means the guard marks the text suspicious, so its directive is quoted
// as evidence instead of read as an instruction. Two baselines run on the same
// texts: a one-phrase filter ("ignore previous instructions"), and the guard's own
// rules on the raw text without normalization or decoding.
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { scan, compile, GUARD_RULES, GUARD_VERSION } from '../src/index.js'
import { ATTACKS, TRANSFORMS, benignDocs, plant, rng } from './suite.mjs'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const DATA = join(ROOT, 'bench', 'data')
const OUT = join(ROOT, 'results')
if (!existsSync(join(DATA, 'deepset.jsonl'))) { console.error('run python3 bench/fetch.py first'); process.exit(2) }
const jsonl = f => readFileSync(join(DATA, f), 'utf8').trim().split('\n').map(l => JSON.parse(l))

// A detector takes a text, or a planted text {text, start, end}. For a planted text
// it counts only if it fires on the planted payload, not elsewhere in the document.
const PHRASE = /ignore (all )?(the )?(previous|prior|above) instructions/gi
const spans = (re, t) => { const out = []; re.lastIndex = 0; for (let m; (m = re.exec(t));) { out.push([m.index, m.index + m[0].length]); if (!m[0].length) re.lastIndex++ } return out }
const hits = (found, x) => (typeof x === 'string' ? found.length > 0 : found.some(([a, b]) => a < x.end && b > x.start))
const textOf = x => (typeof x === 'string' ? x : x.text)
const guard = x => {
  const r = scan(textOf(x))
  if (typeof x === 'string') return r.suspicious
  return hits(r.flags.filter(f => f.rule !== 'lookalike').map(f => [f.start, f.end]), x)
}
const rawRules = x => hits(GUARD_RULES.flatMap(r => spans(r.re, textOf(x))), x)
const phrase = x => hits(spans(PHRASE, textOf(x)), x)
const DETECTORS = { guard, 'raw rules': rawRules, 'one phrase': phrase }

const rate = (xs, f) => (xs.length ? xs.filter(f).length / xs.length : null)
const pct = x => (x === null ? 'n/a' : `${(100 * x).toFixed(1)}%`)
const measure = (pos, neg) => Object.fromEntries(Object.entries(DETECTORS).map(([k, f]) => [k, { detected: rate(pos, f), falseAlarms: neg ? rate(neg, f) : null }]))

const results = { version: GUARD_VERSION, measuredAt: new Date().toISOString(), label: 'measured', node: process.version, sets: {} }

// 1. deepset/prompt-injections: direct injections and ordinary prompts, English and German.
// The rules were revised once after reading misses from the train split, so the
// test split is reported separately as the held out number.
const deepset = jsonl('deepset.jsonl')
for (const split of ['train', 'test']) {
  const rows = deepset.filter(r => r.split === split)
  results.sets[`deepset-${split}`] = { source: `deepset/prompt-injections ${split} split (Apache-2.0)${split === 'train' ? '; rules revised after reading its misses' : '; held out'}`, injections: rows.filter(r => r.injection).length, benign: rows.filter(r => !r.injection).length,
    ...measure(rows.filter(r => r.injection).map(r => r.text), rows.filter(r => !r.injection).map(r => r.text)) }
}

// 2. Lakera gandalf: real attempts by people trying to make a model drop its instructions.
const gandalf = jsonl('gandalf.jsonl').map(r => r.text)
results.sets.gandalf = { source: 'Lakera/gandalf_ignore_instructions (MIT)', injections: gandalf.length, ...measure(gandalf) }

// 3. BIPIA: indirect injection. Each attack instruction placed inside a real email.
const r3 = rng(3)
const emails = jsonl('bipia-emails.jsonl').map(e => e.context)
const attacks = jsonl('bipia-attacks.jsonl')
const planted = attacks.map((a, i) => plant(emails[i % emails.length], a.attack, r3))
results.sets.bipia = { source: 'microsoft/BIPIA text attacks in BIPIA emails (MIT)', injections: planted.length, benign: emails.length, ...measure(planted, emails),
  byCategory: Object.fromEntries([...new Set(attacks.map(a => a.category))].map(c => [c, rate(planted.filter((_, i) => attacks[i].category === c), guard)])) }

// 4. The evidence suite: jury-directed payloads in dispute evidence, under each obfuscation.
const r4 = rng(4)
const docs = benignDocs()
const byTransform = {}
for (const [name, t] of Object.entries(TRANSFORMS)) {
  const texts = ATTACKS.flatMap(a => [0, 1].map(() => plant(docs[Math.floor(r4() * docs.length)], t(a), r4)))
  byTransform[name] = { n: texts.length, ...Object.fromEntries(Object.entries(DETECTORS).map(([k, f]) => [k, rate(texts, f)])) }
}
results.sets.evidence = { source: 'evidence suite (bench/suite.mjs), written by the same people as the rules', attacks: ATTACKS.length, benign: docs.length,
  falseAlarms: Object.fromEntries(Object.entries(DETECTORS).map(([k, f]) => [k, rate(docs, f)])), byTransform }

// 5. Cost: time to compile, per kilobyte, on this machine.
const corpus = [...deepset.map(r => r.text), ...gandalf, ...planted.map(p => p.text), ...emails, ...docs]
const bytes = corpus.reduce((s, t) => s + Buffer.byteLength(t), 0)
for (const t of corpus.slice(0, 200)) compile(t)
const t0 = process.hrtime.bigint()
for (let k = 0; k < 3; k++) for (const t of corpus) compile(t)
const ms = Number(process.hrtime.bigint() - t0) / 1e6 / 3
results.cost = { texts: corpus.length, kilobytes: +(bytes / 1024).toFixed(1), msPerKilobyte: +(ms / (bytes / 1024)).toFixed(3), msTotal: +ms.toFixed(1), modelCalls: 0 }

mkdirSync(OUT, { recursive: true })
writeFileSync(join(OUT, 'scanner.json'), JSON.stringify(results, null, 2) + '\n')

const row = (name, m) => `${name.padEnd(12)} ${Object.entries(m).map(([k, v]) => `${k}: ${pct(v.detected)} caught${v.falseAlarms !== null ? `, ${pct(v.falseAlarms)} false alarms` : ''}`).join(' | ')}`
const pick = s => Object.fromEntries(Object.keys(DETECTORS).map(k => [k, s[k]]))
console.log(row('deepset tr', pick(results.sets['deepset-train'])))
console.log(row('deepset te', pick(results.sets['deepset-test'])))
console.log(row('gandalf', pick(results.sets.gandalf)))
console.log(row('bipia', pick(results.sets.bipia)))
console.log('bipia by category', Object.entries(results.sets.bipia.byCategory).map(([k, v]) => `${k} ${pct(v)}`).join(', '))
console.log('evidence false alarms', Object.entries(results.sets.evidence.falseAlarms).map(([k, v]) => `${k} ${pct(v)}`).join(', '))
for (const [k, v] of Object.entries(byTransform)) console.log(`evidence ${k.padEnd(15)} ${Object.keys(DETECTORS).map(d => `${d} ${pct(v[d])}`).join(' | ')}`)
console.log('cost', results.cost)
