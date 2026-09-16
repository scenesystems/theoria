/**
 * BootstrapRS search orchestration — evaluates candidate parameter sets and
 * selects the best via effect-search.
 *
 * @since 0.1.0
 * @internal
 */
import { Sampler as SearchSampler, SearchSpace, Study } from "@scenesystems/effect-search"
import {
  Array as Arr,
  Data,
  Effect,
  Inspectable,
  Match,
  Number as Num,
  Option,
  Schema,
  String as Str,
  Tuple
} from "effect"
import { AllTrialsFailed } from "../../../DspError.js"
import type { Metric } from "../../../Metric.js"
import type { Module as DspModule } from "../../../Module.js"
import {
  type BootstrapRSExamples,
  CandidateState,
  type CandidateStates,
  evaluateCandidate,
  EvaluateCandidateOptions
} from "./candidates.js"

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
export const ScoredCandidate = Schema.Tuple(CandidateState, Schema.Number)

/** @internal */
export type ScoredCandidate = typeof ScoredCandidate.Type

/** @internal */
export const ScoredCandidates = Schema.Array(ScoredCandidate)

/** @internal */
export type ScoredCandidates = typeof ScoredCandidates.Type

/** @internal */
export class ScoreCandidatesOptions<
  I extends Schema.Struct.Fields,
  O extends Schema.Struct.Fields,
  ME,
  MR,
  E,
  R
> extends Data.Class<{
  readonly module: DspModule<I, O, E, R>
  readonly candidates: CandidateStates
  readonly valset: BootstrapRSExamples
  readonly metric: Metric<ME, MR, Schema.Schema.Type<Schema.Struct<O>>>
}> {}

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
  MR,
  E,
  R
>(options: ScoreCandidatesOptions<I, O, ME, MR, E, R>) =>
  Effect.forEach(
    options.candidates,
    (candidate) =>
      evaluateCandidate(
        new EvaluateCandidateOptions({
          module: options.module,
          candidate,
          valset: options.valset,
          metric: options.metric
        })
      ).pipe(
        Effect.map((score) => Option.some(Data.tuple(candidate, score))),
        // A candidate with zero successful evaluations has no score to rank; every
        // other failure is a fault in the module, metric or model and propagates.
        Effect.catchTag("AllTrialsFailed", () => Effect.succeedNone)
      ),
    { concurrency: 1 }
  ).pipe(
    Effect.map((entries) => Arr.filterMap(entries, (entry) => entry))
  )

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
export const selectBestCandidate = (scoredCandidates: ScoredCandidates) =>
  Effect.gen(function*() {
    const searchSpace = yield* SearchSpace.make({
      candidateIndex: SearchSpace.int(0, Num.decrement(Arr.length(scoredCandidates)))
    })

    const result = yield* Study.maximize({
      space: searchSpace,
      sampler: SearchSampler.grid(),
      objective: ({ candidateIndex }) =>
        Option.match(Arr.get(scoredCandidates, candidateIndex), {
          onNone: () =>
            Effect.fail(
              new AllTrialsFailed({
                message: Str.concat(
                  "BootstrapRS requested missing candidate index ",
                  Inspectable.toStringUnknown(candidateIndex)
                ),
                trialCount: Arr.length(scoredCandidates)
              })
            ),
          onSome: (entry) => Effect.succeed(Tuple.getSecond(entry))
        }),
      trials: Arr.length(scoredCandidates),
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
          new AllTrialsFailed({
            message: Str.concat(
              "BootstrapRS requested missing candidate index ",
              Inspectable.toStringUnknown(selectedIndex)
            ),
            trialCount: Arr.length(scoredCandidates)
          })
        ),
      onSome: (candidate) => Effect.succeed(Tuple.getFirst(candidate))
    })
  })
