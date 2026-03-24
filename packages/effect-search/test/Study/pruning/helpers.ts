import { Cause, Effect, Match, Option, Ref, Schema } from "effect"

import { InvalidObjectiveReport } from "../../../src/Errors/index.js"
import { decodeSlotConfig, makeSlotSpace } from "../../../src/experimental/scenarios/slot.js"
import { pendingAsZeroImputationPolicy } from "../../../src/Sampler/index.js"
import * as Sampler from "../../../src/Sampler/index.js"
import { EventRuntime, noopEventPublisher } from "../../../src/Study/events.js"
import * as Study from "../../../src/Study/index.js"
import * as Trial from "../../../src/Trial/index.js"

export const decodeTraceValue = (value: number | "NaN" | "Infinity" | "-Infinity"): number =>
  Match.value(value).pipe(
    Match.when("NaN", () => Number.NaN),
    Match.when("Infinity", () => Number.POSITIVE_INFINITY),
    Match.when("-Infinity", () => Number.NEGATIVE_INFINITY),
    Match.orElse((numeric) => numeric)
  )

export const reportSnapshot = (reports: ReadonlyArray<Study.IntermediateReport>) =>
  reports.map((report) => ({
    step: report.step,
    value: report.value
  }))

export const makeFixtureEventRuntime = (): Effect.Effect<EventRuntime> =>
  Effect.all({
    bestValueRef: Ref.make<Option.Option<number>>(Option.none()),
    noImprovementCountRef: Ref.make(0)
  }).pipe(
    Effect.map(({ bestValueRef, noImprovementCountRef }) =>
      new EventRuntime({
        bestValueRef,
        noImprovementCountRef,
        eventPublisher: noopEventPublisher
      })
    )
  )

export const makeSpace = () => makeSlotSpace(32)

export const deterministicSampler = new Sampler.Sampler({
  kind: Sampler.Random({ options: { seed: 0 } }),
  pendingImputationPolicy: pendingAsZeroImputationPolicy,
  checkpoint: Effect.succeed({
    _tag: "Random",
    seed: 0
  }),
  restore: () => Effect.void,
  suggest: (_space, context) => Effect.succeed({ slot: context.nextTrialNumber })
})

export const asSingleObjective = (result: Study.StudyResult) =>
  result._tag === "SingleObjective" ? Option.some(result) : Option.none()

export const pruneLowSlotPolicy = new Study.PruningPolicy({
  name: "slot-pruner",
  decide: ({ latestReport }) =>
    latestReport.value < 2
      ? Study.PruneTrialDecision({
        step: latestReport.step,
        reason: "slot-below-two",
        policy: "slot-pruner"
      })
      : Study.ContinuePruneDecision()
})

export const objectiveWithReports = (raw: unknown, runtime: Study.ObjectiveTrialRuntime) =>
  Effect.gen(function*() {
    const config = decodeSlotConfig(raw)

    yield* runtime.report(0, config.slot)
    yield* runtime.report(1, config.slot)

    return config.slot
  })

export const objectiveWithInvalidReports = (raw: unknown, runtime: Study.ObjectiveTrialRuntime) =>
  Effect.gen(function*() {
    const config = decodeSlotConfig(raw)

    yield* Match.value(config.slot).pipe(
      Match.when(0, () =>
        Effect.gen(function*() {
          yield* runtime.report(0, 1)
          yield* runtime.report(0, 2)

          return undefined
        })),
      Match.when(1, () =>
        Effect.gen(function*() {
          yield* runtime.report(1, 1)
          yield* runtime.report(0, 2)

          return undefined
        })),
      Match.when(2, () => runtime.report(0, Number.NaN).pipe(Effect.as(undefined))),
      Match.orElse(() => runtime.report(0, 3).pipe(Effect.as(undefined)))
    )

    return config.slot
  })

export const objectiveWithStopProbe = (
  heartbeatRef: Ref.Ref<ReadonlyArray<string>>,
  stopReason: string
) =>
(raw: unknown, runtime: Study.ObjectiveTrialRuntime) =>
  Effect.gen(function*() {
    const config = decodeSlotConfig(raw)

    yield* runtime.requestStop(stopReason)
    const heartbeat = yield* runtime.heartbeat
    yield* Ref.update(heartbeatRef, (entries) => [...entries, heartbeat._tag])
    yield* runtime.report(0, config.slot + 10)

    return config.slot
  })

export const reportFailureReasons = (trials: ReadonlyArray<Trial.Trial<unknown>>): Array<string> => {
  const isInvalidObjectiveReport = Schema.is(InvalidObjectiveReport)

  return trials.flatMap((trial) =>
    Trial.matchState({
      Running: () => [],
      Completed: () => [],
      Pruned: () => [],
      Cancelled: () => [],
      Failed: ({ error }) =>
        Option.liftPredicate(Cause.isCause)(error.cause).pipe(
          Option.match({
            onNone: () =>
              isInvalidObjectiveReport(error.cause)
                ? [error.cause.reason]
                : [],
            onSome: (cause) =>
              Cause.failureOption(cause).pipe(
                Option.match({
                  onNone: () => [],
                  onSome: (failure) =>
                    isInvalidObjectiveReport(failure)
                      ? [failure.reason]
                      : []
                })
              )
          })
        )
    })(trial.state)
  )
}
