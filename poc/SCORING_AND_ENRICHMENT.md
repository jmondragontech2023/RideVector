# POC scoring and enrichment (provisional)

Provisional experiment for comparing deterministic geometry scoring with optional elevation, motor-vehicle traffic, and weather enrichment. **Not** the production Milestone ranking contract. Values, weights, and thresholds may change after owner evaluation.

Scoring configuration version: **`poc-scoring-v1`**.

## Feature controls

Independent toggles (defaults in parentheses):

| Toggle | Default | Notes |
| --- | --- | --- |
| Distance-fit scoring | on | Soft ranking only; distance acceptance remains hard |
| Loop-quality scoring | on | Geometry shape, not safety |
| Route-diversity scoring | on | Among returned alternatives only |
| Elevation enrichment | off | Worker-side Valhalla `/height` sampling |
| Elevation scoring | off | Requires elevation enrichment; preference ≠ none |
| Motor-traffic enrichment | off | TomTom Flow Segment Data; final alternatives only |
| Motor-traffic scoring | off | Requires enrichment; preference ≠ none; coverage gate |
| Weather forecast | off | Open-Meteo hourly forecast |
| Weather scoring | off | Requires weather forecast; conservative penalties |

Non-disableable: distance acceptance, malformed-geometry rejection, bicycle routing restrictions, and request validation.

Presets: **Basic** (distance only), **Geometry** (distance + loop + diversity), **Traffic** (Geometry + traffic enrich/score), **Weather** (Geometry + weather forecast, no weather score), **Full experiment** (all enrichment and scoring).

## Geometry component scores (0–100)

### Distance fit (weight 50 geometry-only / 30 full)

Uses target distance, requested flexibility, inside-range vs near-match, absolute and percentage difference from target. An in-range candidate always scores higher than an otherwise equivalent near match.

### Loop quality (weight 30 / 20)

Deterministic approximations from GeoJSON LineString:

- Start/end closure distance
- Approximate repeated geometry (sampled point reuse)
- Approximate immediate backtracking (heading reversal on short segments)
- Self-intersection count (sampled segment pairs)
- Short spike / detour indicators
- Malformed / disconnected geometry warning when detectable

Not a safety score.

### Diversity (weight 20 / 15)

Deterministic geometry simplification/sampling, pairwise shared-route percentage among returned alternatives, and each route’s diversity contribution. Hard duplicate midpoint filter is unchanged. Moderate overlap is scored, not hard-rejected.

## Elevation

`ElevationProvider` → Valhalla-compatible `/height` with `range: true` and bounded sampling (≤50 points). Prefer the same `VALHALLA_BASE_URL` used for routing.

Expose: gain, loss, min, max, gain per mile, coverage/confidence, unknown state. Missing elevation is **unknown**, never zero.

Provisional gain-per-mile categories (meters / mile):

- Flattest: &lt; 15
- Rolling: 15–45
- Most climbing: &gt; 45 (also used as comparative badge)

Preference: `none` | `flatter` | `rolling` | `climbing`. `none` keeps enrichment informational.

## Weather

`WeatherProvider` → Open-Meteo Forecast API (`/v1/forecast`), multi-location lat/lon, hourly fields only:

`temperature_2m`, `apparent_temperature`, `precipitation_probability`, `precipitation`, `wind_speed_10m`, `wind_direction_10m`, `wind_gusts_10m`, `weather_code`

Sample start, midpoint, and farthest point; cover estimated ride interval; cache identical samples within one generation. Attribution: Open-Meteo / underlying models per [open-meteo.com](https://open-meteo.com/).

Provisional scoring penalties (when weather scoring enabled): heavy precipitation, high precip probability, strong wind, strong gusts, extreme temperature. Missing weather must not score as favorable. Do not claim exact segment weather or safety.

## Motor-vehicle traffic

`TrafficProvider` → TomTom Flow Segment Data v4 (`absolute` style, zoom `10`, `json`). Secret: `TOMTOM_API_KEY` in local Worker secrets only. Non-secret base URL configurable.

Limits per generation: ≤5 geographically separated samples per route, ≤3 routes, ≤15 calls, concurrency ≤3, 5s timeout, no retries, nearby-sample dedupe (~50 m). Enrich **final alternatives only**.

Normalized concepts:

- **Baseline motor-traffic exposure proxy** — from functional road class (FRC) and free-flow speed
- **Current motor-traffic conditions** — current/free-flow ratio may add congestion warning/penalty
- **Coverage** / **Confidence**

Congestion must **never** make a heavily trafficked road look quiet. User language: lower / moderate / higher estimated motor-traffic exposure; current congestion detected; insufficient traffic coverage. Not bicycle safety, volume, or verified quietness.

Preference: `none` | `prefer_lower` | `strongly_avoid_heavy`. Affects ranking only when enrichment + scoring + preference ≠ none and ≥2 routes have ≥60% sample coverage; otherwise disable traffic ranking and warn.

## Combined weights (`poc-scoring-v1`)

When every component is active and applicable:

| Component | Weight |
| --- | --- |
| Distance fit | 30 |
| Loop quality | 20 |
| Diversity | 15 |
| Motor-traffic preference fit | 20 |
| Elevation preference fit | 10 |
| Weather suitability | 5 |

Normalize only enabled applicable components to 100. Hard validation failures cannot be overcome by score. Within-range ranks before near matches. Deterministic tie-break: classification, overall score desc, |Δ target| asc, id asc.

Display label: **POC fit**, not “Best Overall”.

## Failure behavior

Routing success must not fail because elevation, traffic, or weather is unavailable. Map errors to safe categories; show unavailable / stale / partial / low-confidence; never substitute zero for unknown; never expose raw upstream errors or precise sample coordinates in logs/responses.

Rejected diagnostic candidates are never enriched and cannot be saved as accepted routes.

## Attribution

- Map tiles: OpenStreetMap contributors
- Routing / elevation: Valhalla-compatible upstream (public demo or self-hosted)
- Weather: Open-Meteo
- Traffic: TomTom (when enabled; display attribution in UI)

## Known limitations

- Geometry quality uses approximations suitable for POC comparison only
- Traffic exposure is a proxy from FRC + free-flow speed, not counted vehicles
- Weather is multi-point hourly forecast, not segment-exact
- Public Valhalla demo `/height` may be incomplete; treat missing as unknown
- Optional TomTom key required for live traffic; ordinary CI uses mocks
