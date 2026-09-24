# Finite homepage performance comparison

`performance-closure.ts` runs one fresh Chromium process against the actual
deployable Worker and built assets, using the existing `SiteLive` and
`BrowserLive` harnesses. It is an explicit experiment, not part of every test
run. No production deployment or production-isolate CPU measurement is involved.

Build each source in its own worktree with its frozen lockfile:

```sh
bun install --frozen-lockfile
bun run --filter @theoria/theoria-app build:web
bun run --filter @theoria/theoria-app deploy:dry-run
bun run --filter @theoria/theoria-app build:check
```

Install the current lockfile's Chromium with `bunx playwright install chromium`
from `apps/theoria`. Record its version and executable SHA256. The **current**
harness drives both artifacts with the same installed browser and dependencies;
the historical application is built with its own frozen dependencies, not linked
to current workspace packages. Compare the relevant dependency versions too.

From the current repository root, use an empty evidence directory and a supervised
orb service (absolute historical-worktree path):

```sh
mkdir -p .amp/in/artifacts/performance-closure
amp orb service start closure-measurements --command 'bash apps/theoria/test/worker/performance-closure.sh /absolute/historical-worktree .amp/in/artifacts/performance-closure'
```

The directory's `run-once` guard refuses supervisor retries. A failed run leaves
its evidence intact; investigate it rather than overwriting it with a retry.
The service logs report each finished sample; the JSON log's `completion` row,
not the service state alone, proves that sample finished.

## Inventory fixed before measurement

Both 1440×900 and 390×844 use light mode, normal motion, desktop pointer behavior,
no CPU/network throttling, and the same origin `http://127.0.0.1:8787/`.
The narrow viewport is not a physical phone or touchscreen benchmark.

| Mode    | Per source × viewport                                             | Measurements and acceptance                                                                                                                                                                                            |
| ------- | ----------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| latency | 4 cold loads; 6 scenario changes and 6 inspector presses per load | External navigation-to-load, navigation-to-rendered-completion, scenario-to-completion, inspector-to-visible durations. Two H–C–C–H blocks, including adjacent same-source controls. No new relative timing threshold. |
| vitals  | 1 cold load; 6 changes and 6 inspector presses                    | Existing LCP ≤2500 ms, lifetime shift total ≤0.1 (a conservative upper bound on CLS), INP ≤200 ms; Event Timing durations plus interaction counts.                                                                     |
| heap    | 2 cold loads; 1 warm-up cycle, then 6 measured cycles per load    | Raw and post-GC page-isolate heap at baseline, 3 cycles, 6 cycles, SPA route cleanup, and 15 seconds later. H–C–C–H order; absolute heap separately from retained growth. No invented leak threshold.                  |

Total: **28 fresh browser processes, 288 scenario changes, 120 inspector presses**.
Each latency/vitals session also has six Escape dismissals: 18 interactions,
with inspector/scenario external durations in separate rows. The browser's final
Event Timing durations include dismissals; they are not an action-labelled
distribution. Interactions below the observer's 16 ms reporting threshold are
censored, not zero-duration samples. Report observed quantiles and maxima, never
a production p99 guarantee from these small samples.

The cycle is Lost market → Drowned library → Unfinished light, using the existing
recorded fixtures. Every change requires build HTTP 200, the search's running
phase, the selected brief, all five expected feature discs at rest, 36 trials,
kept paper, no departing discs, and nonempty rendered prose. Inspector presses
must show their preview before the search completes. Every session requires no
browser console/page errors. Cleanup follows the real Browse the packages link
to `/docs` and verifies the stage unmounted; it does not reset the document to
`about:blank` and call that collection.

## Measurement boundaries

Latency mode never injects the in-page probe bundle, installs a PerformanceObserver,
collects garbage, starts a profiler, or captures screenshots. Timings use the
external Effect clock and include automation/assertion waiting overhead. Browser
launch and Worker startup are outside the cold-page interval; browser caches are
fresh, but OS caches are not purged, and SiteLive's asset preflight precedes the
navigation. These are cold **page** loads, not end-to-end process startup times.
Keep builds, tests, and other browsers out of the timed batch.

Vitals use the existing `recordWebVitals` probe in separate processes. Heap mode
uses CDP `Runtime.getHeapUsage`, `HeapProfiler.collectGarbage`, and
`Memory.getDOMCounters`, also separately. `usedSize` is JS heap in the page's V8
isolate, including browser automation worlds; it is not RSS, total browser memory,
or the dedicated search worker's heap. The log also records live page workers,
DOM nodes, documents, and listeners. Route cleanup can load docs modules, so its
absolute heap need not equal the homepage baseline. Compare retained growth
between checkpoints and same-source controls before inferring a leak.

The first-paint script budget (524,288 gzip bytes), normal Worker profile, and
four root gates remain independent acceptance checks. Historical/current timing
ratios do not waive them.

## Distinguish readiness from automation polling

`performance-cold.ts` is a separately instrumented diagnostic. It reads CDP
Performance metrics, the real build request's timing, and the server's reported
build duration. It records load, build response, first trial, complete phase, and
all discs at rest. Its search-phase predicates use animation-frame polling;
they observe DOM state before rendering, not pixel presentation timestamps.

Playwright 1.62.1 locator waits back off through 0, 20, 50, 100, 100, then repeated
500 ms delays. Re-anchoring a locator wait can move its answer by nearly 500 ms
without changing the application. The source is
[Frame.waitForSelector and retryWithProgressAndBackoff](https://github.com/microsoft/playwright/blob/v1.62.1/packages/playwright-core/src/server/frames.ts).
Do not attribute such a readiness difference to the app without checking it with
finer polling. Never replace or mix the original unprofiled rows with these
diagnostic timings.

Run one diagnostic with `CLOSURE_LABEL`, `CLOSURE_WIDTH`, `THEORIA_WORKER_ROOT`,
and `THEORIA_WORKER_PORT=8787` set, using:

```sh
bun apps/theoria/test/worker/performance-cold.ts
```

For the closure that introduced this runner, two additional diagnostic batches
were declared before running: eight loads each, H–C–C–H at each viewport. The
first re-anchored locator waits; the second used frame polling. The raw evidence
retains both, including the first diagnostic's source before the polling change.
Neither batch makes a production p99 or billed-CPU claim.
