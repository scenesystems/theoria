import { BunRuntime } from "@effect/platform-bun"
import { expect } from "@playwright/test"
import {
  Array as Arr,
  Boolean as Bool,
  Clock,
  Config,
  Console,
  Effect,
  Fiber,
  Layer,
  Number as Num,
  Schema
} from "effect"

import { act, BrowserLive, nextResponse, openPage } from "./browser.js"
import { searchPhaseCount } from "./platform/in-page.js"
import { SiteLive } from "./site.js"

/**
 * Diagnostic only: locate cold readiness time between the network, first
 * trial, search completion and disc presence. Run separately from latency
 * samples. The same Worker root/port controls select either built artifact.
 */
const program = Effect.gen(function*() {
  const label = yield* Config.string("CLOSURE_LABEL")
  const width = yield* Config.integer("CLOSURE_WIDTH")
  const { context, failures, page } = yield* openPage({
    viewport: { width, height: Bool.match(Num.Equivalence(width, 390), { onFalse: () => 900, onTrue: () => 844 }) }
  })
  const cdp = yield* act(() => context.newCDPSession(page))
  yield* act(() => cdp.send("Performance.enable"))
  const build = yield* Effect.fork(nextResponse(page, "POST", "/api/imagined-place/build"))
  const started = yield* Clock.currentTimeMillis
  const milestone = (phase: string) =>
    Effect.gen(function*() {
      const at = yield* Clock.currentTimeMillis
      return { phase, ms: Num.subtract(at, started) }
    })
  yield* act(() => page.goto("/"))
  const loaded = yield* milestone("load")
  const response = yield* Fiber.join(build)
  const answered = yield* milestone("build-response")
  // Locator waits back off their polling interval. Reading the phase every
  // animation frame avoids making readiness depend on when the wait began.
  const firstTrial = yield* act(() => page.waitForFunction(searchPhaseCount, "running"))
  const running = yield* milestone("first-trial")
  yield* act(() => firstTrial.dispose())
  const finished = yield* act(() => page.waitForFunction(searchPhaseCount, "complete", { timeout: 20_000 }))
  const complete = yield* milestone("complete")
  yield* act(() => finished.dispose())
  yield* act(() => expect(page.locator("[data-place-stage='paper']")).toHaveAttribute("data-place-drawn", "kept"))
  yield* act(() => expect(page.locator("[data-place-trial]")).toHaveCount(36))
  yield* act(() => expect(page.locator("[data-place-marker]")).toHaveCount(5))
  yield* Effect.forEach(
    Arr.range(0, 4),
    (index) => act(() => expect(page.locator("[data-place-marker]").nth(index)).toHaveCSS("transform", "none"))
  )
  const atRest = yield* milestone("discs-at-rest")
  const body = yield* act(() => response.json())
  const envelope = yield* Schema.decodeUnknown(Schema.Struct({ data: Schema.Struct({ durationMs: Schema.Number }) }))(
    body
  )
  const metrics = yield* act(() => cdp.send("Performance.getMetrics"))
  const errors = yield* failures
  const row = {
    label,
    width,
    status: response.status(),
    milestones: [loaded, answered, running, complete, atRest],
    requestTiming: response.request().timing(),
    serverBuildMs: envelope.data.durationMs,
    metrics,
    errors
  }
  yield* Effect.flatMap(Schema.encode(Schema.parseJson())(row), Console.log)
  yield* act(() => cdp.detach())
}).pipe(Effect.scoped, Effect.provide(Layer.merge(SiteLive, BrowserLive)))

BunRuntime.runMain(program)
