/**
 * Ask/tell + progress composition through the effectSearchInterop seam.
 */
import { describe, expect, it } from "@effect/vitest"
import { Array as Arr, Effect, Fiber, Option, Ref, Stream } from "effect"
import { SearchSpace } from "effect-search"
import { effectSearchInterop } from "../../src/optimizers/effectSearchInterop/index.js"

const makeSpace = () =>
  SearchSpace.unsafeMake({
    x: SearchSpace.float(0, 1)
  })

describe("integration/effectSearchInterop ask/tell", () => {
  it.effect("orchestrates ask/tell via a single interop seam and returns stable summaries", () =>
    Effect.scoped(
      Effect.gen(function*() {
        const space = makeSpace()
        const sampler = effectSearchInterop.makeTpeSampler({
          seed: 71,
          acquisition: "ei"
        })

        const handle = yield* effectSearchInterop.open({
          direction: "maximize",
          space,
          sampler,
          trials: 2,
          objective: () => Effect.succeed(0),
          concurrency: 1
        })
        const eventFiber = yield* Stream.runCollect(effectSearchInterop.events(handle)).pipe(Effect.fork)

        const first = yield* effectSearchInterop.ask(handle)
        yield* effectSearchInterop.tell(handle, first.trialNumber, first.config.x)

        const second = yield* effectSearchInterop.ask(handle)
        yield* effectSearchInterop.tell(handle, second.trialNumber, second.config.x)

        const snapshot = yield* effectSearchInterop.snapshot(handle)
        const result = yield* effectSearchInterop.result(handle)
        const summary = effectSearchInterop.resultSummary(result)
        const events = yield* Fiber.join(eventFiber)
        const eventTags = Arr.map(Arr.fromIterable(events), (event) => event._tag)

        expect(snapshot.trials).toHaveLength(2)
        expect(summary.kind).toBe("SingleObjective")
        expect(summary.trialCount).toBe(2)
        expect(Option.isSome(summary.bestTrialNumber)).toBe(true)
        expect(eventTags).toContain("TrialStarted")
        expect(eventTags).toContain("TrialCompleted")
        expect(eventTags).toContain("StudyCompleted")
      })
    ))

  it.effect("composes progress lines with consumer telemetry without mutating event flow", () =>
    Effect.scoped(
      Effect.gen(function*() {
        const space = makeSpace()
        const sampler = effectSearchInterop.makeTpeSampler({
          seed: 97,
          acquisition: "pi"
        })

        const handle = yield* effectSearchInterop.open({
          direction: "maximize",
          space,
          sampler,
          trials: 1,
          objective: () => Effect.succeed(0),
          concurrency: 1
        })

        const telemetryRef = yield* Ref.make(Arr.empty<string>())
        const streamedEvents = effectSearchInterop.eventsWithProgress(
          handle,
          (line) => Ref.update(telemetryRef, (telemetry) => Arr.append(telemetry, line.text)),
          { renderMode: "plain" }
        )
        const progressFiber = yield* Stream.runCollect(streamedEvents).pipe(Effect.fork)

        const asked = yield* effectSearchInterop.ask(handle)
        yield* effectSearchInterop.tell(handle, asked.trialNumber, asked.config.x)

        const progressEvents = yield* Fiber.join(progressFiber)
        const progressEventTags = Arr.map(Arr.fromIterable(progressEvents), (event) => event._tag)
        const telemetry = yield* Ref.get(telemetryRef)

        expect(progressEventTags).toContain("StudyCompleted")
        expect(telemetry.length).toBeGreaterThan(0)
        expect(Arr.some(telemetry, (line) => line.includes("trial#0"))).toBe(true)
      })
    ))
})
