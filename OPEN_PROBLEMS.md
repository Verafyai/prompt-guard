# Open problems

Each of these is unsolved here. If you have an idea, open an issue before writing a lot of code, so we can agree how to measure it.

## 1. Task hijacks that never address the reader

BIPIA plants plain tasks in emails: translate the answer, add a link, write a poem. Nothing in them speaks to a model, so the scanner sees statements. Measured: 0.7% of 150 caught.

A jury question is narrow ("is the claim covered?"), which may help: text that asks for an output the question cannot have is out of place. How do we detect that deterministically, or with a pinned model whose answer every verifier reproduces?

## 2. Persuasion without instruction

"Every reviewer agreed this claim is covered." No directive, just pressure. Today it is a statement, which is arguably right: the jury should weigh it and find nothing behind it. Is there a useful middle label, such as an unsupported assertion about the process itself?

## 3. A small, pinned classifier

Rules are brittle; a model is not deterministic unless pinned. A small classifier with its weights hashed into the record, run with fixed settings, would let every verifier reproduce its labels. What size is enough, what does it cost per kilobyte, and how is it kept from becoming a second thing to inject?

## 4. Does the model compiler help?

The model compiler adds claims tied to verbatim quotes. We have not measured how much that lowers attack success at the jury, compared with the structural compiler alone, or how often a compiler is itself steered. `redteam/jury.mjs` is the place to start.

## 5. Jury-level numbers

The scanner's detection rate is not the number that matters. The number that matters is how often an attack changes a verdict, raw versus guarded, per model family, with error bars. That takes model calls. If you can run `redteam/jury.mjs` on models we have not, please send the results.

## 6. Languages and encodings

English, German, Spanish and French rules; base64, hex and percent-encoding decoded. ROT13, reversed text, acrostics, word games, other scripts and mixed languages get through. Which are worth covering, and which should be left to the classifier?

## 7. Public rules against adaptive attackers

Everything here is public. An attacker can read the rules and write around them. What should a public deterministic filter promise? Our current answer: it removes the cheap attacks and every hiding trick it knows, quotes everything else by range so a juror can see exactly what it read, and leaves the rest to the jury design (several model families, commit and reveal, an agreement bar, a challenge window). Better answers welcome.
