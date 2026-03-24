/**
 * TPE grouped scoring — per-group joint candidate generation with optional multivariate trace merging.
 *
 * @since 0.1.0
 */
import { Array as Arr, Data, Effect, Match, Option, Predicate, Record, Tuple } from "effect"

import type { InvalidSamplerConfig } from "../../../Errors/index.js"
import type * as Rng from "../../../internal/rng.js"
import { type NoiseBandwidthOptions } from "../../../internal/tpe/noiseEstimator.js"
import type { TrialSplit } from "../../../internal/tpe/splitTrials.js"
import type * as SearchSpace from "../../../SearchSpace/index.js"
import { type AcquisitionOption, defaultAcquisitionName, scoreJointAcquisition } from "../acquisition/index.js"
import { chooseBestCandidate } from "../candidates.js"
import { estimateCostForConfig } from "../costModel.js"
import { type NamedDimensionScoreTrace, traceForParameter } from "../mixed.js"
import { multivariateContinuousCandidateTrace, type MultivariateContinuousTrace } from "../multivariateContinuous.js"
import { invalidConfig } from "../options.js"
import { isContinuousParameter, splitForParameters } from "./groups.js"
import type { GroupedMixedSettings } from "./model.js"

class GroupCandidate extends Data.Class<{
  readonly config: unknown
  readonly score: number
}> {}

const independentTraceValue = <A>(
  values: ReadonlyArray<A>,
  index: number,
  reason: string
): Effect.Effect<A, InvalidSamplerConfig> =>
  Arr.get(values, index).pipe(
    Option.match({
      onNone: () => Effect.fail(invalidConfig(reason)),
      onSome: Effect.succeed
    })
  )

const multivariateTraceForGroup = (
  rng: Rng.Rng,
  nCandidates: number,
  parameters: ReadonlyArray<SearchSpace.ParameterMetadata>,
  split: TrialSplit,
  settings: GroupedMixedSettings,
  acquisition: AcquisitionOption
): Effect.Effect<Option.Option<MultivariateContinuousTrace>, InvalidSamplerConfig> =>
  Match.value(settings.multivariate).pipe(
    Match.when(false, () => Effect.succeed(Option.none())),
    Match.orElse(() => {
      const continuous = Arr.filter(parameters, (parameter) => isContinuousParameter(parameter))
      return Match.value(continuous.length >= 2).pipe(
        Match.when(false, () => Effect.succeed(Option.none())),
        Match.orElse(() => multivariateContinuousCandidateTrace(rng, nCandidates, continuous, split, acquisition))
      )
    })
  )

/** @since 0.1.0 */
export const mergeConfigs = (left: unknown, right: unknown): unknown =>
  Record.fromEntries([
    ...Match.value(left).pipe(
      Match.when(Predicate.isRecord, (record) => Record.toEntries(record)),
      Match.orElse(() => Arr.empty<readonly [string, unknown]>())
    ),
    ...Match.value(right).pipe(
      Match.when(Predicate.isRecord, (record) => Record.toEntries(record)),
      Match.orElse(() => Arr.empty<readonly [string, unknown]>())
    )
  ])

const candidateCount = (
  independentTraces: ReadonlyArray<NamedDimensionScoreTrace>,
  multivariateTrace: Option.Option<MultivariateContinuousTrace>
): Option.Option<number> =>
  Option.match(multivariateTrace, {
    onNone: () => Arr.head(independentTraces).pipe(Option.map((trace) => trace.trace.candidates.length)),
    onSome: (trace) => Option.some(trace.candidateConfigs.length)
  })

