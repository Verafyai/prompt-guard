# Prompt Guard

An open filter in front of AI jurors: no model reads a naked prompt. The format is `SPEC.md`; read it before changing `src/`.

## Rules

- Zero dependencies in `src/`. Node 22.
- Changing what the guard outputs for any text is a new version (`prompt-guard/2`), never an edit to version 1.
- Every rule change ships with a test, benchmark numbers before and after, and `node redteam/run.mjs --strict` passing.
- Never tune rules on the deepset test split, Gandalf or BIPIA; they are the held out sets.
- An attack that gets through is merged as a known bypass, not deleted.
- Numbers are labeled measured, modeled or vendor-reported. The jury runner has not been run until `results/jury.json` exists.
- No secrets in git. Model keys come from the environment.
- Copy: no em or en dashes.

## Checks

```
npm test && node redteam/run.mjs --strict
python3 bench/fetch.py && node bench/run.mjs
```
