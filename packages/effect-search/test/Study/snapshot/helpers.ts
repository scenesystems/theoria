import { Chunk, Effect, Match, Option, Ref, Schema, Stream } from "effect"
import { abs } from "effect-math/Numeric"

import { normalizeObjectiveVector, objectiveSpecFromOptions } from "../../../src/contracts/index.js"
import {
  decodePromptCategoricalConfig,
  decodePromptCategoricalConfigEffect,
  makePromptCategoricalSpace,
  PromptCategoricalConfigSchema
} from "../../../src/experimental/scenarios/promptCategorical.js"
import { decodeSlotConfig, makeSlotSpace } from "../../../src/experimental/scenarios/slot.js"
import { pendingAsZeroImputationPolicy } from "../../../src/Sampler/index.js"
import * as Sampler from "../../../src/Sampler/index.js"
import * as SearchSpace from "../../../src/SearchSpace/index.js"
import { EventPublisher } from "../../../src/Study/events.js"
import * as Study from "../../../src/Study/index.js"
import type * as StudyEvent from "../../../src/StudyEvent/index.js"

export const makeSpace = () =>
  SearchSpace.unsafeMake({
    x: SearchSpace.float(-2, 2),
    depth: SearchSpace.int(1, 5),
    optimizer: SearchSpace.categorical(["adam", "sgd"])
  })

export const makeMultiSpace = () => makePromptCategoricalSpace()

export const makeIncompatibleSpace = () =>
  SearchSpace.unsafeMake({
    x: SearchSpace.float(-2, 2),
    depth: SearchSpace.int(1, 5),
    optimizer: SearchSpace.categorical(["rmsprop"])
  })

export const decodeConfig = Schema.decodeUnknownSync(makeSpace().schema)

export const encodeConfigTrace = Schema.encodeSync(
  Schema.parseJson(Schema.Array(makeSpace().schema))
)

export const encodeNumericTrace = Schema.encodeSync(
  Schema.parseJson(Schema.Array(Schema.Number))
)

export const encodeMultiConfigTrace = Schema.encodeSync(
  Schema.parseJson(Schema.Array(PromptCategoricalConfigSchema))
)

export const encodeObjectiveVectorTrace = Schema.encodeSync(
  Schema.parseJson(Schema.Array(Schema.Array(Schema.Number)))
)

const instructionLatency = (instruction: string): number =>
  instruction === "baseline" ? 0.3 : instruction === "rewrite" ? 0.9 : instruction === "counterexample" ? 1.5 : 2.1

const demosLatency = (demos: string): number => demos === "none" ? 0.1 : demos === "few" ? 0.6 : 1.3

const scoringLatency = (scoring: string): number => scoring === "recall" ? 0.2 : scoring === "balanced" ? 0.5 : 1.1

const instructionQualityLoss = (instruction: string): number =>
  instruction === "baseline" ? 2 : instruction === "rewrite" ? 1.2 : instruction === "counterexample" ? 0.8 : 0.5

const demosQualityLoss = (demos: string): number => demos === "none" ? 1.8 : demos === "few" ? 0.9 : 0.2

const scoringQualityLoss = (scoring: string): number => scoring === "recall" ? 1.4 : scoring === "balanced" ? 0.9 : 0.4

const interactionQualityBonus = (instruction: string, demos: string, scoring: string): number =>
  instruction === "socratic" && demos === "curated" && scoring === "strict" ? -0.2 : 0

export const singleObjective = (raw: unknown) => {
  const config = decodeConfig(raw)

  return Effect.succeed(
    abs(config.x) + config.depth + (config.optimizer === "adam" ? 0 : 0.25)
  )
}

export const objectiveVector = (raw: unknown) =>
  decodePromptCategoricalConfigEffect(raw).pipe(
    Effect.map((config) => [
      instructionLatency(config.instruction) + demosLatency(config.demos) + scoringLatency(config.scoring),
      instructionQualityLoss(config.instruction) +
      demosQualityLoss(config.demos) +
      scoringQualityLoss(config.scoring) +
      interactionQualityBonus(config.instruction, config.demos, config.scoring)
    ])
  )

export const asSingleObjective = (result: Study.StudyResult) =>
  result._tag === "SingleObjective" ? Option.some(result) : Option.none()

export const asMultiObjective = (result: Study.StudyResult) =>
  result._tag === "MultiObjective" ? Option.some(result) : Option.none()

export const singleConfigTrace = (result: Study.SingleObjectiveResult) =>
  result.trials.map((trial) => decodeConfig(trial.config))

export const singleValueTrace = (result: Study.SingleObjectiveResult): Array<number> =>
  result.trials.flatMap((trial) =>
    Match.value(trial.state).pipe(
      Match.tag("Completed", ({ value }) =>
        Match.value(value).pipe(
          Match.when(Match.number, (resolved) => [resolved]),
          Match.orElse(() => [])
        )),
      Match.orElse(() => [])
    )
  )