const groupCandidateAtIndex = (
  independentTraces: ReadonlyArray<NamedDimensionScoreTrace>,
  multivariateTrace: Option.Option<MultivariateContinuousTrace>,
  split: TrialSplit,
  index: number,
  acquisition: AcquisitionOption
): Effect.Effect<GroupCandidate, InvalidSamplerConfig> =>
  Effect.gen(function*() {
    const independentEntries = yield* Effect.forEach(independentTraces, (trace) =>
      independentTraceValue(
        trace.trace.candidates,
        index,
        `tpe grouped candidate trace missing candidate at index ${index} for parameter "${trace.name}"`
      ).pipe(Effect.map((value) => Tuple.make(trace.name, value))))
    const independentLogL = yield* Effect.forEach(independentTraces, (trace) =>
      independentTraceValue(
        trace.trace.logL,
        index,
        `tpe grouped candidate trace missing logL at index ${index} for parameter "${trace.name}"`
      ))
    const independentLogG = yield* Effect.forEach(independentTraces, (trace) =>
      independentTraceValue(
        trace.trace.logG,
        index,
        `tpe grouped candidate trace missing logG at index ${index} for parameter "${trace.name}"`
      ))
    const independentConfig = Record.fromEntries(independentEntries)

    return yield* Option.match(multivariateTrace, {
      onNone: () =>
        Effect.succeed(
          new GroupCandidate({
            config: independentConfig,
            score: scoreJointAcquisition(
              independentLogL,
              independentLogG,
              estimateCostForConfig(split, independentConfig),
              Option.none(),
              acquisition
            )
          })
        ),
      onSome: (trace) =>
        Effect.all([
          independentTraceValue(
            trace.candidateConfigs,
            index,
            `tpe grouped candidate trace missing multivariate config at index ${index}`
          ),
          independentTraceValue(
            trace.logL,
            index,
            `tpe grouped candidate trace missing multivariate logL at index ${index}`
          ),
          independentTraceValue(
            trace.logG,
            index,
            `tpe grouped candidate trace missing multivariate logG at index ${index}`
          )
        ]).pipe(
          Effect.map(([multivariateConfig, multivariateLogL, multivariateLogG]) => {
            const mergedConfig = mergeConfigs(independentConfig, multivariateConfig)
            return new GroupCandidate({
              config: mergedConfig,
              score: scoreJointAcquisition(
                Arr.append(independentLogL, multivariateLogL),
                Arr.append(independentLogG, multivariateLogG),
                estimateCostForConfig(split, mergedConfig),
                Option.none(),
                acquisition
              )
            })
          })
        )
    })
  })

/** @since 0.1.0 */
export const suggestGroup = (
  rng: Rng.Rng,
  nCandidates: number,
  parameters: ReadonlyArray<SearchSpace.ParameterMetadata>,
  split: TrialSplit,
  settings: GroupedMixedSettings,
  noiseOptions: NoiseBandwidthOptions,
  acquisition: AcquisitionOption = defaultAcquisitionName
): Effect.Effect<unknown, InvalidSamplerConfig> =>
  Effect.gen(function*() {
    const groupSplit = splitForParameters(split, parameters)
    const multivariateTrace = yield* multivariateTraceForGroup(
      rng,
      nCandidates,
      parameters,
      groupSplit,
      settings,
      acquisition
    )
    const independentParameters = Option.match(multivariateTrace, {
      onNone: () => parameters,
      onSome: () => Arr.filter(parameters, (parameter) => !isContinuousParameter(parameter))
    })
    const independentTraces = yield* Effect.forEach(independentParameters, (parameter) =>
      traceForParameter(rng, nCandidates, parameter, groupSplit, noiseOptions, acquisition))
    const resolvedCount = yield* candidateCount(independentTraces, multivariateTrace).pipe(
      Option.match({
        onNone: () =>
          Effect.fail(invalidConfig("tpe grouped candidate selection requires at least one trace")),
        onSome: Effect.succeed
      })
    )
    const indices = Arr.makeBy(resolvedCount, (index) => index)
    const scoredCandidates = yield* Effect.forEach(indices, (index) =>
      groupCandidateAtIndex(independentTraces, multivariateTrace, groupSplit, index, acquisition))
    const candidateConfigs = Arr.map(scoredCandidates, (candidate) =>
      candidate.config)
    const scores = Arr.map(scoredCandidates, (candidate) =>
      candidate.score)

    return yield* chooseBestCandidate(
      candidateConfigs,
      scores,
      "tpe grouped joint candidate selection produced no candidate"
    )
  })
