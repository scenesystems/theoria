import {
  Array as Arr,
  Boolean as Bool,
  Chunk,
  Effect,
  Match,
  Number as Num,
  Option,
  Predicate,
  Schema,
  Stream,
  String as Str
} from "effect"

import * as Numeric from "@scenesystems/effect-math/Numeric"
import { toVector } from "../../src/Objective.js"
import * as Optimization from "../../src/Optimization.js"
import type * as OptimizationEvent from "../../src/OptimizationEvent.js"
import * as Pruning from "../../src/Pruning.js"
import { pendingAsZeroPolicy } from "../../src/Sampler.js"
import * as Sampler from "../../src/Sampler.js"
import * as SearchSpace from "../../src/SearchSpace.js"
import {
  decodePromptCategoricalConfig,
  makePromptCategoricalSpace,
  PromptCategoricalConfig
} from "../fixtures/scenarios/promptCategorical.js"
import { decodeSlotConfig, makeSlotSpace } from "../fixtures/scenarios/slot.js"

export const SnapshotConfig = Schema.Struct({
  x: SearchSpace.float(Num.negate(2), 2),
  depth: SearchSpace.int(1, 5),
  optimizer: SearchSpace.categorical(Schema.Literal("adam", "sgd").literals)
})

export type SnapshotConfig = Schema.Schema.Type<typeof SnapshotConfig>

export const snapshotSpace = SearchSpace.make(SnapshotConfig.fields)

export const multiObjectiveSnapshotSpace = makePromptCategoricalSpace()

export const incompatibleSnapshotSpace = SearchSpace.make({
  x: SearchSpace.float(Num.negate(2), 2),
  depth: SearchSpace.int(1, 5),
  optimizer: SearchSpace.categorical(Arr.of("rmsprop"))
})

export const decodeSnapshotConfig = Schema.decodeUnknown(SnapshotConfig)

export const encodeSnapshotConfigTrace = Schema.encodeSync(
  Schema.parseJson(Schema.Array(SnapshotConfig))
)

export const encodeSnapshotValueTrace = Schema.encodeSync(
  Schema.parseJson(Schema.Array(Schema.Number))
)

export const encodeMultiObjectiveConfigTrace = Schema.encodeSync(
  Schema.parseJson(Schema.Array(PromptCategoricalConfig))
)

export const encodeObjectiveVectorTrace = Schema.encodeSync(
  Schema.parseJson(Schema.Array(Schema.Array(Schema.Number)))
)

const instructionLatency = (instruction: PromptCategoricalConfig["instruction"]): number =>
  Match.value(instruction).pipe(
    Match.when("baseline", () => 0.3),
    Match.when("rewrite", () => 0.9),
    Match.when("counterexample", () => 1.5),
    Match.when("socratic", () => 2.1),
    Match.exhaustive
  )

const demosLatency = (demos: PromptCategoricalConfig["demos"]): number =>
  Match.value(demos).pipe(
    Match.when("none", () => 0.1),
    Match.when("few", () => 0.6),
    Match.when("curated", () => 1.3),
    Match.exhaustive
  )

const scoringLatency = (scoring: PromptCategoricalConfig["scoring"]): number =>
  Match.value(scoring).pipe(
    Match.when("recall", () => 0.2),
    Match.when("balanced", () => 0.5),
    Match.when("strict", () => 1.1),
    Match.exhaustive
  )

const instructionQualityLoss = (instruction: PromptCategoricalConfig["instruction"]): number =>
  Match.value(instruction).pipe(
    Match.when("baseline", () => 2),
    Match.when("rewrite", () => 1.2),
    Match.when("counterexample", () => 0.8),
    Match.when("socratic", () => 0.5),
    Match.exhaustive
  )

const demosQualityLoss = (demos: PromptCategoricalConfig["demos"]): number =>
  Match.value(demos).pipe(
    Match.when("none", () => 1.8),
    Match.when("few", () => 0.9),
    Match.when("curated", () => 0.2),
    Match.exhaustive
  )

const scoringQualityLoss = (scoring: PromptCategoricalConfig["scoring"]): number =>
  Match.value(scoring).pipe(
    Match.when("recall", () => 1.4),
    Match.when("balanced", () => 0.9),
    Match.when("strict", () => 0.4),
    Match.exhaustive
  )

const interactionQualityBonus = (config: PromptCategoricalConfig): number =>
  Match.value(
    Bool.and(
      Str.Equivalence(config.instruction, "socratic"),
      Bool.and(Str.Equivalence(config.demos, "curated"), Str.Equivalence(config.scoring, "strict"))
    )
  ).pipe(
    Match.when(true, () => Num.negate(0.2)),
    Match.orElse(() => 0)
  )

