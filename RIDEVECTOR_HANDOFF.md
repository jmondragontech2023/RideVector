# RideVector --- Codex Handoff

## Purpose of this document

This document transfers the product, architecture, MVP, and engineering
decisions from the RideVector planning conversation into the repository.
It is intended to give Codex and Cursor enough context to create the
permanent project documentation and then implement the product
milestone-by-milestone.

**Do not treat this file as permanent architecture documentation.** Use
it to create and maintain the repository's source-of-truth documents
listed below.

------------------------------------------------------------------------

## 1. Product identity

**Product name:** RideVector\
**Working tagline:** *Your ride, optimized.*

The name reflects the mathematical concept of a vector: direction plus
magnitude. RideVector determines a ride from multiple dimensions
including distance, time, direction, surface, elevation, traffic,
weather, waypoints, and eventually individual rider behavior.

The product should feel like an intelligent ride generator rather than
another GPS navigation or fitness-tracking application.

### Core promise

> Tell RideVector how far you want to ride, how much time you have, and
> what kind of ride you want. RideVector generates routes optimized for
> your preferences and riding conditions.

Strava and Garmin already handle activity recording, fitness metrics,
device navigation, and social features well. RideVector should initially
complement those products rather than attempt to replace them.

The initial workflow is:

**Plan → Generate → Compare → Save → Export**

------------------------------------------------------------------------

## 2. Problem RideVector solves

Existing bicycle route generators can produce useful routes, but riders
often have limited control over the actual character of the ride.

RideVector should make requests such as these possible:

-   "I have two and a half hours. Give me a mixed road/gravel loop and
    get me home before 10 AM."
-   "I want to ride 40 miles, plus or minus 5, with roughly 30% gravel."
-   "Start here, stop at this coffee shop and this trailhead, then
    return to the start."
-   "Give me a 50-mile road ride that avoids high-traffic roads."
-   "Generate three alternatives and explain why each one is different."
-   Future: "Find the best departure time tomorrow morning based on
    traffic, temperature, and wind."

The system should optimize the **quality of the ride**, not simply
shortest-path transportation.

------------------------------------------------------------------------

## 3. Existing technology stack

Preserve and use the project's established stack unless repository
inspection shows a compelling reason to change it.

### Web

-   React
-   TypeScript

### iOS

-   Swift
-   SwiftUI

### Backend/API

-   Cloudflare Workers

Cloudflare should handle API orchestration, authentication validation,
rate limiting, caching, external API integrations, and lightweight
application logic.

### Database

-   Supabase
-   PostgreSQL

Use Supabase for users, preferences, route requests, generated routes,
saved routes, feedback, integration metadata, and future community
intelligence.

Use Row Level Security for user-owned data. Never expose privileged
Supabase credentials to React or iOS clients.

### Routing engine

Initial recommendation: **Valhalla**, backed by OpenStreetMap data.

Valhalla should run as a separate container/service. Do not attempt to
run the full routing graph inside Cloudflare Workers.

The exact hosting provider for Valhalla should be selected after
benchmarking memory, disk, graph-building requirements, geographic
coverage, latency, operational complexity, and cost.

### Traffic

Initial provider candidate: **TomTom**.

Traffic integration must be behind an internal provider abstraction so
the implementation can later evaluate or switch to alternatives such as
HERE or Google where licensing and API capabilities permit.

### Weather

Use a provider abstraction. MVP weather can initially be informational.
Future versions should incorporate weather and wind into route scoring
and departure-time optimization.

------------------------------------------------------------------------

## 4. MVP product definition

The MVP should answer:

> **What is the best bicycle ride I can do under these constraints?**

A user should be able to specify:

-   starting location
-   optional ending location
-   return-to-start
-   required waypoints
-   desired distance
-   distance range/tolerance
-   available riding time
-   maximum riding time
-   must-be-back-by time
-   departure date and time
-   paved/gravel surface preference
-   elevation preference
-   traffic preference

RideVector should return multiple materially different alternatives
rather than one unexplained result.

Initial route personalities:

1.  **Best Overall**
2.  **Quietest**
3.  **Adventure / Most Gravel**

------------------------------------------------------------------------

## 5. Primary ride constraints

Distance, time, and return deadline are independent constraints and
should be composable.

### Distance mode

Example:

-   Target: 40 miles
-   Tolerance: ±5 miles

Internally:

-   minimum: 35 miles
-   target: 40 miles
-   maximum: 45 miles

