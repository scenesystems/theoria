import { describe, expect, it } from "@effect/vitest"
import { Array as Arr, Chunk, Effect, Option, Ref, Schedule, Stream, Tuple } from "effect"

import * as Optimization from "../../src/Optimization.js"
import * as Pruning from "../../src/Pruning.js"
import * as Trial from "../../src/Trial.js"
import { decodeSlotConfig } from "../fixtures/scenarios/slot.js"
import {
  invalidReportObjective,
  invalidReportReasons,
  pruneSlotsBelowTwo,
  pruningSingleObjectiveResult,
  pruningSlotSpace,
  reportedSlotObjective,
  sequentialSlotSampler,
  stoppingSlotObjective
} from "../helpers/pruningScenarios.js"

const requireSome = <A>(option: Option.Option<A>): Effect.Effect<A> =>
  Option.match(option, {
    onNone: () => Effect.dieMessage("expected Some"),
    onSome: Effect.succeed
  })

describe("Optimization pruning and early stop contracts", () => {
  it.effect("marks pruned trials with typed metadata and excludes them from best selection", () =>
    Effect.gen(function*() {
      const optimized = yield* Optimization.run({
        space: yield* pruningSlotSpace,
        sampler: sequentialSlotSampler,
        direction: "minimize",
        trials: 4,
        pruningPolicy: pruneSlotsBelowTwo,
        objective: reportedSlotObjective
      })

      const resultOption = pruningSingleObjectiveResult(optimized)
      expect(Option.isSome(resultOption)).toBe(true)

      const result = yield* requireSome(resultOption)
      const trials = Arr.fromIterable(result.trials)
      const trialTags = Arr.map(trials, (trial) => trial.state._tag)

      expect(trialTags).toEqual(Arr.make("Pruned", "Pruned", "Completed", "Completed"))
      expect(result.bestTrial.trialNumber).toBe(2)
      expect(result.bestTrial.state.value).toBe(2)

      const firstPruned = yield* requireSome(Arr.get(trials, 0))
      Option.liftPredicate(firstPruned.state, Trial.isState("Pruned")).pipe(
        Option.map((state) => {
          expect(state.step).toBe(0)
          expect(state.reason).toBe("slot-below-two")
          expect(state.policy).toBe("slot-pruner")
        })
      )
    }))

  it.effect("surfaces invalid report semantics through typed InvalidObjectiveReport failures", () =>
    Effect.gen(function*() {
      const optimized = yield* Optimization.run({
        space: yield* pruningSlotSpace,
        sampler: sequentialSlotSampler,
        direction: "minimize",
        trials: 4,
        retrySchedule: Schedule.recurs(0),
        objective: invalidReportObjective
      })

      const resultOption = pruningSingleObjectiveResult(optimized)
      expect(Option.isSome(resultOption)).toBe(true)

      const result = yield* requireSome(resultOption)
      const reasons = invalidReportReasons(result.trials)

      expect(reasons).toHaveLength(3)
      expect(reasons).toContain("duplicate-step")
      expect(reasons).toContain("non-monotone-step")
      expect(reasons).toContain("value must be finite")
      expect(result.bestTrial.trialNumber).toBe(3)
    }))

  it.effect("honors Drain and Interrupt stop modes with deterministic heartbeat semantics", () =>
    Effect.gen(function*() {
      const drainHeartbeatRef = yield* Ref.make<Iterable<string>>(Arr.empty())
      const interruptHeartbeatRef = yield* Ref.make<Iterable<string>>(Arr.empty())

      const drainResult = yield* Optimization.run({
        space: yield* pruningSlotSpace,
        sampler: sequentialSlotSampler,
        direction: "minimize",
        trials: 3,
        stopMode: "Drain",
        objective: stoppingSlotObjective(drainHeartbeatRef, "drain-stop")
      })
      const interruptResult = yield* Optimization.run({
        space: yield* pruningSlotSpace,
        sampler: sequentialSlotSampler,
        direction: "minimize",
        trials: 3,
        stopMode: "Interrupt",
        objective: stoppingSlotObjective(interruptHeartbeatRef, "interrupt-stop")
      })

      const drainOption = pruningSingleObjectiveResult(drainResult)
      const interruptOption = pruningSingleObjectiveResult(interruptResult)
      expect(Option.isSome(drainOption)).toBe(true)
      expect(Option.isSome(interruptOption)).toBe(true)

      const [drain, interrupt] = yield* Effect.all(Tuple.make(
        requireSome(drainOption),
        requireSome(interruptOption)
      ))

      expect(drain.completionReason).toBe("interrupted")
      expect(interrupt.completionReason).toBe("interrupted")
      expect(drain.trials).toHaveLength(1)
      expect(interrupt.trials).toHaveLength(1)

      expect(yield* Ref.get(drainHeartbeatRef)).toEqual(Arr.of("Continue"))
      expect(yield* Ref.get(interruptHeartbeatRef)).toEqual(Arr.of("Stop"))
    }))

  it.effect("emits pruning and stop lifecycle events for semantic replay assertions", () =>
    Effect.gen(function*() {
      const events = yield* Stream.runCollect(
        Optimization.stream({
          space: yield* pruningSlotSpace,
          sampler: sequentialSlotSampler,
          direction: "minimize",
          trials: 3,
          stopMode: "Drain",
          pruningPolicy: {
            name: "always-prune",
            decide: ({ latestReport }) =>
              Pruning.prune({
                step: latestReport.step,
                reason: "always",
                policy: "always-prune"
              })
          },
          objective: (raw, runtime) =>
            Effect.gen(function*() {
              const config = yield* decodeSlotConfig(raw)
              yield* runtime.report(0, config.slot)
              yield* runtime.requestStop("stream-stop")
              return config.slot
            })
        })
      )

      const tags = Arr.map(Chunk.toReadonlyArray(events), (event) => event._tag)

      expect(tags).toContain("TrialReported")
      expect(tags).toContain("TrialPruned")
      expect(tags).toContain("StopRequested")
      expect(Arr.last(tags).pipe(Option.getOrElse(() => "missing"))).toBe("Completed")
    }))
})