export const snapshotSingleObjective = (raw: unknown) =>
  decodeSnapshotConfig(raw).pipe(
    Effect.map((config) =>
      Num.sumAll(Arr.make(
        Numeric.abs(config.x),
        config.depth,
        Match.value(config.optimizer).pipe(
          Match.when("adam", () => 0),
          Match.when("sgd", () => 0.25),
          Match.exhaustive
        )
      ))
    )
  )

export const snapshotObjectiveVector = (raw: unknown) =>
  decodePromptCategoricalConfig(raw).pipe(
    Effect.map((config) =>
      Arr.make(
        Num.sumAll(Arr.make(
          instructionLatency(config.instruction),
          demosLatency(config.demos),
          scoringLatency(config.scoring)
        )),
        Num.sumAll(Arr.make(
          instructionQualityLoss(config.instruction),
          demosQualityLoss(config.demos),
          scoringQualityLoss(config.scoring),
          interactionQualityBonus(config)
        ))
      )
    )
  )

export const snapshotSingleObjectiveResult = (
  result: Optimization.Result
): Option.Option<Optimization.SingleObjectiveResult> =>
  Match.value(result).pipe(
    Match.tag("SingleObjective", (single) => Option.some(single)),
    Match.orElse(() => Option.none())
  )

export const snapshotMultiObjectiveResult = (
  result: Optimization.Result
): Option.Option<Optimization.MultiObjectiveResult> =>
  Match.value(result).pipe(
    Match.tag("MultiObjective", (multi) => Option.some(multi)),
    Match.orElse(() => Option.none())
  )

export const snapshotConfigTrace = (result: Optimization.SingleObjectiveResult) =>
  Effect.forEach(result.trials, (trial) => decodeSnapshotConfig(trial.config))

export const snapshotValueTrace = (result: Optimization.SingleObjectiveResult) =>
  Arr.flatMap(Arr.fromIterable(result.trials), (trial) =>
    Match.value(trial.state).pipe(
      Match.tag("Completed", ({ value }) => Option.liftPredicate(value, Predicate.isNumber).pipe(Option.toArray)),
      Match.orElse(() => Arr.empty<number>())
    ))

export const multiObjectiveConfigTrace = (result: Optimization.MultiObjectiveResult) =>
  Effect.forEach(result.trials, (trial) => decodePromptCategoricalConfig(trial.config))

export const multiObjectiveValueTrace = (result: Optimization.MultiObjectiveResult) =>
  Arr.flatMap(Arr.fromIterable(result.trials), (trial) =>
    Match.value(trial.state).pipe(
      Match.tag("Completed", ({ value }) => Arr.of(toVector(value))),
      Match.orElse(() => Arr.empty<ReadonlyArray<number>>())
    ))

export const paretoObjectiveValueTrace = (result: Optimization.MultiObjectiveResult) =>
  Arr.map(Arr.fromIterable(result.paretoFront), (trial) => toVector(trial.state.value))

export const pruneStopSpace = makeSlotSpace(64)

export const pruneStopSampler = new Sampler.Sampler({
  kind: Sampler.Random({ options: { seed: 0 } }),
  pendingImputationPolicy: pendingAsZeroPolicy,
  checkpoint: Effect.succeed({ _tag: "Random", seed: 0 }),
  restore: () => Effect.void,
  suggest: (_space, context) => Effect.succeed({ slot: context.nextTrialNumber })
})

export const pruneStopPolicy = new Pruning.Policy({
  name: "even-slot-pruner",
  decide: ({ latestReport }) =>
    Match.value(Num.Equivalence(Num.remainder(latestReport.value, 2), 0)).pipe(
      Match.when(true, () =>
        Pruning.prune({
          step: latestReport.step,
          reason: "even-slot",
          policy: "even-slot-pruner"
        })),
      Match.orElse(() => Pruning.continueEvaluation())
    )
})

export const pruneStopObjective = (raw: unknown, runtime: Pruning.Runtime) =>
  Effect.gen(function*() {
    const config = yield* decodeSlotConfig(raw)

    yield* runtime.report(0, config.slot)
    yield* Match.value(Num.Equivalence(config.slot, 4)).pipe(
      Match.when(true, () => runtime.requestStop("snapshot-stop")),
      Match.orElse(() => Effect.void)
    )

    return config.slot
  })

