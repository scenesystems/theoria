/**
 * TPE mixed-space suggestion — joint candidate scoring across heterogeneous dimension types.
 *
 * @since 0.1.0
 */
import { Array as Arr, Data, Effect, Match, Number as Num, Option, Predicate, Record, Tuple } from "effect"

import type { InvalidSamplerConfig } from "../../Errors/index.js"
import type * as Rng from "../../internal/rng.js"
import { argmax } from "../../internal/tpe/expectedImprovement.js"
import { defaultNoiseBandwidthOptions, type NoiseBandwidthOptions } from "../../internal/tpe/noiseEstimator.js"
import type { TrialSplit } from "../../internal/tpe/splitTrials.js"
import type * as SearchSpace from "../../SearchSpace/index.js"
import { type AcquisitionOption, defaultAcquisitionName, scoreJointAcquisition } from "./acquisition/index.js"
import { chooseBestCandidate } from "./candidates.js"
import { estimateCostForConfig } from "./costModel.js"
import { categoricalCandidateTrace } from "./dimensions/categorical.js"
import { floatCandidateTrace } from "./dimensions/float.js"
import { intCandidateTrace } from "./dimensions/int.js"
import type { DimensionScoreTrace } from "./dimensions/trace.js"
import { invalidConfig } from "./options.js"

/**
 * A dimension score trace tagged with its parameter name for use in joint
 * mixed-space scoring.
 *
 * Wraps a per-dimension {@link DimensionScoreTrace} with the parameter name
 * so the joint scoring phase can reconstruct full candidate configs from
 * individual dimension traces.
 *
 * @see {@link traceForParameter} for constructing named traces
 * @see {@link selectBestMixedCandidate} for the joint selection that consumes them
 * @since 0.1.0
 * @category models
 */
export class NamedDimensionScoreTrace extends Data.Class<{
  readonly name: string
  readonly trace: DimensionScoreTrace<unknown>
}> {}

/**
 * Result of mixed-space joint candidate selection, containing all candidate
 * configs, their joint acquisition scores, and the best-scoring config.
 *
 * Returned by {@link selectBestMixedCandidate} after scoring all candidates
 * jointly across dimension traces.
 *
 * @see {@link selectBestMixedCandidate} for the selection algorithm
 * @see {@link NamedDimensionScoreTrace} for the per-dimension input traces
 * @since 0.1.0
 * @category models
 */
export class MixedCandidateSelection extends Data.Class<{
  readonly candidateConfigs: Array<unknown>
  readonly jointScores: Array<number>
  readonly bestIndex: number
  readonly bestConfig: unknown
}> {}

const candidateCount = (traces: ReadonlyArray<NamedDimensionScoreTrace>): Option.Option<number> =>
  Arr.head(traces).pipe(Option.map((entry) => entry.trace.candidates.length))

const candidateAt = (trace: DimensionScoreTrace<unknown>, index: number): Option.Option<unknown> =>
  Arr.get(trace.candidates, index)

const logLAt = (trace: DimensionScoreTrace<unknown>, index: number): Option.Option<number> => Arr.get(trace.logL, index)

const logGAt = (trace: DimensionScoreTrace<unknown>, index: number): Option.Option<number> => Arr.get(trace.logG, index)

const namedTrace = <A>(name: string, trace: DimensionScoreTrace<A>): NamedDimensionScoreTrace =>
  new NamedDimensionScoreTrace({
    name,
    trace
  })

const normalizedCandidateValue = (name: string, candidate: unknown): unknown =>
  Match.value(candidate).pipe(
    Match.when(
      Predicate.isRecord,
      (record) => Option.fromNullable(record[name]).pipe(Option.getOrElse(() => candidate))
    ),
    Match.orElse(() => candidate)
  )

const configAtIndex = (
  traces: ReadonlyArray<NamedDimensionScoreTrace>,
  index: number
): Effect.Effect<unknown, InvalidSamplerConfig> =>
  Effect.forEach(traces, (entry) =>
    candidateAt(entry.trace, index).pipe(
      Option.match({
        onNone: () =>
          Effect.fail(
            invalidConfig(`tpe mixed candidate trace missing candidate at index ${index} for parameter "${entry.name}"`)
          ),
        onSome: (value) => Effect.succeed(Tuple.make(entry.name, normalizedCandidateValue(entry.name, value)))
      })
    )).pipe(Effect.map((entries) => Record.fromEntries(entries)))

const jointScoreAtIndex = (
  traces: ReadonlyArray<NamedDimensionScoreTrace>,
  split: TrialSplit,
  candidateConfig: unknown,
  index: number,
  acquisition: AcquisitionOption
): Effect.Effect<number, InvalidSamplerConfig> =>
  Effect.all([
    Effect.forEach(traces, (entry) =>
      logLAt(entry.trace, index).pipe(
        Option.match({
          onNone: () =>
            Effect.fail(
              invalidConfig(`tpe mixed candidate trace missing logL at index ${index} for parameter "${entry.name}"`)
            ),
          onSome: Effect.succeed
        })
      )),
    Effect.forEach(traces, (entry) =>
      logGAt(entry.trace, index).pipe(
        Option.match({
          onNone: () =>
            Effect.fail(
              invalidConfig(`tpe mixed candidate trace missing logG at index ${index} for parameter "${entry.name}"`)
            ),
          onSome: Effect.succeed
        })
      ))
  ]).pipe(
    Effect.map(([logLContributions, logGContributions]) =>
      scoreJointAcquisition(
        logLContributions,
        logGContributions,
        estimateCostForConfig(split, candidateConfig),
        Option.none(),
        acquisition
      )
    )
  )

