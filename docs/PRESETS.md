# Rules Presets

Arbiter ships with generic presets plus SEL 2025 presets extracted from the supplied Major 3 R&R PDFs.
Custom per-server presets are still available through `/preset create`.

## Built-In Presets

| Preset key | Game | Default selection | PDF coverage |
|---|---|---|---|
| `generic` | Any game | Series map picks | Generic fallback pool |
| `valorant` | Valorant | Final-map veto | Alias for SEL-style Valorant map/side flow |
| `overwatch` | Overwatch 2 | Series map picks | Alias for SEL OW2 mode rotation |
| `sel_valorant` | Valorant | Final-map veto | SEL 2025 Valorant Third Major |
| `sel_women_valorant` | Women Valorant | Final-map veto | SEL 2025 Women Valorant Third Major |
| `sel_ow2` | Overwatch 2 | Series map picks | SEL 2025 OW2 Third Major |
| `sel_women_ow2` | Women Overwatch 2 | Series map picks | SEL 2025 Women OW2 Third Major |
| `sel_r6s` | Rainbow Six Siege X | Final-map veto | SEL 2025 R6S Third Major |
| `sel_r6s_wildcard` | Rainbow Six Siege X Wildcard | Final-map veto | Road to the Championship Wildcard |
| `sel_cod_bo6` | Call of Duty BO6 | Manual mode picks | SEL 2025 COD BO6 Third Major |
| `sel_rocket_league` | Rocket League | Manual fixed order | SEL 2025 Rocket League Third Major |
| `sel_pubgm` | PUBG Mobile | Manual fixed order | SEL 2025 PUBGM Third Major |
| `sel_pubgm_pmnc` | PUBG Mobile PMNC | Manual fixed order | SEL 2025 PUBGM PMNC |
| `sel_eafc` | EAFC | Manual games/legs | SEL 2025 EAFC Third Major |
| `sel_women_eafc` | Women EAFC | Manual BO3 games | SEL 2025 Women EAFC Third Major |

## Notes For Referees

- OW2 presets enforce the first pick as Control and block repeated modes until each mode has appeared.
- COD BO6 filters the next pick by the required mode for BO3 and BO5: Hardpoint, Search & Destroy, Control, then Hardpoint and Search & Destroy for BO5.
- Rocket League, PUBGM, and EAFC do not use map vetoes in the same way as tactical shooters, so their presets use manual/fixed-order picks and rely on the referee to log results.
- R6S and Valorant include notes for side selection and coin toss responsibilities, but side choice is still logged through score notes, rulings, or referee logs.
