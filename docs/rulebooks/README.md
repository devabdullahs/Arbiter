# Tournament Rulebooks

Drop official Rules & Regulations PDFs here so presets can be derived precisely from the source.

Suggested naming: `<circuit>-<year>-<game>.pdf`, e.g.:

- `sel-2026-valorant.pdf`, `sel-2026-ow2.pdf`, `sel-2026-cod-bo6.pdf`, …
- `ewc-2026-<game>.pdf`

For each rulebook, the preset-relevant details are:

- **Map pool** (and per-mode grouping for OW2 / CoD)
- **Veto format** — ban/pick order, final-map ban, series picks, or manual/fixed order
- **Best-of structure** per stage (qualifier / major / grand final)
- **Side / coin-toss** rules and any pause budget

Presets are defined in [`src/constants.js`](../../src/constants.js) (`BUILT_IN_PRESETS`) and documented in
[`../PRESETS.md`](../PRESETS.md).

> These PDFs are reference material. Add them to `.gitignore` if they shouldn't be redistributed.