export const multiConfigTrace = (result: Study.MultiObjectiveResult) =>
  result.trials.map((trial) => decodePromptCategoricalConfig(trial.config))

export const multiValueTrace = (result: Study.MultiObjectiveResult) =>
  result.trials.flatMap((trial) =>
    Match.value(trial.state).pipe(
      Match.tag("Completed", ({ value }) => [normalizeObjectiveVector(value)]),
      Match.orElse(() => [])
    )
  )

export const multiParetoValueTrace = (result: Study.MultiObjectiveResult) =>
  result.paretoFront.map((trial) => normalizeObjectiveVector(trial.state.value))

export const pruneStopSpace = () => makeSlotSpace(64)

export const deterministicSampler = new Sampler.Sampler({
  kind: Sampler.Random({ options: { seed: 0 } }),
  pendingImputationPolicy: pendingAsZeroImputationPolicy,
  checkpoint: Effect.succeed({ _tag: "Random", seed: 0 }),
  restore: () => Effect.void,
  suggest: (_space, context) => Effect.succeed({ slot: context.nextTrialNumber })
})

export const pruneStopPolicy = new Study.PruningPolicy({
  name: "even-slot-pruner",
  decide: ({ latestReport }) =>
    latestReport.value % 2 === 0
      ? Study.PruneTrialDecision({
        step: latestReport.step,
        reason: "even-slot",
        policy: "even-slot-pruner"
      })
      : Study.ContinuePruneDecision()
})

export const pruneStopObjective = (raw: unknown, runtime: Study.ObjectiveTrialRuntime) =>
  Effect.gen(function*() {
    const config = decodeSlotConfig(raw)

    yield* runtime.report(0, config.slot)
    yield* Match.value(config.slot === 4).pipe(
      Match.when(true, () => runtime.requestStop("snapshot-stop")),
      Match.orElse(() => Effect.void)
    )

    return config.slot
  })

export const projectEvent = (event: StudyEvent.StudyEvent): string =>
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
        Match.orElse((resolved) => `complete:${trialNumber}:${resolved.join("|")}`)
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
    Match.tag("StudyStopRequested", ({ mode, requestedByTrialNumber, reason }) =>
      `stop:${mode}:${requestedByTrialNumber}:${reason}`),
    Match.tag("StudyCompleted", ({ completionReason }) =>
      `completed:${completionReason}`),
    Match.exhaustive
  )

export const eventTrialNumber = (event: StudyEvent.StudyEvent): Option.Option<number> =>
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
    Match.tag("StudyStopRequested", ({ requestedByTrialNumber }) => Option.some(requestedByTrialNumber)),
    Match.tag("StudyCompleted", () => Option.none()),
    Match.exhaustive
  )

export const resumeWithEvents = (options: Study.ResumeOptions) =>
  Effect.gen(function*() {
    const snapshotCodec = yield* Study.SnapshotCodec
    const studyKernel = yield* Study.StudyKernel
    const resumePlan = yield* Study.resumePlanFromOptions(options)
    const optimizePlan = Study.optimizePlanFromResume(resumePlan)
    const objectiveSpec = objectiveSpecFromOptions({
      ...Option.fromNullable(options.direction).pipe(
        Option.match({
          onNone: () => ({}),
          onSome: (direction) => ({ direction })
        })
      ),
      ...Option.fromNullable(options.directions).pipe(
        Option.match({
          onNone: () => ({}),
          onSome: (directions) => ({ directions })
        })
      )
    })
    const stopMode = Study.stopModeOrDefault(Option.fromNullable(options.stopMode))
    const seed = yield* snapshotCodec.restore(
      options.space,
      options.sampler,
      objectiveSpec,
      stopMode,
      options.snapshot
    )
    const eventsRef = yield* Ref.make<ReadonlyArray<StudyEvent.StudyEvent>>([])
    const outcome = yield* studyKernel.execute(
      new Study.ExecuteRequest({
        options: optimizePlan,
        seed: Option.some(seed),
        eventPublisher: Option.some(
          new EventPublisher({
            publish: (event) => Ref.update(eventsRef, (events) => [...events, event])
          })
        )
      })
    )

    return {
      events: yield* Ref.get(eventsRef),
      outcome
    }
  }).pipe(Effect.provide(Study.StudyServicesLive))

export const baselineTailEvents = (
  events: Chunk.Chunk<StudyEvent.StudyEvent>,
  firstLegTrials: number
): Array<StudyEvent.StudyEvent> =>
  Chunk.toReadonlyArray(events).filter((event) =>
    Option.match(eventTrialNumber(event), {
      onNone: () => event._tag === "StudyCompleted",
      onSome: (trialNumber) => trialNumber >= firstLegTrials
    })
  )

export const eventTrace = (events: ReadonlyArray<StudyEvent.StudyEvent>): Array<string> => events.map(projectEvent)

export const collectEvents = (options: Study.OptimizeOptions) => Stream.runCollect(Study.optimizeStream(options))
