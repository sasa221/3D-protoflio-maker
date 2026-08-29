# Performance Gate — Local Closed-Beta Build

Measured locally from the production build with fresh browser contexts at 390×844 and 1440×900. The run is read-only and uses no Production services.

## Before / after bundle changes

| Area | Before | After | Result |
| --- | ---: | ---: | --- |
| Initial CV Builder route chunk | 490.44 KB | 70.59 KB | PDF/parser code is deferred |
| Main router chunk | 284.54 KB | 211.01 KB | Studio-only modules are split out |
| Pricing first-load transfer | 199 KB | 86 KB | Pricing no longer boots the Studio router |
| Home first-load transfer | 315 KB (prior live baseline) | 105 KB local | Landing 3D demo is opt-in |
| HyperEngine | 643.88 KB | 643.88 KB (deferred) | Loaded only by Studio/public 3D/demo |
| PDF worker | 1,046.21 KB | 1,046.21 KB (deferred) | Loaded only when PDF import/export starts |

## Route smoke measurements

The local measurement script records transfer size, elapsed navigation, overflow, and whether deferred runtimes were fetched. Home and Pricing fetched no HyperEngine, PDF worker, or PDF extractor assets on both viewports. No overflow was observed.

Latest run (mobile uses 4× CPU plus 150 ms/1.6 Mbps network emulation; desktop is unthrottled):

| Route | Mobile transfer / elapsed | Desktop transfer / elapsed |
| --- | ---: | ---: |
| Home | 105 KB / 3.58 s | 105 KB / 1.12 s |
| Pricing | 86 KB / 2.26 s | 86 KB / 1.08 s |
| CV route (feature-off auth shell) | 15 KB / 5.06 s | 17 KB / 1.06 s |
| Studio (unauthenticated shell) | 15 KB / 4.62 s | 17 KB / 1.05 s |
| Public unknown slug | 200 KB / 2.84 s | 200 KB / 1.04 s |

The CV and Studio rows are unauthenticated safety-shell measurements; a staging run with a real synthetic account and published portfolio fixture is still required before public launch.

Run again with:

```text
node scripts/measure_local_performance.mjs
```

The script fails if a marketing route fetches a deferred 3D/PDF runtime.

## Decision

The bundle split is acceptable for a staging closed-beta dry run. Public launch still requires a real staging deployment measurement with throttled network/CPU, authenticated Studio smoke, and a published portfolio fixture.