const projectSnapshotEvent = (event: OptimizationEvent.OptimizationEvent): string =>
  Match.value(event).pipe(
    Match.tag("TrialStarted", ({ trialNumber }) => `start:${trialNumber}`),
    Match.tag("TrialReported", ({ trialNumber, step, value, decision }) =>
      Match.value(decision).pipe(
        Match.tag("Continue", () => `report:${trialNumber}:${step}:${value}:continue`),
        Match.tag("Prune", ({ reason, policy }) => `report:${trialNumber}:${step}:${value}:prune:${reason}:${policy}`),
        Match.exhaustive
      )),
    Match.tag("TrialCompleted", ({ trialNumber, value }) =>
      Match.value(value).pipe(
        Match.when(Match.number, (resolved) => `complete:${trialNumber}:${resolved}`),
        Match.orElse((resolved) => `complete:${trialNumber}:${Arr.join(Arr.map(resolved, (value) => `${value}`), "|")}`)
      )),
    Match.tag("TrialCosted", ({ trialNumber, cost, cumulativeCost }) =>
      `costed:${trialNumber}:${cost}:${cumulativeCost}`),
    Match.tag("TrialPruned", ({ trialNumber, step, reason, policy }) =>
      `pruned:${trialNumber}:${step}:${reason}:${policy}`),
    Match.tag("TrialRetried", ({ trialNumber, attempt }) =>
      `retried:${trialNumber}:${attempt}`),
    Match.tag("TrialCancelled", ({ trialNumber, reason }) =>
      `cancelled:${trialNumber}:${reason}`),
    Match.tag("TrialFailed", ({ trialNumber }) =>
      `failed:${trialNumber}`),
    Match.tag("BestUpdated", ({ trialNumber, value }) => `best:${trialNumber}:${value}`),
    Match.tag("BracketStarted", ({ bracketIndex, configs, minResource }) =>
      `bracket-started:${bracketIndex}:${configs}:${minResource}`),
    Match.tag("RoundStarted", ({ bracketIndex, roundIndex, nConfigs, resource }) =>
      `round-started:${bracketIndex}:${roundIndex}:${nConfigs}:${resource}`),
    Match.tag("RoundCompleted", ({ bracketIndex, roundIndex, nConfigs, resource, completed }) =>
      `round-completed:${bracketIndex}:${roundIndex}:${nConfigs}:${resource}:${completed}`),
    Match.tag("BracketCompleted", ({ bracketIndex, rounds }) =>
      `bracket-completed:${bracketIndex}:${rounds}`),
    Match.tag("StopRequested", ({ mode, requestedByTrialNumber, reason }) =>
      `stop:${mode}:${requestedByTrialNumber}:${reason}`),
    Match.tag("Completed", ({ completionReason }) =>
      `completed:${completionReason}`),
    Match.exhaustive
  )

const snapshotEventTrialNumber = (event: OptimizationEvent.OptimizationEvent): Option.Option<number> =>
  Match.value(event).pipe(
    Match.tag("TrialStarted", ({ trialNumber }) => Option.some(trialNumber)),
    Match.tag("TrialReported", ({ trialNumber }) => Option.some(trialNumber)),
    Match.tag("TrialCompleted", ({ trialNumber }) => Option.some(trialNumber)),
    Match.tag("TrialCosted", ({ trialNumber }) => Option.some(trialNumber)),
    Match.tag("TrialPruned", ({ trialNumber }) => Option.some(trialNumber)),
    Match.tag("TrialRetried", ({ trialNumber }) => Option.some(trialNumber)),
    Match.tag("TrialCancelled", ({ trialNumber }) => Option.some(trialNumber)),
    Match.tag("TrialFailed", ({ trialNumber }) => Option.some(trialNumber)),
    Match.tag("BestUpdated", ({ trialNumber }) => Option.some(trialNumber)),
    Match.tag("BracketStarted", () => Option.none()),
    Match.tag("RoundStarted", () => Option.none()),
    Match.tag("RoundCompleted", () => Option.none()),
    Match.tag("BracketCompleted", () => Option.none()),
    Match.tag("StopRequested", ({ requestedByTrialNumber }) => Option.some(requestedByTrialNumber)),
    Match.tag("Completed", () => Option.none()),
    Match.exhaustive
  )

export const resumeSnapshotWithEvents = (options: Optimization.ResumeOptions) =>
  Effect.gen(function*() {
    const events = yield* Optimization.resumeStream(options).pipe(Stream.runCollect)
    return {
      events: Chunk.toReadonlyArray(events)
    }
  })

export const baselineSnapshotTailEvents = (
  events: Chunk.Chunk<OptimizationEvent.OptimizationEvent>,
  firstLegTrials: number
) =>
  Arr.filter(Chunk.toReadonlyArray(events), (event) =>
    Option.match(snapshotEventTrialNumber(event), {
      onNone: () => Str.Equivalence(event._tag, "Completed"),
      onSome: (trialNumber) => Num.greaterThanOrEqualTo(trialNumber, firstLegTrials)
    }))

export const snapshotEventTrace = (events: Iterable<OptimizationEvent.OptimizationEvent>) =>
  Arr.map(Arr.fromIterable(events), projectSnapshotEvent)

export const collectSnapshotEvents = (options: Optimization.Options) => Stream.runCollect(Optimization.stream(options))