Do not force an exact 40.0-mile route when a substantially better ride
is 41.7 miles. Route quality should matter within the user's allowed
tolerance.

### Available-time mode

Example:

-   Available riding time: 2 hours 30 minutes

The route generator should estimate achievable distance using a
rider-speed model.

The MVP can start with configurable generic estimates for paved roads,
gravel, climbs, and technical surfaces. These values must not be
scattered as hardcoded constants throughout the codebase.

### Distance + time mode

Example:

-   Distance: 35--45 miles
-   Maximum duration: 3 hours

A route is valid only if it satisfies both hard constraints.

### Must-be-back-by

Example:

-   Departure: 7:00 AM
-   Must return by: 10:30 AM

Do not generate a route whose predicted completion time exactly equals
the deadline. Apply a configurable safety buffer, initially
approximately 10--15 minutes.

Future versions should personalize the buffer using prediction
uncertainty and rider history.

------------------------------------------------------------------------

## 6. Waypoints

Waypoints are a core feature.

The route model must support:

Start → Waypoint A → Waypoint B → ... → End/Return

Examples include:

-   coffee shops
-   trailheads
-   scenic viewpoints
-   parks
-   towns
-   water stops
-   friends' houses

MVP can support required waypoints only. Future versions can distinguish
required, preferred, and optional waypoints.

------------------------------------------------------------------------

## 7. Surface preferences

Avoid simplistic "paved / unpaved / any" routing as the only interface.

RideVector should support explicit mixed-surface preferences such as:

-   paved: 60--80%
-   gravel: 20--40%

MVP surface classes:

-   paved
-   gravel
-   dirt/unpaved
-   unknown

Future classes may include compacted gravel, loose gravel, fire road,
doubletrack, singletrack, sand, and technical trail.

Surface confidence should eventually become a major feature. OSM
metadata can be combined with rider confirmations and recent activity to
distinguish "mapped as gravel" from "recently confirmed gravel."

------------------------------------------------------------------------

## 8. Elevation preferences

MVP options:

-   Flat
-   Moderate
-   Hilly
-   Climbing-focused
-   No preference

Future controls:

-   target elevation gain
-   maximum elevation gain
-   maximum gradient
-   avoid climbs above a selected grade

------------------------------------------------------------------------

## 9. Traffic and bicycle safety

MVP traffic preferences:

-   Avoid traffic
-   Prefer quiet roads
-   Balanced
-   Don't care

Traffic and bicycle safety are related but not identical.

A low-volume 55 mph road with no shoulder can be less desirable than a
busier 30 mph road with protected bicycle infrastructure.

### MVP traffic score

Create a normalized route-level traffic exposure value rather than
simply showing a traffic color.

Conceptually:

-   0 = very low exposure
-   100 = very high exposure

Traffic analysis should consider the requested departure date/time when
the selected provider supports historical/future traffic prediction.

### Future bicycle safety score

Potential inputs:

-   traffic volume
-   vehicle speed
-   posted speed limit
-   protected bike lane
-   conventional bike lane
-   shoulder
-   intersection density
-   road classification
-   rider reports
-   known hazards

This should eventually be separate from raw traffic exposure.

------------------------------------------------------------------------

## 10. Weather and wind

MVP weather may initially display:

-   temperature
-   precipitation probability
-   wind direction
-   wind speed

Conditions should correspond to the route, departure time, and estimated
ride duration.

Future weather-aware routing should be able to:

-   put a favorable tailwind on the return leg
-   avoid exposed roads during high winds
-   route steep climbing earlier during hot weather
-   avoid areas affected by storms
-   recommend a better departure time

------------------------------------------------------------------------

## 11. Rider speed model

The time-based route generator requires a rider-speed model.

MVP can use generic configurable speeds based on surface and gradient.

Future personalization should learn from the rider's own
completed/imported activities and estimate speeds by factors such as:

-   paved flat

-   gravel flat

-   rolling terrain

-   4--7% climbs

-   8% climbs

-   technical surface

The long-term goal is that "I have two hours" means approximately two
hours **for that specific rider**.

Strava and/or Garmin integrations can eventually help initialize this
profile from the rider's own activity history where APIs and user
authorization permit it.

------------------------------------------------------------------------

## 12. Route-generation pipeline

Do not implement route generation as one call that returns one route.

Use a multi-stage pipeline.

### Stage 1 --- Normalize constraints

Convert user input into a validated `RouteRequest` domain model.

Conceptual TypeScript shape:

