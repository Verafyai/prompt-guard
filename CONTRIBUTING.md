# Contributing

Prompt Guard is an open problem, and the most useful contribution is an attack that gets through.

## Send an attack

1. Add a line to an existing file in `redteam/attacks/`, or create `redteam/attacks/<your-handle>.jsonl`. One attack per line:

   ```json
   {"id": "yourhandle-01", "author": "yourhandle", "payload": "the text you would hide in evidence", "goal": "what it tries to make the jury do"}
   ```

   Add `"transforms": false` if the obfuscation is already part of the payload. Otherwise the runner also tries it with zero-width characters, look-alike letters, fullwidth letters, base64, Unicode tag characters, an HTML comment and a hidden span.

2. Run `node redteam/run.mjs` and say in the pull request what got through.
3. Keep payloads aimed at steering a verdict. No real malware, no real people's personal data, nothing illegal to publish. An attack is judged by whether it changes a ruling, not by how harmful its words are.

An attack that gets through is merged as a known bypass. That is how the scoreboard stays honest.

## Send a defense

A change to the rules, the normalization or the compiler needs:

- a test in `test/` that shows what it now catches;
- the benchmark before and after (`python3 bench/fetch.py` once, then `node bench/run.mjs`), including false alarms, pasted into the pull request;
- `node redteam/run.mjs --strict` passing, so no attack that was caught gets through again.

A defense that raises false alarms on the benign sets needs a strong reason. Evidence is mostly honest text, and a guard that flags ordinary statements teaches jurors to ignore its flags.

Changing what the guard outputs for some text is a new version (see [SPEC.md](SPEC.md) section 10). Say so in the pull request; maintainers batch rule changes into versions.

## Send numbers

`redteam/jury.mjs` measures whether attacks change a real model's verdict, raw and guarded. It costs model calls, so results from people with different models and budgets are welcome. Commit `results/jury.json` with the models, the date and the command you ran.

## Style

- Plain language in code comments and docs. Say what something does, not how good it is.
- No em or en dashes.
- Every number is labeled measured, modeled or vendor-reported, with the command that produced it.
