/**
 * TPE mixed-space suggestion — joint candidate scoring across heterogeneous dimension types.
 *
 * @since 0.1.0
 */
import { logStrict, logSumExp } from "@scenesystems/effect-math/Numeric"
import { Array as Arr, Chunk, Data, Effect, Match, Number as Num, Option, Predicate, Record, Tuple } from "effect"

import * as Acquisition from "../../Acquisition.js"
import type { Vector } from "../../Objective.js"

import type * as Rng from "../../internal/rng.js"
import { argmax } from "../../internal/tpe/expectedImprovement.js"
import { defaultNoiseBandwidthOptions, type NoiseBandwidthOptions } from "../../internal/tpe/noiseEstimator.js"
import type { TrialSplit } from "../../internal/tpe/splitTrials.js"
import type { InvalidSamplerConfig } from "../../SearchError.js"
import type * as SearchSpace from "../../SearchSpace.js"
import { chooseBestCandidate, drawRolls } from "./candidateSelection.js"
import { estimateCostForConfig } from "./costModel.js"
import { categoricalCandidateTraceFromRolls } from "./dimensions/categorical.js"
import { floatCandidateTraceFromRolls } from "./dimensions/float.js"
import { intCandidateTraceFromRolls } from "./dimensions/int.js"
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
  readonly candidateConfigs: Chunk.Chunk<unknown>
  readonly jointScores: Vector
  readonly bestIndex: number
  readonly bestConfig: unknown
}> {}

const candidateCount = (tracesInput: Iterable<NamedDimensionScoreTrace>): Option.Option<number> => {
  const traces = Arr.fromIterable(tracesInput)
  return Arr.head(traces).pipe(Option.map((entry) => Chunk.size(entry.trace.candidates)))
}

const candidateAt = (trace: DimensionScoreTrace<unknown>, index: number): Option.Option<unknown> =>
  Chunk.get(trace.candidates, index)

const namedTrace = <A>(name: string, trace: DimensionScoreTrace<A>): NamedDimensionScoreTrace =>
  new NamedDimensionScoreTrace({
    name,
    trace
  })

const normalizedCandidateValue = (name: string, candidate: unknown): unknown =>
  Match.value(candidate).pipe(
    Match.when(
      Predicate.isObject,
      (record) => Record.get(record, name).pipe(Option.getOrElse(() => candidate))
    ),
    Match.orElse(() => candidate)
  )

const configAtIndex = (
  tracesInput: Iterable<NamedDimensionScoreTrace>,
  index: number
): Effect.Effect<unknown, InvalidSamplerConfig> => {
  const traces = Arr.fromIterable(tracesInput)
  return Effect.forEach(traces, (entry) =>
    candidateAt(entry.trace, index).pipe(
      Option.match({
        onNone: () =>
          Effect.fail(
            invalidConfig(`tpe mixed candidate trace missing candidate at index ${index} for parameter "${entry.name}"`)
          ),
        onSome: (value) => Effect.succeed(Tuple.make(entry.name, normalizedCandidateValue(entry.name, value)))
      })
    )).pipe(Effect.map((entries) => Record.fromEntries(entries)))
}

const jointScoreAtIndex = (
  tracesInput: Iterable<NamedDimensionScoreTrace>,
  split: TrialSplit,
  candidateConfig: unknown,
  index: number,
  acquisition: Acquisition.Strategy
): Effect.Effect<number, InvalidSamplerConfig> => {
  const traces = Arr.fromIterable(tracesInput)
  return Effect.gen(function*() {
    const first = yield* Effect.fromOption(Arr.head(traces), () => invalidConfig("empty joint density"))
    const density = (weights: "weightsL" | "weightsG", kernels: "kernelLogL" | "kernelLogG") =>
      logSumExp(Chunk.fromIterable(
        Arr.map(first.trace[weights], (weight, component) =>
          Num.sum(
            logStrict(weight),
            Num.sumAll(Arr.map(traces, ({ trace }) =>
              Arr.get(
                Arr.get(trace[kernels], index).pipe(Option.getOrThrow),
                component
              ).pipe(Option.getOrThrow)))
          ))
      ))
    return Acquisition.score(
      new Acquisition.Context({
        logL: density("weightsL", "kernelLogL"),
        logG: density("weightsG", "kernelLogG"),
        estimatedCost: estimateCostForConfig(split, candidateConfig),
        roll: Option.none()
      }),
      acquisition
    )
  })
}

