/**
 * BootstrapRS search orchestration — evaluates candidate parameter sets and
 * selects the best via effect-search.
 *
 * @since 0.1.0
 * @internal
 */
import { Sampler as SearchSampler, SearchSpace, Study } from "@scenesystems/effect-search"
import { Array as Arr, Data, Effect, Match, Option } from "effect"
import type { Schema } from "effect"
import { AllTrialsFailed } from "../../../Errors/optimizer.js"
import type { Example } from "../../../Example/index.js"
import type { Metric } from "../../../Metric/model.js"
import type { Module as DspModule } from "../../../Module/model.js"
import { type CandidateState, evaluateCandidate } from "./candidates.js"

/**
 * A candidate paired with its aggregate evaluation score.
 *
 * The first element is the parameter snapshot and the second is the
 * metric score produced by running the candidate against the validation set.
 *
 * @since 0.1.0
 * @category models
 * @internal
 */
export type ScoredCandidate = readonly [CandidateState, number]

/**
 * Evaluates every candidate sequentially against the validation set and
 * pairs each with its metric score.
 *
 * A candidate whose every validation trial fails (`AllTrialsFailed`) is excluded
 * from the result; any other evaluation failure propagates.
 *
 * @since 0.1.0
 * @category constructors
 * @internal
 */
export const scoreCandidates = <
  I extends Schema.Struct.Fields,
  O extends Schema.Struct.Fields,
  ME,
  MR
>(options: {
  readonly module: DspModule<I, O>
  readonly candidates: ReadonlyArray<CandidateState>
  readonly valset: ReadonlyArray<Example>
  readonly metric: Metric<ME, MR>
}) =>
  Effect.forEach(
    options.candidates,
    (candidate) =>
      evaluateCandidate({
        module: options.module,
        candidate,
        valset: options.valset,
        metric: options.metric
      }).pipe(
        Effect.map((score) => Option.some(Data.tuple(candidate, score))),
        // A candidate with zero successful evaluations has no score to rank; every
        // other failure is a fault in the module, metric or model and propagates.
        Effect.catchTag("AllTrialsFailed", () => Effect.succeedNone)
      ),
    { concurrency: 1 }
  ).pipe(
    Effect.map((entries) => Arr.filterMap(entries, (entry) => entry))
  )

const missingCandidateError = (options: {
  readonly message: string
  readonly trialCount: number
}) =>
  new AllTrialsFailed({
    message: options.message,
    trialCount: options.trialCount
  })

/**
 * Selects the highest-scoring candidate via exhaustive grid search.
 *
 * Constructs a single-dimensional search space over candidate indices and
 * maximizes the pre-computed scores. Returns the `CandidateState` of the
 * winning entry, or fails with `AllTrialsFailed` when no candidate can be
 * selected.
 *
 * @since 0.1.0
 * @category constructors
 * @internal
 */
export const selectBestCandidate = (scoredCandidates: ReadonlyArray<ScoredCandidate>) =>
  Effect.gen(function*() {
    const searchSpace = yield* SearchSpace.make({
      candidateIndex: SearchSpace.int(0, scoredCandidates.length - 1)
    })

    const result = yield* Study.maximize({
      space: searchSpace,
      sampler: SearchSampler.grid(),
      objective: ({ candidateIndex }) =>
        Option.match(Arr.get(scoredCandidates, candidateIndex), {
          onNone: () =>
            Effect.fail(
              missingCandidateError({
                message: `BootstrapRS requested missing candidate index ${candidateIndex}`,
                trialCount: scoredCandidates.length
              })
            ),
          onSome: (entry) => Effect.succeed(entry[1])
        }),
      trials: scoredCandidates.length,
      concurrency: 1
    })

    const selectedIndex = Match.value(result).pipe(
      Match.tag("SingleObjective", ({ bestTrial }) => bestTrial.config.candidateIndex),
      Match.tag("MultiObjective", () => 0),
      Match.exhaustive
    )

    return yield* Option.match(Arr.get(scoredCandidates, selectedIndex), {
      onNone: () =>
        Effect.fail(
          missingCandidateError({
            message: `BootstrapRS requested missing candidate index ${selectedIndex}`,
            trialCount: scoredCandidates.length
          })
        ),
      onSome: (candidate) => Effect.succeed(candidate[0])
    })
  })
