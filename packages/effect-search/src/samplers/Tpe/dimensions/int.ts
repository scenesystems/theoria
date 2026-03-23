import { Array as Arr, Effect, Number as Num, Option } from "effect"

import type { InvalidSamplerConfig } from "../../../Errors/index.js"
import type * as Rng from "../../../internal/rng.js"
import {
  buildContinuousParzen,
  logDensityEffect,
  sampleFromParzenEffect
} from "../../../internal/tpe/continuousParzen.js"
import type { TrialSplit } from "../../../internal/tpe/splitTrials.js"
import type * as SearchSpace from "../../../SearchSpace/index.js"
import { type AcquisitionOption, defaultAcquisitionName, scoreAcquisition } from "../acquisition/index.js"
import { chooseBestCandidate, drawRollPairs } from "../candidates.js"
import { expandedBoundsForStep, normalizeFloat } from "./float.js"
import { rollFromCandidatePair } from "./rolls.js"
import { type CandidateRollPair, DimensionScoreTrace } from "./trace.js"
import { numericValuesForParameter } from "./values.js"

const normalizeInt = (
  value: number,
  low: number,
  high: number,
  step: Option.Option<number>
): number =>
  Num.round(
    normalizeFloat(value, low, high, Option.orElse(step, () => Option.some(1))),
    0
  )

export const suggestIntParameter = (
  rng: Rng.Rng,
  nCandidates: number,
  parameter: SearchSpace.ParameterMetadata,
  low: number,
  high: number,
  step: Option.Option<number>,
  split: TrialSplit,
  acquisition: AcquisitionOption = defaultAcquisitionName
): Effect.Effect<number, InvalidSamplerConfig> =>
  Effect.gen(function*() {
    const trace = yield* intCandidateTrace(rng, nCandidates, parameter, low, high, step, split, acquisition)

    return yield* chooseBestCandidate(
      trace.candidates,
      trace.scores,
      `tpe int candidate selection produced no candidate for parameter "${parameter.name}"`
    )
  })

export const intCandidateTraceFromRolls = (
  parameter: SearchSpace.ParameterMetadata,
  low: number,
  high: number,
  step: Option.Option<number>,
  split: TrialSplit,
  rolls: ReadonlyArray<CandidateRollPair>,
  acquisition: AcquisitionOption = defaultAcquisitionName
): Effect.Effect<DimensionScoreTrace<number>, InvalidSamplerConfig> =>
  Effect.gen(function*() {
    const stride = Option.getOrElse(step, () => 1)
    const [modelLow, modelHigh] = expandedBoundsForStep(low, high, Option.some(stride))

    const belowParzen = buildContinuousParzen(numericValuesForParameter(parameter, split.below), modelLow, modelHigh)
    const aboveParzen = buildContinuousParzen(numericValuesForParameter(parameter, split.above), modelLow, modelHigh)
    const modelCandidates = yield* Effect.forEach(rolls, ([kernelRoll, valueRoll]) =>
      sampleFromParzenEffect(belowParzen, kernelRoll, valueRoll))
    const logPairs = yield* Effect.forEach(modelCandidates, (candidate) =>
      Effect.all([logDensityEffect(belowParzen, candidate), logDensityEffect(aboveParzen, candidate)]))

    return new DimensionScoreTrace({
      candidates: Arr.map(modelCandidates, (candidate) =>
        normalizeInt(candidate, low, high, step)),
      logL: Arr.map(logPairs, ([logL]) =>
        logL),
      logG: Arr.map(logPairs, ([_logL, logG]) =>
        logG),
      scores: Arr.map(logPairs, ([logL, logG], index) =>
        scoreAcquisition({
          logL,
          logG,
          estimatedCost: Option.none(),
          roll: rollFromCandidatePair(rolls, index)
        }, acquisition))
    })
  })

export const intCandidateTrace = (
  rng: Rng.Rng,
  nCandidates: number,
  parameter: SearchSpace.ParameterMetadata,
  low: number,
  high: number,
  step: Option.Option<number>,
  split: TrialSplit,
  acquisition: AcquisitionOption = defaultAcquisitionName
): Effect.Effect<DimensionScoreTrace<number>, InvalidSamplerConfig> =>
  drawRollPairs(rng, nCandidates).pipe(
    Effect.flatMap((rolls) => intCandidateTraceFromRolls(parameter, low, high, step, split, rolls, acquisition))
  )