const scoreTraceAt = (
  tracesInput: Iterable<NamedDimensionScoreTrace>,
  split: TrialSplit,
  index: number,
  acquisition: Acquisition.Strategy
): Effect.Effect<readonly [unknown, number], InvalidSamplerConfig> => {
  const traces = Arr.fromIterable(tracesInput)
  return configAtIndex(traces, index).pipe(
    Effect.flatMap((candidateConfig) =>
      jointScoreAtIndex(traces, split, candidateConfig, index, acquisition).pipe(
        Effect.map((jointScore) => Tuple.make(candidateConfig, jointScore))
      )
    )
  )
}

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
  tracesInput: Iterable<NamedDimensionScoreTrace>,
  split: TrialSplit,
  acquisition: Acquisition.Strategy = Acquisition.defaultName,
  reason = "tpe mixed-space joint candidate selection produced no candidate"
): Effect.Effect<MixedCandidateSelection, InvalidSamplerConfig> => {
  const traces = Arr.fromIterable(tracesInput)
  return candidateCount(traces).pipe(
    Option.match({
      onNone: () =>
        Effect.fail(invalidConfig("tpe mixed-space candidate selection requires at least one parameter trace")),
      onSome: (count) =>
        Match.value(Num.isLessThanOrEqualTo(count, 0)).pipe(
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
                candidateConfigs: Chunk.fromIterable(candidateConfigs),
                jointScores,
                bestIndex: argmax(jointScores),
                bestConfig
              })
            })
          )
        )
    })
  )
}

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
  parameter: SearchSpace.Parameter,
  split: TrialSplit,
  noiseOptions: NoiseBandwidthOptions = defaultNoiseBandwidthOptions,
  acquisition: Acquisition.Strategy = Acquisition.defaultName,
  componentRolls: Option.Option<ReadonlyArray<number>> = Option.none()
): Effect.Effect<NamedDimensionScoreTrace, InvalidSamplerConfig> =>
  Effect.gen(function*() {
    const components = yield* Option.match(componentRolls, {
      onNone: () => drawRolls(rng, nCandidates),
      onSome: Effect.succeed
    })
    const values = yield* drawRolls(rng, nCandidates)
    const rolls = Arr.zip(components, values)
    return yield* Match.value(parameter.distribution).pipe(
      Match.when({ type: "categorical" }, ({ choices }) =>
        categoricalCandidateTraceFromRolls(parameter, choices, split, rolls, acquisition).pipe(
          Effect.map((trace) =>
            namedTrace(parameter.name, trace)
          )
        )),
      Match.when({ type: "float" }, ({ low, high, scale, step }) =>
        floatCandidateTraceFromRolls(
          parameter,
          low,
          high,
          Option.fromNullishOr(scale),
          Option.fromNullishOr(step),
          split,
          rolls,
          noiseOptions,
          acquisition
        ).pipe(Effect.map((trace) => namedTrace(parameter.name, trace)))),
      Match.when({ type: "int" }, ({ low, high, step }) =>
        intCandidateTraceFromRolls(parameter, low, high, Option.fromNullishOr(step), split, rolls, acquisition).pipe(
          Effect.map((trace) =>
            namedTrace(parameter.name, trace)
          )
        )),
      Match.when({ type: "fidelity" }, ({ low, high }) =>
        intCandidateTraceFromRolls(parameter, low, high, Option.none(), split, rolls, acquisition).pipe(
          Effect.map((trace) =>
            namedTrace(parameter.name, trace)
          )
        )),
      Match.exhaustive
    )
  })

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
  acquisition: Acquisition.Strategy = Acquisition.defaultName
): Effect.Effect<unknown, InvalidSamplerConfig> =>
  Effect.gen(function*() {
    const components = yield* drawRolls(rng, nCandidates)
    const traces = yield* Effect.forEach(space.params, (parameter) =>
      traceForParameter(rng, nCandidates, parameter, split, noiseOptions, acquisition, Option.some(components)))
    const selection = yield* selectBestMixedCandidate(traces, split, acquisition)

    return selection.bestConfig
  })