``` ts
interface RouteRequest {
  start: Coordinate
  end?: Coordinate
  returnToStart: boolean
  waypoints: Waypoint[]

  distance?: {
    targetMeters?: number
    minMeters?: number
    maxMeters?: number
  }

  time?: {
    preferredSeconds?: number
    maxSeconds?: number
    mustFinishBy?: string
  }

  surfacePreference?: {
    pavedMin?: number
    pavedMax?: number
    gravelMin?: number
    gravelMax?: number
  }

  elevationPreference?: ElevationPreference
  trafficPreference?: TrafficPreference
  departureAt?: string
}
```

This is conceptual, not a frozen API contract. Final types belong in the
permanent architecture/API documentation.

### Stage 2 --- Generate candidates

Generate many candidate routes rather than one.

Initial target: approximately 20--50 candidates, subject to performance
testing.

Candidate diversity can come from:

-   direction
-   intermediate anchor points
-   route costing
-   surface weighting
-   road-class weighting
-   clockwise/counterclockwise loops
-   waypoint order when allowed

### Stage 3 --- Enrich candidates

Calculate at minimum:

-   distance
-   estimated duration
-   elevation gain/loss
-   paved percentage
-   gravel percentage
-   unknown surface percentage
-   road classifications
-   traffic exposure
-   estimated finish time
-   constraint violations

Future enrichment:

-   weather exposure
-   wind exposure
-   bicycle infrastructure
-   intersection risk
-   surface confidence
-   community popularity
-   scenic value
-   recent trail conditions

### Stage 4 --- Reject invalid candidates

Hard constraints can include:

-   bicycle prohibited
-   private access
-   required waypoint unreachable
-   exceeds hard maximum distance
-   exceeds maximum duration
-   violates must-finish-by buffer
-   invalid/disconnected route

Future hard constraints may include known closures or severe hazards.

### Stage 5 --- Score valid candidates

Initial conceptual factors:

-   distance/time match
-   traffic preference
-   surface match
-   elevation match
-   road quality
-   route variety

Weights must be centralized/configurable and covered by tests.

Do not introduce machine learning for the MVP when deterministic,
explainable scoring is sufficient.

### Stage 6 --- Select distinct personalities

Return top routes that are meaningfully different, not three
near-identical polylines.

Initial outputs:

-   Best Overall
-   Quietest
-   Adventure

### Stage 7 --- Explain the result

Every selected route should contain machine-readable explanation data so
the UI can say things such as:

-   Matches requested distance
-   31% gravel
-   Avoids high-traffic roads
-   Fits inside 3-hour limit
-   Returns before deadline

The scoring system should remain explainable.

------------------------------------------------------------------------

## 13. Results experience

A generated route should display information similar to:

**BEST OVERALL**

-   41.7 miles
-   2h 34m estimated
-   31% gravel
-   2,050 ft climbing
-   Low expected traffic
-   Estimated finish: 9:34 AM

The user should be able to quickly switch between alternatives and
compare:

-   map geometry
-   distance
-   duration
-   elevation
-   surface breakdown
-   traffic
-   explanation

------------------------------------------------------------------------

## 14. Supabase direction

Initial conceptual tables:

-   `profiles`
-   `rider_preferences`
-   `route_requests`
-   `generated_routes`
-   `route_waypoints`
-   `saved_routes`
-   `route_feedback`
-   `external_connections`

Potential rider preferences include:

-   default distance/duration
-   preferred paved range
-   preferred gravel range
-   traffic preference
-   elevation preference

Potential route request data includes:

-   start/end
-   return-to-start
-   target/min/max distance
-   preferred/max duration
-   departure time
-   must-finish-by
-   surface preferences
-   traffic/elevation preferences
-   generation status

Potential generated route data includes:

-   personality/type
-   overall score
-   distance
-   estimated duration
-   elevation gain
-   surface percentages
-   traffic score/level
-   geometry/polyline

These are conceptual. Design the actual PostgreSQL schema deliberately
and document it in `DATABASE.md` before production implementation.

### Security

All user-owned data requires appropriate RLS.

Client applications must never receive:

-   Supabase service-role credentials
-   database credentials
-   traffic provider secrets
-   private signing secrets

Authorization must be enforced at the backend/database boundary, not
solely through UI checks.

------------------------------------------------------------------------

## 15. Cloudflare API direction

Conceptual MVP endpoints:

``` text
POST /api/routes/generate
GET  /api/routes/:id
GET  /api/routes
POST /api/routes/:id/save
POST /api/routes/:id/feedback

GET  /api/preferences
PUT  /api/preferences
```

