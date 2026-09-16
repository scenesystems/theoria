import { describe, expect, it } from "@effect/vitest"
import { Array as Arr, Chunk, Effect, Option, Ref, Schedule, Stream } from "effect"

import * as Pruning from "../../src/Pruning.js"
import * as Study from "../../src/Study.js"
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

describe("Study pruning and early stop contracts", () => {
  it.effect("marks pruned trials with typed metadata and excludes them from best selection", () =>
    Effect.gen(function*() {
      const optimized = yield* Study.optimize({
        space: yield* pruningSlotSpace,
        sampler: sequentialSlotSampler,
        direction: "minimize",
        trials: 4,
        pruningPolicy: pruneSlotsBelowTwo,
        objective: reportedSlotObjective
      })

      const resultOption = pruningSingleObjectiveResult(optimized)
      expect(Option.isSome(resultOption)).toBe(true)

      if (Option.isNone(resultOption)) {
        return
      }

      const result = resultOption.value
      const trials = Arr.fromIterable(result.trials)
      const trialTags = Arr.map(trials, (trial) => trial.state._tag)

      expect(trialTags).toEqual(["Pruned", "Pruned", "Completed", "Completed"])
      expect(result.bestTrial.trialNumber).toBe(2)
      expect(result.bestTrial.state.value).toBe(2)

      const firstPruned = Arr.get(trials, 0).pipe(Option.getOrThrow)
      if (firstPruned && Trial.isState("Pruned")(firstPruned.state)) {
        expect(firstPruned.state.step).toBe(0)
        expect(firstPruned.state.reason).toBe("slot-below-two")
        expect(firstPruned.state.policy).toBe("slot-pruner")
      }
    }))

  it.effect("surfaces invalid report semantics through typed InvalidObjectiveReport failures", () =>
    Effect.gen(function*() {
      const optimized = yield* Study.optimize({
        space: yield* pruningSlotSpace,
        sampler: sequentialSlotSampler,
        direction: "minimize",
        trials: 4,
        retrySchedule: Schedule.recurs(0),
        objective: invalidReportObjective
      })

      const resultOption = pruningSingleObjectiveResult(optimized)
      expect(Option.isSome(resultOption)).toBe(true)

      if (Option.isNone(resultOption)) {
        return
      }

      const result = resultOption.value
      const reasons = invalidReportReasons(result.trials)

      expect(reasons).toHaveLength(3)
      expect(reasons).toContain("duplicate-step")
      expect(reasons).toContain("non-monotone-step")
      expect(reasons).toContain("value must be finite")
      expect(result.bestTrial.trialNumber).toBe(3)
    }))

  it.effect("honors Drain and Interrupt stop modes with deterministic heartbeat semantics", () =>
    Effect.gen(function*() {
      const drainHeartbeatRef = yield* Ref.make<Array<string>>([])
      const interruptHeartbeatRef = yield* Ref.make<Array<string>>([])

      const drainResult = yield* Study.optimize({
        space: yield* pruningSlotSpace,
        sampler: sequentialSlotSampler,
        direction: "minimize",
        trials: 3,
        stopMode: "Drain",
        objective: stoppingSlotObjective(drainHeartbeatRef, "drain-stop")
      })
      const interruptResult = yield* Study.optimize({
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

      if (Option.isNone(drainOption) || Option.isNone(interruptOption)) {
        return
      }

      expect(drainOption.value.completionReason).toBe("interrupted")
      expect(interruptOption.value.completionReason).toBe("interrupted")
      expect(drainOption.value.trials).toHaveLength(1)
      expect(interruptOption.value.trials).toHaveLength(1)

      expect(yield* Ref.get(drainHeartbeatRef)).toEqual(["Continue"])
      expect(yield* Ref.get(interruptHeartbeatRef)).toEqual(["Stop"])
    }))

  it.effect("emits pruning and stop lifecycle events for semantic replay assertions", () =>
    Effect.gen(function*() {
      const events = yield* Stream.runCollect(
        Study.optimizeStream({
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

      const tags = Chunk.toReadonlyArray(events).map((event) => event._tag)

      expect(tags).toContain("TrialReported")
      expect(tags).toContain("TrialPruned")
      expect(tags).toContain("StopRequested")
      expect(tags[tags.length - 1]).toBe("Completed")
    }))
})
