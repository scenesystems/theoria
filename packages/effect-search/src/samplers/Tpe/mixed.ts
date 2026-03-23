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

export class NamedDimensionScoreTrace extends Data.Class<{
  readonly name: string
  readonly trace: DimensionScoreTrace<unknown>
}> {}

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