Future:

``` text
POST /api/integrations/garmin
POST /api/integrations/strava
POST /api/routes/:id/export/garmin
GET  /api/routes/:id/export/gpx
```

Cloudflare Worker responsibilities:

1.  receive request
2.  authenticate
3.  validate/normalize input
4.  call routing service
5.  enrich candidates using traffic/weather services
6.  score/rank candidates
7.  persist appropriate data
8.  return selected alternatives

Heavy routing should remain outside Workers.

------------------------------------------------------------------------

## 16. Provider abstractions

Avoid coupling core domain logic to one external provider.

Examples:

``` ts
interface TrafficProvider {
  getTrafficForRoute(
    route: RouteGeometry,
    departureTime: Date
  ): Promise<TrafficAnalysis>
}
```

Use equivalent boundaries for weather, geocoding, maps where practical,
and routing service access.

This allows provider changes without rewriting the RideVector domain
model.

------------------------------------------------------------------------

## 17. Maps

The map layer must support:

-   route polylines
-   start/end selection
-   waypoint editing
-   current location
-   route alternative switching
-   surface visualization

Evaluate MapKit and/or an appropriate web/mobile map provider during
implementation.

Do not allow core route/domain models to depend directly on one map
SDK's proprietary types.

------------------------------------------------------------------------

## 18. Export and integrations

### GPX

GPX export should be MVP or immediately post-MVP. It provides
compatibility with existing cycling ecosystems before direct
integrations are ready.

### Garmin

Direct course publishing is a high-value early post-MVP feature. Desired
flow:

Generate → Save → Send to Garmin → Garmin Connect → bike computer

### Strava

Use Strava primarily for authorized access to the user's own activity
history and future personalization.

Do not build RideVector's business logic around unrestricted access to
Strava's global heatmap/activity dataset.

------------------------------------------------------------------------

## 19. Feedback and proprietary cycling intelligence

After a ride, keep feedback lightweight:

-   star rating
-   surface accurate? yes/no
-   would ride again? yes/no

Future contextual feedback:

-   road too busy?
-   gravel section rideable?
-   road closed?
-   section unsafe?

Over time, opted-in aggregate usage can create RideVector-specific
cycling intelligence:

-   selected roads
-   avoided roads
-   completed routes
-   abandoned routes
-   surface corrections
-   traffic/safety reports
-   hazards
-   closures
-   route ratings

This dataset can become a long-term product advantage.

------------------------------------------------------------------------

## 20. MVP milestones

### Milestone 0 --- Repository and environments

-   inspect repository before changing anything
-   establish permanent documentation
-   configure development/staging/production strategy
-   configure Supabase environment separation
-   configure Cloudflare environment separation
-   secrets management
-   CI
-   linting
-   testing foundation

Acceptance criteria:

-   development cannot accidentally write production data
-   production secrets are isolated
-   tests run before production deployment
-   environment setup is documented

### Milestone 1 --- Core domain model

Implement and test concepts such as:

-   RouteRequest
-   RouteCandidate
-   RouteResult
-   Waypoint
-   SurfacePreference
-   TimeConstraint
-   DistanceConstraint
-   TrafficPreference
-   ElevationPreference

Acceptance criteria:

-   validation exists
-   invalid combinations are rejected
-   normalization has unit tests
-   models are documented

### Milestone 2 --- Basic routing service

Deploy/operate Valhalla and support:

-   start → destination
-   start → waypoint(s) → destination
-   start → loop → start

Acceptance criteria:

-   bicycle routes returned
-   bicycle restrictions respected
-   geometry/statistics returned

### Milestone 3 --- Distance-based loop generation

Generate multiple distinct loops from start + target distance/tolerance.

Acceptance criteria:

-   multiple loops
-   within configured tolerance
-   duplicate/near-duplicate filtering
-   directional diversity

### Milestone 4 --- Surface-aware routing

Add surface classification and preference scoring.

Acceptance criteria:

-   paved/gravel/unknown breakdown
-   candidates scored against requested surface mix
-   mismatch affects ranking/validity

### Milestone 5 --- Time-based generation

Add available time, maximum duration, and must-be-back-by.

Acceptance criteria:

-   estimated duration
-   maximum-duration enforcement
-   configurable deadline safety buffer

### Milestone 6 --- Traffic integration

Integrate initial traffic provider.

Acceptance criteria:

-   candidate traffic estimates
-   departure time considered where supported
-   normalized traffic score
-   traffic preference affects ranking

