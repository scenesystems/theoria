import { Array as Arr, Cause, Effect, Match, Number as Num, Option, Ref, Schema } from "effect"

import { EventRuntime, noopEventPublisher } from "../../src/internal/study/events.js"
import * as Pruning from "../../src/Pruning.js"
import { pendingAsZeroPolicy } from "../../src/Sampler.js"
import * as Sampler from "../../src/Sampler.js"
import { InvalidObjectiveReport } from "../../src/SearchError.js"
import type * as Study from "../../src/Study.js"
import * as Trial from "../../src/Trial.js"
import { decodeSlotConfig, makeSlotSpace } from "../fixtures/scenarios/slot.js"

export const decodePruningTraceValue = (value: number | "NaN" | "Infinity" | "-Infinity"): number =>
  Match.value(value).pipe(
    Match.when("NaN", () => Number.NaN),
    Match.when("Infinity", () => Number.POSITIVE_INFINITY),
    Match.when("-Infinity", () => Number.NEGATIVE_INFINITY),
    Match.orElse((numeric) => numeric)
  )

export const pruningReportTrace = (reports: Iterable<Pruning.Report>) =>
  Arr.map(Arr.fromIterable(reports), (report) => ({
    step: report.step,
    value: report.value
  }))

export const makePruningEventRuntime = (): Effect.Effect<EventRuntime> =>
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

export const pruningSlotSpace = makeSlotSpace(32)

export const sequentialSlotSampler = new Sampler.Sampler({
  kind: Sampler.Random({ options: { seed: 0 } }),
  pendingImputationPolicy: pendingAsZeroPolicy,
  checkpoint: Effect.succeed({
    _tag: "Random",
    seed: 0
  }),
  restore: () => Effect.void,
  suggest: (_space, context) => Effect.succeed({ slot: context.nextTrialNumber })
})

export const pruningSingleObjectiveResult = (
  result: Study.Result
): Option.Option<Study.SingleObjectiveResult> =>
  Match.value(result).pipe(
    Match.tag("SingleObjective", (single) => Option.some(single)),
    Match.orElse(() => Option.none())
  )

export const pruneSlotsBelowTwo = new Pruning.Policy({
  name: "slot-pruner",
  decide: ({ latestReport }) =>
    Match.value(Num.lessThan(latestReport.value, 2)).pipe(
      Match.when(true, () =>
        Pruning.prune({
          step: latestReport.step,
          reason: "slot-below-two",
          policy: "slot-pruner"
        })),
      Match.orElse(() => Pruning.continueEvaluation())
    )
})

export const reportedSlotObjective = (raw: unknown, runtime: Pruning.Runtime) =>
  Effect.gen(function*() {
    const config = yield* decodeSlotConfig(raw)

    yield* runtime.report(0, config.slot)
    yield* runtime.report(1, config.slot)

    return config.slot
  })

export const invalidReportObjective = (raw: unknown, runtime: Pruning.Runtime) =>
  Effect.gen(function*() {
    const config = yield* decodeSlotConfig(raw)

    yield* Match.value(config.slot).pipe(
      Match.when(0, () =>
        Effect.gen(function*() {
          yield* runtime.report(0, 1)
          yield* runtime.report(0, 2)
        })),
      Match.when(1, () =>
        Effect.gen(function*() {
          yield* runtime.report(1, 1)
          yield* runtime.report(0, 2)
        })),
      Match.when(2, () => runtime.report(0, Number.NaN).pipe(Effect.asVoid)),
      Match.orElse(() => runtime.report(0, 3).pipe(Effect.asVoid))
    )

    return config.slot
  })

export const stoppingSlotObjective = (
  heartbeatRef: Ref.Ref<Array<string>>,
  stopReason: string
) =>
(raw: unknown, runtime: Pruning.Runtime) =>
  Effect.gen(function*() {
    const config = yield* decodeSlotConfig(raw)

    yield* runtime.requestStop(stopReason)
    const heartbeat = yield* runtime.heartbeat
    yield* Ref.update(heartbeatRef, (entries) => Arr.append(entries, heartbeat._tag))
    yield* runtime.report(0, Num.sum(config.slot, 10))

    return config.slot
  })

export const invalidReportReasons = (trials: Iterable<Trial.Trial<unknown>>): Array<string> => {
  const isInvalidObjectiveReport = Schema.is(InvalidObjectiveReport)
  const reasonFromFailure = (failure: unknown): Array<string> =>
    Option.liftPredicate(failure, isInvalidObjectiveReport).pipe(
      Option.match({
        onNone: () => [],
        onSome: (invalidReport) => [invalidReport.reason]
      })
    )

  return Arr.flatMap(Arr.fromIterable(trials), (trial) =>
    Trial.matchState({
      Running: () => [],
      Completed: () => [],
      Pruned: () => [],
      Cancelled: () => [],
      Failed: ({ error }) =>
        Option.liftPredicate(Cause.isCause)(error.cause).pipe(
          Option.match({
            onNone: () => reasonFromFailure(error.cause),
            onSome: (cause) =>
              Cause.failureOption(cause).pipe(
                Option.match({
                  onNone: () => [],
                  onSome: reasonFromFailure
                })
              )
          })
        )
    })(trial.state))
}
