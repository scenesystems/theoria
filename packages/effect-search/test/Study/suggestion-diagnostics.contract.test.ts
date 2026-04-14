import { describe, expect, it } from "@effect/vitest"
import { Chunk, Effect, Fiber, Match, Option, PubSub, Queue, Stream } from "effect"

import * as Sampler from "../../src/Sampler/index.js"
import * as SearchSpace from "../../src/SearchSpace/index.js"
import { eventPublisherFromPubSub } from "../../src/Study/events.js"
import * as Study from "../../src/Study/index.js"
import { normalizeSettings, optimizePlanFromOptions } from "../../src/Study/options.js"
import { initializeRuntime, StudyClockLayer } from "../../src/Study/runtime/runtimeState.js"
import { runConfiguredTrial } from "../../src/Study/runtime/trialExecution.js"
import { reserveTrialOrMarkSpaceExhausted } from "../../src/Study/runtime/trialReservation.js"
import * as StudyEvent from "../../src/StudyEvent/index.js"

const makeSpace = () =>
  SearchSpace.unsafeMake({
    x: SearchSpace.float(-1, 1),
    depth: SearchSpace.int(1, 3)
  })

describe("Study suggestion diagnostics", () => {
  it.effect("keeps reservation-local diagnostics bound to the reserved trial instead of shared runtime state", () =>
    Effect.scoped(
      Effect.gen(function*() {
        const optimizePlan = yield* optimizePlanFromOptions({
          space: makeSpace(),
          sampler: Sampler.random({ seed: 901 }),
          direction: "minimize",
          trials: 3,
          objective: () => Effect.succeed(0)
        })
        const settings = normalizeSettings(optimizePlan)
        const runtime = yield* initializeRuntime(settings).pipe(Effect.provide(StudyClockLayer))

        const firstReservation = yield* reserveTrialOrMarkSpaceExhausted(optimizePlan, settings, 0, runtime).pipe(
          Effect.provide(StudyClockLayer)
        )
        const secondReservation = yield* reserveTrialOrMarkSpaceExhausted(optimizePlan, settings, 1, runtime).pipe(
          Effect.provide(StudyClockLayer)
        )

        expect(Option.isSome(firstReservation)).toBe(true)
        expect(Option.isSome(secondReservation)).toBe(true)

        if (Option.isNone(firstReservation) || Option.isNone(secondReservation)) {
          return
        }

        expect(Option.isSome(firstReservation.value.diagnostics)).toBe(true)
        expect(Option.isSome(secondReservation.value.diagnostics)).toBe(true)

        if (Option.isNone(firstReservation.value.diagnostics) || Option.isNone(secondReservation.value.diagnostics)) {
          return
        }

        expect(firstReservation.value.running.trialNumber).toBe(0)
        expect(secondReservation.value.running.trialNumber).toBe(1)
        expect(firstReservation.value.diagnostics.value.pendingCount).toBe(0)
        expect(secondReservation.value.diagnostics.value.pendingCount).toBe(1)
      })
    ))

  it.effect("emits typed prepared-suggestion diagnostics when TPE reuses prepared state after startup", () =>
    Effect.scoped(
      Effect.gen(function*() {
        const handle = yield* Study.open({
          space: makeSpace(),
          sampler: Sampler.tpe({ seed: 714, nStartupTrials: 2, nEiCandidates: 8 }),
          direction: "minimize",
          trials: 4,
          objective: () => Effect.succeed(0)
        })

        const eventsFiber = yield* Study.events(handle).pipe(Stream.runCollect, Effect.fork)
        yield* Effect.yieldNow()

        const first = yield* Study.ask(handle)
        yield* Study.tell(handle, first.trialNumber, 0.5)

        const second = yield* Study.ask(handle)
        yield* Study.tell(handle, second.trialNumber, 0.25)

        yield* Study.ask(handle)
        yield* Study.cancel(handle)

        const events = Chunk.toReadonlyArray(yield* Fiber.join(eventsFiber))
        const preparedEvent = [...events].reverse().find(
          (event) =>
            Match.value(event).pipe(
              Match.tag(
                "TrialStarted",
                ({ diagnostics }) => diagnostics?.preparedStateKind === "effect-search/tpe/model-context"
              ),
              Match.orElse(() => false)
            )
        )

        const diagnosticsOption = Option.fromNullable(preparedEvent).pipe(
          Option.flatMap((event) =>
            Match.value(event).pipe(
              Match.tag("TrialStarted", ({ diagnostics }) => Option.fromNullable(diagnostics)),
              Match.orElse(() => Option.none())
            )
          )
        )

        expect(Option.isSome(diagnosticsOption)).toBe(true)

        if (Option.isNone(diagnosticsOption)) {
          return
        }

        expect(StudyEvent.isStudyEvent(preparedEvent)).toBe(true)
        expect(diagnosticsOption.value.samplerKind).toBe("Tpe")
        expect(diagnosticsOption.value.reusedPreparedState).toBe(true)
        expect(diagnosticsOption.value.completedCount).toBe(2)
        expect(diagnosticsOption.value.pendingCount).toBe(0)
        expect(diagnosticsOption.value.belowCount).toBeGreaterThan(0)
        expect(diagnosticsOption.value.aboveCount).toBeGreaterThan(0)
      })
    ))

  it.effect("does not leak sampler diagnostics into configured-trial TrialStarted events", () =>
    Effect.scoped(
      Effect.gen(function*() {
        const optimizePlan = yield* optimizePlanFromOptions({
          space: makeSpace(),
          sampler: Sampler.random({ seed: 917 }),
          direction: "minimize",
          trials: 3,
          objective: () => Effect.succeed(0)
        })
        const settings = normalizeSettings(optimizePlan)
        const pubsub = yield* PubSub.unbounded<StudyEvent.StudyEvent>()
        const eventQueue = yield* PubSub.subscribe(pubsub)

        yield* Effect.addFinalizer(() => PubSub.shutdown(pubsub))

        const runtime = yield* initializeRuntime(settings, [], eventPublisherFromPubSub(pubsub)).pipe(
          Effect.provide(StudyClockLayer)
        )

        const reserved = yield* reserveTrialOrMarkSpaceExhausted(optimizePlan, settings, 0, runtime).pipe(
          Effect.provide(StudyClockLayer)
        )

        expect(Option.isSome(reserved)).toBe(true)

        yield* runConfiguredTrial(
          optimizePlan,
          settings,
          Study.neverPruningPolicy,
          1,
          { x: 0.25, depth: 2 },
          runtime,
          Option.none()
        ).pipe(Effect.provide(StudyClockLayer))

        const startedEvent = yield* Queue.take(eventQueue)

        expect(startedEvent._tag).toBe("TrialStarted")

        if (startedEvent._tag !== "TrialStarted") {
          return
        }

        expect(startedEvent.trialNumber).toBe(1)
        expect(startedEvent.diagnostics).toBeUndefined()
      })
    ))
})
