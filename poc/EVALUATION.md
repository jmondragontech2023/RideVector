# POC evaluation worksheet

Owner field-test record for the local route-generation POC. **Do not invent results.** Leave outcome fields marked `pending` until the owner actually rides or visually judges each scenario.

## How to run a scenario

1. Start Valhalla-compatible routing and both RideVector processes (see root `README.md`).
2. Open the web app, load the matching public fixture (or click a non-personal start).
3. Set the ride mode (loop or start/end), target distance (entire ride), and distance flexibility (± miles). Confirm the displayed accepted range before generating.
4. Optionally set departure time and experimental feature presets (see matrix below).
5. Generate, compare up to three alternatives (including any amber **Near match** routes), regenerate if needed, and optionally save with feedback in browser `localStorage` only.
6. Optionally open **Details**, tap **Export to Garmin** (or **Download GPX**), and import the file into Garmin Connect for an on-device ride (see Garmin field-test checklist below).
7. Fill the tables below with your judgment.

## Base scenario results

| # | Fixture / area | Requested target | Flexibility (± mi) | Chosen route type | Would ride? | Deviation acceptable? | Dominant issue | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | Golden Gate Park loop | 10 mi | 3 | pending | pending | pending | pending | pending |
| 2 | Central Park loop | 12 mi | 3 | pending | pending | pending | pending | pending |
| 3 | Prospect Park gravel preference | 15 mi | 3 | pending | pending | pending | pending | pending |
| 4 | Boulder foothills loop | 20 mi | 3 | pending | pending | pending | pending | pending |
| 5 | Zilker Park loop | 18 mi | 4 | pending | pending | pending | pending | pending |
| 6 | Golden Gate Park to Crissy Field (start/end) | 8 mi | 3 | pending | pending | pending | pending | pending |
| 7 | Zilker Park to Texas Capitol (start/end) | 10 mi | 3 | pending | pending | pending | pending | pending |

**Chosen route type:** `within_range` / `near_match`

**Would ride values:** `yes` / `maybe` / `no`

**Deviation acceptable values (near matches only):** `yes` / `no` / `n/a`

**Dominant issue values:** `candidate quality` / `comparison UX` / `missing constraints` / `other` (specify in notes)

## Garmin GPX field-test checklist

Use **Export to Garmin** (or **Download GPX**) on a selected accepted route (or a reopened local save). This downloads a GPX file for manual import — there is no direct Garmin API sync. Do **not** invent results. Leave fields `pending` until you complete each step.

Manual import path (Garmin Connect): **Training & Planning → Courses → Import**, then send/sync the course to a compatible Garmin device.

| # | Fixture / route | GPX download OK? | Garmin Connect import OK? | Course synced / opened on device? | Navigation / geometry issues | Would ride? | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | pending | pending | pending | pending | pending | pending | pending |
| 2 | pending | pending | pending | pending | pending | pending | pending |
| 3 | pending | pending | pending | pending | pending | pending | pending |
| 4 | pending | pending | pending | pending | pending | pending | pending |
| 5 | pending | pending | pending | pending | pending | pending | pending |

POC GPX limitations (do not treat as bugs unless the geometry itself is wrong): no elevation profile, no timestamps, no course points / guaranteed turn prompts, no direct Garmin account publishing. Device turn-by-turn behavior depends on the Garmin unit and Connect course processing.

## Scoring / enrichment mode matrix

Run the same five fixtures under each mode (or note which fixtures were skipped). Record for each mode across scenarios:

| Mode | Generated alternatives | Selected route | Score order matched preference? | Traffic matched local knowledge? | Weather affected decision? | Elevation categories credible? | Latency | Missing-data behavior | Would ride |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1. Basic (distance only) | pending | pending | pending | n/a | n/a | n/a | pending | pending | pending |
| 2. Geometry (distance + loop + diversity) | pending | pending | pending | n/a | n/a | n/a | pending | pending | pending |
| 3. Traffic display only (enrich on, score off) | pending | pending | pending | pending | n/a | n/a | pending | pending | pending |
| 4. Traffic ranking (enrich + score) | pending | pending | pending | pending | n/a | n/a | pending | pending | pending |
| 5. Weather display only | pending | pending | pending | n/a | pending | n/a | pending | pending | pending |
| 6. Weather ranking | pending | pending | pending | n/a | pending | n/a | pending | pending | pending |
| 7. Elevation preference | pending | pending | pending | n/a | n/a | pending | pending | pending | pending |
| 8. Full experiment | pending | pending | pending | pending | pending | pending | pending | pending | pending |
| 9. Full experiment, traffic unavailable | pending | pending | pending | pending | pending | pending | pending | pending | pending |
| 10. Full experiment, weather unavailable | pending | pending | pending | pending | pending | pending | pending | pending | pending |

Preset mapping:

1. Basic
2. Geometry
3. Geometry + motor-traffic enrichment only
4. Traffic preset
5. Weather preset
6. Weather preset + weather scoring on
7. Geometry + elevation enrichment/scoring + preference ≠ none
8. Full experiment
9. Full experiment without `TOMTOM_API_KEY`
10. Full experiment with weather forecast forced unavailable (or Open-Meteo blocked)

See `poc/SCORING_AND_ENRICHMENT.md` for formulas, limits, and language rules.

## Aggregate prompts (owner)

Answer after at least five scenarios:

1. How often were useful alternatives returned?
   - pending
2. How often did you accept a near match instead of a within-range route?
   - pending
3. Why were routes rejected or regenerated?
   - pending
4. Was the dominant problem candidate quality, comparison UX, or missing constraints?
   - pending
5. Did POC fit scores, traffic exposure proxies, weather, or elevation change which route you would ride?
   - pending
6. Did GPX import into Garmin Connect and on-device course following work well enough for evaluation?
   - pending
7. Decision: **continue** into production milestones, **revise** candidate generation, or **stop**?
   - pending

## Guardrails reminder

- Do not commit personal home coordinates or private ride logs.
- Road/Gravel is a costing preference, not a measured surface guarantee.
- Near matches are labeled explicitly and do not satisfy the exact requested range.
- Motor-traffic exposure is not bicycle safety, volume, or verified quietness.
- This worksheet is evidence for ADR-017 exit; it does not change Milestone 1–11 scope by itself.
