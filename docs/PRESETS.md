# Rules Presets

Arbiter ships with generic presets, SEL 2025 presets (extracted from the supplied Major 3 R&R PDFs),
and tier-1 circuit presets for the 2026 season. Custom per-server presets are still available through
`/preset create`.

> **Note:** Tier-1 pools are **2026 snapshots** from public sources (VLR, dotesports, siege.gg) and
> rotate often (Valorant per act, CS2 ~6 months, R6 per operation), so update them when the circuit
> pool changes. **SEL 2026** and **EWC 2026** presets will be added precisely from the official R&R
> PDFs once supplied (drop them in `docs/rulebooks/`).

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
| `vct_valorant` | Valorant | Final-map veto | VCT 2026 competitive pool (Abyss, Bind, Breeze, Corrode, Haven, Pearl, Split) |
| `cs2` | Counter-Strike 2 | Final-map veto | CS2 Active Duty 2026 / Premier S4 (Ancient, Anubis, Dust II, Inferno, Mirage, Nuke, Overpass) |
| `r6s` | Rainbow Six Siege X | Final-map veto | Siege X 2026 pool (Bank, Border, Chalet, Clubhouse, Consulate, Kafe, Lair, Nighthaven Labs, Fortress) |
| `owcs_ow2` | Overwatch 2 | Series picks (mode rotation) | OWCS 2026 map pool (Control/Hybrid/Push/Flashpoint/Escort); BO3, GF Ft4 |
| `rlcs` | Rocket League | Manual / no veto | RLCS 2026 — standard arenas; BO5 Major groups, BO7 elimination |
| `lol` | League of Legends | Manual / no veto | LoL 2026 — Fearless Draft; BO3 regular, BO5 playoffs |
| `tekken8` | Tekken 8 | Manual / no veto | EWC 2026 — BO5 group stages, BO9 playoffs |

## Notes For Referees

- OW2 presets enforce the first pick as Control and block repeated modes until each mode has appeared.
- COD BO6 filters the next pick by the required mode for BO3 and BO5: Hardpoint, Search & Destroy, Control, then Hardpoint and Search & Destroy for BO5.
- Rocket League, PUBGM, and EAFC do not use map vetoes in the same way as tactical shooters, so their presets use manual/fixed-order picks and rely on the referee to log results.
- R6S and Valorant include notes for side selection and coin toss responsibilities, but side choice is still logged through score notes, rulings, or referee logs.