### Milestone 7 --- Route ranking

Implement explainable scoring and return Best Overall, Quietest, and
Adventure.

Acceptance criteria:

-   meaningfully different alternatives
-   scoring tests
-   explanation data

### Milestone 8 --- React planner

Implement core web planner and route comparison.

### Milestone 9 --- iOS planner

Implement equivalent SwiftUI experience using the same backend/domain
contracts.

### Milestone 10 --- Saved routes and GPX

Implement saved route history and valid GPX export.

### Milestone 11 --- Private beta

Measure whether users actually select and ride generated routes.

Useful beta signals:

-   generation acceptance
-   regeneration rate
-   route selected
-   route completed
-   route rating
-   surface accuracy
-   traffic accuracy

Primary product metric:

> **Did the rider actually choose and ride one of the generated
> routes?**

------------------------------------------------------------------------

## 21. Features explicitly deferred from MVP

Do not initially build:

-   turn-by-turn voice navigation
-   Apple Watch navigation
-   Garmin activity recording
-   training plans
-   social feed
-   followers
-   leaderboards
-   competitive segments
-   messaging
-   live rider tracking
-   crash detection
-   full offline navigation
-   extensive community moderation

The quality of route generation is the product. Avoid diluting the MVP.

------------------------------------------------------------------------

## 22. Future roadmap

### Phase 2 --- Personalization

-   Strava/Garmin activity import where appropriate
-   personalized paved/gravel speeds
-   climbing model
-   preferred distances
-   favorite/avoided roads
-   preferred route personality
-   personalized safety buffer

### Phase 3 --- Bicycle safety intelligence

-   bicycle infrastructure
-   shoulders
-   speed limits
-   vehicle speeds
-   intersection risk
-   hazards
-   rider reports
-   dedicated Bicycle Safety Score

### Phase 4 --- Surface confidence

Combine OSM metadata with recent rider confirmation and community
reports.

### Phase 5 --- Weather-aware routing

Incorporate wind, heat, precipitation, storms, and exposure into route
scoring.

### Phase 6 --- Departure-time optimization

Allow a departure window such as 6--9 AM and recommend the best time
based on traffic/weather/wind.

### Phase 7 --- Community intelligence

Build opted-in aggregate cycling-specific road knowledge.

### Phase 8 --- Learned route ranking

Only after sufficient quality data exists, consider learned ranking.
Maintain explainability and deterministic safety constraints.

### Phase 9 --- Direct Garmin integration

Add "Send to Garmin."

### Phase 10 --- Advanced ride goals

Potential presets:

-   Recovery Ride
-   Coffee Ride
-   Gravel Adventure
-   Climbing Day
-   Fast Road Ride
-   Low-Traffic Ride
-   Scenic Ride
-   New Roads
-   Training Loop

Presets should map onto the same underlying constraint system rather
than becoming separate routing engines.

------------------------------------------------------------------------

## 23. Testing strategy

### Unit tests

Prioritize:

-   constraint normalization
-   distance tolerance
-   time/deadline calculations
-   surface percentages
-   scoring
-   route ranking
-   rider-speed calculations

### Integration tests

Cover:

-   Cloudflare → routing service
-   Cloudflare → Supabase
-   Cloudflare → traffic provider
-   Cloudflare → weather provider

Mock external APIs in CI when appropriate.

### Geographic route-quality regression tests

Maintain fixed test cases for:

-   urban loop
-   suburban loop
-   mountain loop
-   road/gravel loop
-   mostly gravel loop
-   waypoint loop
-   short time-constrained loop
-   long-distance loop

Algorithm changes should not silently degrade known route quality.

------------------------------------------------------------------------

## 24. Observability and performance

Track at minimum:

-   route generation latency
-   routing-service latency
-   traffic/weather provider latency
-   external API failures
-   candidates generated
-   candidates rejected
-   rejection reasons
-   final route scores
-   selected route personality

Avoid sensitive data in logs.

Initial route-generation target:

-   preferred: \<5 seconds
-   acceptable during MVP: \<10 seconds

Potential future optimizations include parallel candidate generation,
cached road metadata, candidate pruning, regional preprocessing, and
precomputation.

------------------------------------------------------------------------

## 25. Permanent repository documentation to create

Create and maintain:

``` text
README.md
AGENTS.md
ARCHITECTURE.md
PROJECT_PLAN.md
TASKS.md
DATABASE.md
API.md
ROUTING.md
TEST_PLAN.md
DECISIONS.md
```