const scoreTraceAt = (
  traces: ReadonlyArray<NamedDimensionScoreTrace>,
  split: TrialSplit,
  index: number,
  acquisition: AcquisitionOption
): Effect.Effect<readonly [unknown, number], InvalidSamplerConfig> =>
  configAtIndex(traces, index).pipe(
    Effect.flatMap((candidateConfig) =>
      jointScoreAtIndex(traces, split, candidateConfig, index, acquisition).pipe(
        Effect.map((jointScore) => Tuple.make(candidateConfig, jointScore))
      )
    )
  )

/**
 * Scores candidates jointly across all dimension traces by summing per-dimension
 * log-densities under l(x) and g(x), applying cost-aware acquisition scoring,
 * then selecting the config with the highest joint score.
 *
 * @see {@link MixedCandidateSelection} for the output shape
 * @see {@link traceForParameter} for building the per-dimension input traces
 * @since 0.1.0
 * @category scoring
 */
export const selectBestMixedCandidate = (
  traces: ReadonlyArray<NamedDimensionScoreTrace>,
  split: TrialSplit,
  acquisition: AcquisitionOption = defaultAcquisitionName,
  reason = "tpe mixed-space joint candidate selection produced no candidate"
): Effect.Effect<MixedCandidateSelection, InvalidSamplerConfig> =>
  candidateCount(traces).pipe(
    Option.match({
      onNone: () =>
        Effect.fail(invalidConfig("tpe mixed-space candidate selection requires at least one parameter trace")),
      onSome: (count) =>
        Match.value(Num.lessThanOrEqualTo(count, 0)).pipe(
          Match.when(
            true,
            () => Effect.fail(invalidConfig("tpe mixed-space candidate selection requires at least one candidate"))
          ),
          Match.orElse(() =>
            Effect.gen(function*() {
              const indices = Arr.makeBy(count, (entryIndex) => entryIndex)
              const scoredCandidates = yield* Effect.forEach(
                indices,
                (entryIndex) => scoreTraceAt(traces, split, entryIndex, acquisition)
              )
              const candidateConfigs = Arr.map(scoredCandidates, ([candidateConfig]) => candidateConfig)
              const jointScores = Arr.map(scoredCandidates, ([, weightedScore]) => weightedScore)
              const bestConfig = yield* chooseBestCandidate(candidateConfigs, jointScores, reason)

              return new MixedCandidateSelection({
                candidateConfigs,
                jointScores,
                bestIndex: argmax(jointScores),
                bestConfig
              })
            })
          )
        )
    })
  )

/**
 * Dispatches to the appropriate dimension-specific trace builder (float, int,
 * fidelity, or categorical) for a single parameter, returning a
 * {@link NamedDimensionScoreTrace} ready for joint scoring.
 *
 * @see {@link suggestMixedJoint} for the full mixed-space pipeline that calls this
 * @see {@link selectBestMixedCandidate} for how the resulting traces are scored
 * @since 0.1.0
 * @category sampling
 */
export const traceForParameter = (
  rng: Rng.Rng,
  nCandidates: number,
  parameter: SearchSpace.ParameterMetadata,
  split: TrialSplit,
  noiseOptions: NoiseBandwidthOptions = defaultNoiseBandwidthOptions,
  acquisition: AcquisitionOption = defaultAcquisitionName
): Effect.Effect<NamedDimensionScoreTrace, InvalidSamplerConfig> =>
  Match.value(parameter.distribution).pipe(
    Match.when({ type: "categorical" }, ({ choices }) =>
      categoricalCandidateTrace(rng, nCandidates, parameter, choices, split, acquisition).pipe(
        Effect.map((trace) =>
          namedTrace(parameter.name, trace)
        )
      )),
    Match.when({ type: "float" }, ({ low, high, scale, step }) =>
      floatCandidateTrace(
        rng,
        nCandidates,
        parameter,
        low,
        high,
        Option.fromNullable(scale),
        Option.fromNullable(step),
        split,
        noiseOptions,
        acquisition
      ).pipe(Effect.map((trace) => namedTrace(parameter.name, trace)))),
    Match.when({ type: "int" }, ({ low, high, step }) =>
      intCandidateTrace(rng, nCandidates, parameter, low, high, Option.fromNullable(step), split, acquisition).pipe(
        Effect.map((trace) =>
          namedTrace(parameter.name, trace)
        )
      )),
    Match.when({ type: "fidelity" }, ({ low, high }) =>
      intCandidateTrace(rng, nCandidates, parameter, low, high, Option.none(), split, acquisition).pipe(
        Effect.map((trace) =>
          namedTrace(parameter.name, trace)
        )
      )),
    Match.exhaustive
  )

/**
 * Suggests a full config across a heterogeneous search space by generating
 * per-dimension candidate traces and jointly scoring them via the acquisition
 * function.
 *
 * This is the top-level entry point for mixed-space TPE suggestion when all
 * dimensions are scored independently then combined.
 *
 * @see {@link traceForParameter} for per-dimension trace construction
 * @see {@link selectBestMixedCandidate} for joint candidate selection
 * @since 0.1.0
 * @category sampling
 */
export const suggestMixedJoint = (
  rng: Rng.Rng,
  nCandidates: number,
  space: SearchSpace.SearchSpace,
  split: TrialSplit,
  noiseOptions: NoiseBandwidthOptions = defaultNoiseBandwidthOptions,
  acquisition: AcquisitionOption = defaultAcquisitionName
): Effect.Effect<unknown, InvalidSamplerConfig> =>
  Effect.gen(function*() {
    const traces = yield* Effect.forEach(space.params, (parameter) =>
      traceForParameter(rng, nCandidates, parameter, split, noiseOptions, acquisition))
    const selection = yield* selectBestMixedCandidate(traces, split, acquisition)

    return selection.bestConfig
  })
