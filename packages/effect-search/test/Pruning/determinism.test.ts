import { describe, expect, it } from "@effect/vitest"
import {
  Array as Arr,
  Boolean as Bool,
  Effect,
  Equal,
  Match,
  Number as Num,
  Option,
  Order,
  Schema,
  Tuple
} from "effect"

import * as Optimization from "../../src/Optimization.js"
import * as Pruning from "../../src/Pruning.js"
import * as Sampler from "../../src/Sampler.js"
import type * as Trial from "../../src/Trial.js"
import { decodeSlotConfig, makeSlotSpace, SlotConfig } from "../fixtures/scenarios/slot.js"

const space = makeSlotSpace(40)

const runOptions = {
  seed: 509,
  nStartupTrials: 6,
  nEiCandidates: 32,
  trials: 24,
  concurrency: 4
}

const asSingleObjective = (result: Optimization.Result): Option.Option<Optimization.SingleObjectiveResult> =>
  Match.value(result).pipe(
    Match.tag("SingleObjective", (single) => Option.some(single)),
    Match.orElse(() => Option.none())
  )

const requireSome = <A>(option: Option.Option<A>): Effect.Effect<A> =>
  Option.match(option, {
    onNone: () => Effect.dieMessage("expected Some"),
    onSome: Effect.succeed
  })

const encodeConfigTrace = Schema.encodeSync(Schema.parseJson(Schema.Array(SlotConfig)))

const encodeTrialConfigTrace = (
  trials: Iterable<Trial.Trial<unknown>>
) => Effect.forEach(trials, (trial) => decodeSlotConfig(trial.config)).pipe(Effect.map(encodeConfigTrace))

const objective = (raw: unknown, runtime: Pruning.Runtime) =>
  Effect.gen(function*() {
    const config = yield* decodeSlotConfig(raw)

    yield* runtime.report(0, config.slot)

    return config.slot
  })

const pruningPolicy = new Pruning.Policy({
  name: "upper-slot-pruner",
  decide: ({ latestReport }) =>
    Match.value(Num.greaterThanOrEqualTo(latestReport.value, 24)).pipe(
      Match.when(true, () =>
        Pruning.prune({
          step: latestReport.step,
          reason: "slot-above-threshold",
          policy: "upper-slot-pruner"
        })),
      Match.orElse(() => Pruning.continueEvaluation())
    )
})

const runWithPruning = (trials: number) =>
  Effect.gen(function*() {
    return yield* Optimization.run({
      space: yield* space,
      sampler: Sampler.tpe({
        seed: runOptions.seed,
        nStartupTrials: runOptions.nStartupTrials,
        nEiCandidates: runOptions.nEiCandidates
      }),
      direction: "minimize",
      trials,
      concurrency: runOptions.concurrency,
      pruningPolicy,
      objective
    })
  })

const traceState = (result: Optimization.SingleObjectiveResult) =>
  Arr.map(Arr.fromIterable(result.trials), (trial) =>
    Match.value(trial.state).pipe(
      Match.tag("Completed", (state) => ({ trialNumber: trial.trialNumber, state: state._tag, value: state.value })),
      Match.tag("Pruned", (state) => ({
        trialNumber: trial.trialNumber,
        state: state._tag,
        step: state.step,
        reason: state.reason,
        policy: state.policy
      })),
      Match.orElse((state) => ({ trialNumber: trial.trialNumber, state: state._tag }))
    ))

const comparableFirstLegSlice = (
  trials: Iterable<Trial.Trial<unknown>>,
  firstLegTrials: number
) =>
  Arr.map(
    Arr.sort(
      Arr.filter(Arr.fromIterable(trials), (trial) => Num.lessThan(trial.trialNumber, firstLegTrials)),
      Order.mapInput(Num.Order, (trial: Trial.Trial<unknown>) => trial.trialNumber)
    ),
    (trial) => ({
      trialNumber: trial.trialNumber,
      state: trial.state._tag,
      config: trial.config
    })
  )