Also create Cursor rules:

``` text
.cursor/rules/
├── 00-project.mdc
├── 10-react.mdc
├── 20-ios.mdc
├── 30-supabase.mdc
├── 40-cloudflare.mdc
└── 50-testing-security.mdc
```

### Document responsibilities

-   `README.md` --- product/repo overview and developer setup
-   `AGENTS.md` --- global instructions for coding agents
-   `ARCHITECTURE.md` --- system architecture and boundaries
-   `PROJECT_PLAN.md` --- milestones and acceptance criteria
-   `TASKS.md` --- current actionable milestone only
-   `DATABASE.md` --- PostgreSQL/Supabase schema and RLS
-   `API.md` --- Cloudflare API contracts
-   `ROUTING.md` --- candidate generation, enrichment, scoring, route
    personalities, constraints
-   `TEST_PLAN.md` --- test strategy and route-quality regressions
-   `DECISIONS.md` --- architectural decision log

The permanent docs become the shared memory between ChatGPT/Sol, Codex,
Cursor, and human contributors.

------------------------------------------------------------------------

## 26. Agent/Cursor operating rules

For non-trivial work:

1.  Read the relevant source-of-truth docs.
2.  Inspect existing code before proposing changes.
3.  Prefer existing abstractions and patterns.
4.  Plan the current milestone before implementation.
5.  Implement one milestone at a time.
6.  Make the smallest coherent changes.
7.  Do not modify unrelated code.
8.  Do not invent APIs, tables, environment variables, bindings, or
    package behavior when the repository or authoritative documentation
    can answer the question.
9.  Add/update tests.
10. Run tests, linting, type checks, and builds where applicable.
11. Inspect the final diff.
12. Update documentation when implementation changes the documented
    truth.

If documentation and code conflict, do not silently choose one. Identify
and resolve the discrepancy deliberately.

Do not rewrite already-applied database migrations. Add new migrations.

Treat clients as untrusted. Authorization belongs at backend/database
security boundaries.

Never claim a test/build passed unless it was actually run.

------------------------------------------------------------------------

## 27. Recommended implementation workflow

Use this workflow for each meaningful milestone:

``` text
Product requirement
       ↓
ChatGPT / Sol
Architecture and planning
       ↓
Repository documentation
       ↓
Codex / Cursor
Inspect repo + propose milestone plan
       ↓
Human approval
       ↓
Implement milestone
       ↓
Tests / typecheck / lint / build
       ↓
Fresh independent review
       ↓
Fix findings
       ↓
Commit
       ↓
Next milestone
```

For substantial changes, do not start by saying "build RideVector."
Always scope work to a milestone or clearly bounded feature.

------------------------------------------------------------------------

## 28. Initial Codex instruction

After reading this handoff, Codex should:

1.  Inspect the entire current repository.
2.  Preserve any existing work.
3.  **Do not implement application features yet.**
4.  Create the permanent documentation structure listed above.
5.  Create the `.cursor/rules` structure.
6.  Translate this handoff into coherent source-of-truth documents
    rather than copying it verbatim into every file.
7.  Identify assumptions or architectural conflicts discovered from the
    repository.
8.  Prepare `TASKS.md` for **Milestone 0 only**.
9.  Stop and request review before beginning application implementation.

------------------------------------------------------------------------

## 29. MVP definition of done

RideVector is ready for private beta when a rider can:

1.  Sign in.
2.  Select a starting point.
3.  Choose return-to-start or a destination.
4.  Add required waypoints.
5.  Request a distance or distance range.
6.  Request an available/maximum riding time.
7.  Set a must-be-back-by deadline.
8.  Specify paved/gravel preferences.
9.  Specify elevation preference.
10. Specify traffic preference.
11. Specify departure date/time.
12. Generate at least three materially different routes.
13. Compare distance, estimated duration, elevation, surface, and
    traffic.
14. Understand why each route was recommended.
15. Save a route.
16. Export the route as GPX.
17. Access the saved route from the supported React/iOS experience as
    architecture permits.

------------------------------------------------------------------------

## 30. Guiding product principle

RideVector's advantage is not:

> "We can draw a bicycle route."

Many applications already do that.

The long-term advantage should be:

> **RideVector understands what kind of ride you want, how much time you
> have, what surfaces and roads fit your preferences, what conditions
> you are likely to encounter, and which route is most likely to give
> you the best ride.**

The quality of the route generator comes before the polish of the map
UI.
