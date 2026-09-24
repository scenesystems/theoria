import { BunRuntime } from "@effect/platform-bun"
import { expect, type Page } from "@playwright/test"
import {
  Array as Arr,
  Boolean as Bool,
  Clock,
  Config,
  Console,
  Data,
  Effect,
  Fiber,
  Layer,
  Match,
  Number as Num,
  Option,
  Schema,
  String as Str
} from "effect"

import { type PlaceScenario, placeScenarioMeta, placeScenarioRecordings } from "../../app/contracts/imagined-place.js"
import { webVitalBudgets } from "../../app/contracts/performance.js"
import { act, addInitProbe, Browser, BrowserLive, evaluate, nextResponse, openPage } from "./browser.js"
import { recordedWebVitals, recordWebVitals } from "./platform/in-page.js"
import { Site, SiteLive } from "./site.js"

/**
 * One finite, fresh-browser sample against the actual deploy bundle. Run the
 * same program for both artifacts; THEORIA_WORKER_ROOT selects the artifact,
 * THEORIA_WORKER_PORT pins its origin. No profiler, probe bundle, heap/GC or
 * in-page observer is installed in latency mode. The external durations
 * include automation and waiting overhead; they are not Event Timing/INP.
 */
class ClosureFailure extends Data.TaggedError("ClosureFailure")<{ readonly message: string }> {}

const check = (holds: boolean, message: string) =>
  Effect.unless(Effect.fail(new ClosureFailure({ message })), () => holds)
const emit = (row: unknown) => Effect.flatMap(Schema.encode(Schema.parseJson())(row), Console.log)
const elapsed = (start: number) => Effect.map(Clock.currentTimeMillis, (end) => Num.subtract(end, start))
const sequence: ReadonlyArray<PlaceScenario> = ["lost-market", "drowned-library", "unfinished-light"]

// These assertions consume the rendered result, not a successful network
// response or a stale 'complete' from the preceding scenario. No in-page
// probe bundle is needed, including in the unprofiled samples.
const complete = (page: Page, scenario: PlaceScenario) =>
  Effect.gen(function*() {
    yield* act(() =>
      expect(page.getByRole("textbox", { name: "Brief" })).toHaveValue(placeScenarioMeta[scenario].brief)
    )
    yield* act(() =>
      page.locator("[data-place-render-phase='complete']").waitFor({ state: "attached", timeout: 20_000 })
    )
    yield* act(() => expect(page.locator("[data-place-stage='paper']")).toHaveAttribute("data-place-drawn", "kept"))
    const features = Arr.append(
      placeScenarioRecordings[scenario].composition.features,
      placeScenarioRecordings[scenario].neighbor
    )
    yield* act(() => expect(page.locator("[data-place-marker]")).toHaveCount(Arr.length(features)))
    yield* Effect.forEach(
      features,
      (feature) =>
        Effect.gen(function*() {
          const disc = page.locator(`[data-place-marker="${feature.name}"]`)
          yield* act(() => expect(disc).toHaveCount(1))
          yield* act(() => expect(disc).toHaveCSS("transform", "none"))
        })
    )
    yield* act(() => expect(page.locator("[data-place-trial]")).toHaveCount(36))
    yield* act(() => expect(page.locator("[data-place-marker-leaving]")).toHaveCount(0))
    yield* act(() => expect(page.locator("[data-place-line]").first()).not.toHaveText(""))
  })