describe("constant-liar + pruning determinism", () => {
  it.effect(
    "keeps constant-liar pruning behavior deterministic under bounded concurrency",
    () =>
      Effect.gen(function*() {
        const leftResult = yield* runWithPruning(runOptions.trials)
        const rightResult = yield* runWithPruning(runOptions.trials)

        const leftOption = asSingleObjective(leftResult)
        const rightOption = asSingleObjective(rightResult)
        expect(Option.isSome(leftOption)).toBe(true)
        expect(Option.isSome(rightOption)).toBe(true)

        const [left, right] = yield* Effect.all(Tuple.make(
          requireSome(leftOption),
          requireSome(rightOption)
        ))
        const leftPrunedCount = Arr.length(
          Arr.filter(Arr.fromIterable(left.trials), (trial) => Equal.equals(trial.state._tag, "Pruned"))
        )
        const rightPrunedCount = Arr.length(
          Arr.filter(Arr.fromIterable(right.trials), (trial) => Equal.equals(trial.state._tag, "Pruned"))
        )

        expect(yield* encodeTrialConfigTrace(left.trials)).toBe(yield* encodeTrialConfigTrace(right.trials))
        expect(traceState(left)).toEqual(traceState(right))
        expect(leftPrunedCount).toBeGreaterThan(0)
        expect(rightPrunedCount).toBe(leftPrunedCount)
        expect(left.bestTrial.trialNumber).toBe(right.bestTrial.trialNumber)
        expect(left.bestTrial.state.value).toBe(right.bestTrial.state.value)
      }),
    15_000
  )

  it.effect(
    "preserves prune/report/liar semantics across uninterrupted and resumed runs",
    () =>
      Effect.gen(function*() {
        const totalTrials = runOptions.trials
        const firstLegTrials = 11
        const secondLegTrials = Num.subtract(totalTrials, firstLegTrials)

        const baselineResult = yield* runWithPruning(totalTrials)
        const firstLegResult = yield* runWithPruning(firstLegTrials)

        const baselineOption = asSingleObjective(baselineResult)
        const firstLegOption = asSingleObjective(firstLegResult)
        expect(Option.isSome(baselineOption)).toBe(true)
        expect(Option.isSome(firstLegOption)).toBe(true)

        const [baseline, firstLeg] = yield* Effect.all(Tuple.make(
          requireSome(baselineOption),
          requireSome(firstLegOption)
        ))

        const snapshot = yield* Optimization.snapshot(firstLeg)
        const resumedResultA = yield* Optimization.resume({
          space: yield* space,
          sampler: Sampler.tpe({
            seed: runOptions.seed,
            nStartupTrials: runOptions.nStartupTrials,
            nEiCandidates: runOptions.nEiCandidates
          }),
          snapshot,
          direction: "minimize",
          trials: secondLegTrials,
          concurrency: runOptions.concurrency,
          pruningPolicy,
          objective
        })
        const resumedResultB = yield* Optimization.resume({
          space: yield* space,
          sampler: Sampler.tpe({
            seed: runOptions.seed,
            nStartupTrials: runOptions.nStartupTrials,
            nEiCandidates: runOptions.nEiCandidates
          }),
          snapshot,
          direction: "minimize",
          trials: secondLegTrials,
          concurrency: runOptions.concurrency,
          pruningPolicy,
          objective
        })

        const resumedOptionA = asSingleObjective(resumedResultA)
        const resumedOptionB = asSingleObjective(resumedResultB)
        expect(Option.isSome(resumedOptionA)).toBe(true)
        expect(Option.isSome(resumedOptionB)).toBe(true)

        const [resumedA, resumedB] = yield* Effect.all(Tuple.make(
          requireSome(resumedOptionA),
          requireSome(resumedOptionB)
        ))
        const firstLegComparable = comparableFirstLegSlice(firstLeg.trials, firstLegTrials)

        expect(firstLegComparable).toHaveLength(firstLegTrials)
        expect(yield* encodeTrialConfigTrace(resumedA.trials)).toBe(yield* encodeTrialConfigTrace(resumedB.trials))
        expect(traceState(resumedA)).toEqual(traceState(resumedB))
        expect(resumedA.bestTrial.trialNumber).toBe(resumedB.bestTrial.trialNumber)
        expect(resumedA.bestTrial.state.value).toBe(resumedB.bestTrial.state.value)

        expect(resumedA.trials).toHaveLength(totalTrials)
        expect(baseline.trials).toHaveLength(totalTrials)
        expect(comparableFirstLegSlice(resumedA.trials, firstLegTrials)).toEqual(firstLegComparable)
        expect(resumedA.completionReason).toBe("budgetExhausted")
        expect(baseline.completionReason).toBe("budgetExhausted")
        expect(
          Arr.length(Arr.filter(Arr.fromIterable(resumedA.trials), (trial) => Equal.equals(trial.state._tag, "Pruned")))
        ).toBeGreaterThan(0)
        expect(
          Arr.length(Arr.filter(Arr.fromIterable(baseline.trials), (trial) => Equal.equals(trial.state._tag, "Pruned")))
        ).toBeGreaterThan(0)
        expect(
          Arr.every(Arr.fromIterable(resumedA.trials), (trial) => Bool.not(Equal.equals(trial.state._tag, "Running")))
        ).toBe(true)
      }),
    20_000
  )
})