const sample = Effect.gen(function*() {
  const mode = yield* Config.literal("latency", "vitals", "heap")("CLOSURE_MODE")
  const label = yield* Config.string("CLOSURE_LABEL")
  const width = yield* Config.integer("CLOSURE_WIDTH")
  const height = Bool.match(Num.Equivalence(width, 390), { onFalse: () => 900, onTrue: () => 844 })
  const site = yield* Site
  const browser = yield* Browser
  const { context, failures, page } = yield* openPage({ viewport: { width, height } })
  yield* emit({ kind: "environment", label, mode, width, height, url: site.url, browser: browser.chromium.version() })
  yield* Effect.when(addInitProbe(page, recordWebVitals), () => Str.Equivalence(mode, "vitals"))
  const started = yield* Clock.currentTimeMillis
  const response = yield* act(() => page.goto("/"))
  yield* check(
    Option.exists(Option.fromNullable(response), (response) => Num.Equivalence(response.status(), 200)),
    "shell failed"
  )
  const loadMs = yield* elapsed(started)
  yield* complete(page, "unfinished-light")
  const drawnMs = yield* elapsed(started)
  yield* emit({ kind: "cold", label, mode, width, loadMs, drawnMs })
  // Let the finite intro/presence animations settle before beginning actions.
  yield* Effect.sleep("2 seconds")

  const readVitals = (phase: string) =>
    Effect.gen(function*() {
      const vitals = yield* evaluate(page, recordedWebVitals)
      yield* emit({ kind: "vitals", label, width, phase, ...vitals })
      const observed = yield* Schema.decodeUnknown(Schema.Struct({
        lcp: Schema.NumberFromString,
        layoutShiftTotal: Schema.NumberFromString,
        inp: Schema.String,
        interactions: Schema.NumberFromString
      }))(vitals)
      yield* check(Num.lessThanOrEqualTo(observed.lcp, webVitalBudgets.lcpMs), "LCP exceeded budget")
      yield* check(Num.lessThanOrEqualTo(observed.layoutShiftTotal, webVitalBudgets.cls), "shift total exceeded budget")
      yield* Option.match(Num.parse(observed.inp), {
        onNone: () => Effect.void,
        onSome: (inp) => check(Num.lessThanOrEqualTo(inp, webVitalBudgets.inpMs), "INP exceeded budget")
      })
      return observed
    })
  yield* Effect.when(readVitals("cold"), () => Str.Equivalence(mode, "vitals"))

  const change = (scenario: PlaceScenario, cycle: number, inspect: boolean) =>
    Effect.gen(function*() {
      const radio = page.getByRole("radiogroup", { name: "Scenario" }).getByRole("radio", {
        name: placeScenarioMeta[scenario].label
      })
      yield* act(() => radio.scrollIntoViewIfNeeded())
      const rebuild = yield* Effect.fork(nextResponse(page, "POST", "/api/imagined-place/build"))
      const start = yield* Clock.currentTimeMillis
      yield* act(() => radio.click())
      const response = yield* Fiber.join(rebuild)
      yield* check(Num.Equivalence(response.status(), 200), `build ${scenario}: ${String(response.status())}`)
      yield* act(() => page.locator("[data-place-render-phase='running']").waitFor({ state: "attached" }))
      yield* Effect.when(
        Effect.gen(function*() {
          const inspector = page.getByRole("button", { name: "effect-dsp", exact: true })
          yield* act(() => inspector.scrollIntoViewIfNeeded())
          const inspectorStart = yield* Clock.currentTimeMillis
          yield* act(() => inspector.click())
          yield* act(() => page.locator("[data-docs-link-preview]").waitFor({ state: "visible" }))
          const inspectorMs = yield* elapsed(inspectorStart)
          const phase = yield* act(() => page.locator("[data-place-trace]").getAttribute("data-place-render-phase"))
          yield* check(
            Bool.not(Option.contains(Option.fromNullable(phase), "complete")),
            "inspector missed running search"
          )
          yield* emit({ kind: "inspector", label, mode, width, cycle, scenario, inspectorMs, phase })
        }),
        () => inspect
      )
      yield* complete(page, scenario)
      const completionMs = yield* elapsed(start)
      yield* emit({
        kind: "scenario",
        label,
        mode,
        width,
        cycle,
        scenario,
        completionMs,
        status: response.status(),
        trials: 36
      })
      yield* Effect.when(
        Effect.gen(function*() {
          yield* act(() => page.keyboard.press("Escape"))
          yield* act(() => page.locator("[data-docs-link-preview]").waitFor({ state: "hidden" }))
        }),
        () => inspect
      )
      yield* Effect.sleep("500 millis")
    })
  const cycles = (count: number, inspect: boolean) =>
    Effect.forEach(
      Arr.range(1, count),
      (cycle) => Effect.forEach(sequence, (scenario) => change(scenario, cycle, inspect))
    )

  yield* Match.value(mode).pipe(
    Match.when("heap", () =>
      Effect.gen(function*() {
        // Warm every fixture and lazy chunk before the retained-growth baseline.
        // CDP heap measurements observe the page isolate, not browser RSS nor
        // the dedicated search worker's heap. No allocation/CPU profiling.
        yield* cycles(1, false)
        const cdp = yield* act(() => context.newCDPSession(page))
        const heap = (phase: string) =>
          Effect.gen(function*() {
            yield* Effect.sleep("2 seconds")
            const raw = yield* act(() => cdp.send("Runtime.getHeapUsage"))
            yield* act(() => cdp.send("HeapProfiler.collectGarbage"))
            const collected = yield* act(() => cdp.send("Runtime.getHeapUsage"))
            const dom = yield* act(() => cdp.send("Memory.getDOMCounters"))
            yield* emit({ kind: "heap", label, width, phase, raw, collected, dom, workers: Arr.length(page.workers()) })
          })
        yield* heap("baseline-after-warmup")
        yield* cycles(3, false)
        yield* heap("after-3-cycles")
        yield* cycles(3, false)
        yield* heap("after-6-cycles")
        yield* act(() => page.getByRole("link", { name: "Browse the packages", exact: true }).click())
        yield* act(() => page.waitForURL("**/docs"))
        yield* act(() => expect(page.locator("[data-place-stage='paper']")).toHaveCount(0))
        // Atom/worker disposal has a TTL; record both prompt and delayed cleanup.
        yield* heap("route-cleanup")
        yield* Effect.sleep("15 seconds")
        yield* heap("route-cleanup-after-15s")
        yield* act(() => cdp.detach())
      })),
    Match.orElse(() => cycles(2, true))
  )
  yield* Effect.when(
    Effect.gen(function*() {
      const vitals = yield* readVitals("after-actions")
      yield* check(
        Num.Equivalence(vitals.interactions, 18),
        "expected six scenario, six inspector and six Escape interactions"
      )
    }),
    () => Str.Equivalence(mode, "vitals")
  )
  const errors = yield* failures
  yield* emit({ kind: "completion", label, mode, width, errors })
  yield* check(Arr.isEmptyReadonlyArray(errors), "browser reported errors")
}).pipe(Effect.scoped, Effect.provide(Layer.merge(SiteLive, BrowserLive)))

const program = Effect.gen(function*() {
  const serve = yield* Config.boolean("CLOSURE_SERVE").pipe(Config.withDefault(false))
  yield* Bool.match(serve, {
    onFalse: () => sample,
    onTrue: () =>
      Effect.flatMap(Site, (site) => Effect.andThen(Console.log(site.url), Effect.never)).pipe(Effect.provide(SiteLive))
  })
})

BunRuntime.runMain(program)
