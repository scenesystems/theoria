/**
 * Shared objective configuration and trial extraction for the effect-search entry.
 *
 * Provides the 2D quadratic objective, search bounds, optimum, and trial
 * extraction utilities — all as pure functions shared by the server study
 * execution and the client-side optimization animation.
 *
 * @since 0.1.0
 * @module
 */
import { Schema } from "effect"
import * as Arr from "effect/Array"
import * as Option from "effect/Option"

import type { EvidenceSection } from "../evidence/item.js"
import { EffectSearchStudyTelemetry } from "./effect-search-study-telemetry.js"

// Temporary decomposition exception: trial-budget authority and objective-domain
// helpers still co-reside here while the effect-search contract split converges.
const NonNegativeInt = Schema.Number.pipe(Schema.int(), Schema.greaterThanOrEqualTo(0))
const PositiveInt = Schema.Number.pipe(Schema.int(), Schema.greaterThan(0))

// ---------------------------------------------------------------------------
// Search configuration
// ---------------------------------------------------------------------------

export class SearchBounds extends Schema.Class<SearchBounds>("SearchBounds")({
  xMin: Schema.Number,
  xMax: Schema.Number,
  yMin: Schema.Number,
  yMax: Schema.Number
}) {
  static defaults(): SearchBounds {
    return SearchBounds.make({
      xMin: -5,
      xMax: 5,
      yMin: -5,
      yMax: 5
    })
  }
}

export class Config2D extends Schema.Class<Config2D>("Config2D")({
  x: Schema.Number,
  y: Schema.Number
}) {
  static readonly objectiveExpression = "(x − 2)² + (y + 1)²"

  static optimum(): Config2D {
    return Config2D.make({ x: 2, y: -1 })
  }

  static fromSearchBoundsOrigin(bounds: SearchBounds = SearchBounds.defaults()): Config2D {
    return Config2D.make({
      x: bounds.xMin,
      y: bounds.yMin
    })
  }

  static objectiveValue(config: { readonly x: number; readonly y: number }): number {
    const optimum = Config2D.optimum()
    return (config.x - optimum.x) ** 2 + (config.y - optimum.y) ** 2
  }

  static distanceToOptimum(config: { readonly x: number; readonly y: number }): number {
    const optimum = Config2D.optimum()
    return Math.sqrt((config.x - optimum.x) ** 2 + (config.y - optimum.y) ** 2)
  }
}

export const SearchTrialBudget = Schema.Number.pipe(
  Schema.int(),
  Schema.between(10, 100)
)

export class SearchConfig extends Schema.Class<SearchConfig>("SearchConfig")({
  trialBudget: SearchTrialBudget
}) {
  static bounds(): {
    readonly defaultValue: number
    readonly min: number
    readonly max: number
    readonly step: number
  } {
    return {
      defaultValue: 30,
      min: 10,
      max: 100,
      step: 5
    }
  }

  static clamp(trialBudget: number): number {
    const bounds = SearchConfig.bounds()
    return Math.max(bounds.min, Math.min(trialBudget, bounds.max))
  }

  static defaults(): SearchConfig {
    return SearchConfig.make({ trialBudget: SearchConfig.bounds().defaultValue })
  }

  static fromTrialBudget(trialBudget: number): SearchConfig {
    return SearchConfig.make({
      trialBudget: SearchConfig.clamp(trialBudget)
    })
  }

  projectionScript(): EffectSearchProjectionScript {
    return EffectSearchProjectionScript.make({
      samplerSeed: defaultSamplerSeed,
      trialBudget: this.trialBudget
    })
  }
}

export const defaultSamplerSeed = 42
export const optimizationEvidenceBatchSize = 5
export const optimizationEvidenceLiveRowWindow = 12

export class EffectSearchProjectionScript extends Schema.TaggedClass<EffectSearchProjectionScript>()("effect-search", {
  samplerSeed: NonNegativeInt,
  trialBudget: PositiveInt
}) {}

export const isEffectSearchProjectionScript = Schema.is(EffectSearchProjectionScript)

// ---------------------------------------------------------------------------
// Gain computation
// ---------------------------------------------------------------------------

export const gain = (randomBestValue: number, tpeBestValue: number): number => randomBestValue - tpeBestValue

export const gainPercent = (randomBestValue: number, tpeBestValue: number): number => {
  const denominator = Math.abs(randomBestValue) < 1e-9 ? 1 : Math.abs(randomBestValue)
  return (gain(randomBestValue, tpeBestValue) / denominator) * 100
}

// ---------------------------------------------------------------------------
// Trial extraction
// ---------------------------------------------------------------------------

export type TrialPoint = {
  readonly x: number
  readonly y: number
  readonly value: number
  readonly index: number
}

export const TrialPoint = Schema.Struct({
  x: Schema.Number,
  y: Schema.Number,
  value: Schema.Number,
  index: NonNegativeInt
})

export class EffectSearchCanonicalStep extends Schema.TaggedClass<EffectSearchCanonicalStep>()(
  "EffectSearchCanonicalStep",
  {
    trialBudget: PositiveInt,
    phase: Schema.Literal("running", "complete"),
    tpeTrials: Schema.Array(TrialPoint),
    randomTrials: Schema.Array(TrialPoint),
    telemetry: EffectSearchStudyTelemetry
  }
) {}

const visibleTrialPoints = ({
  force,
  points
}: {
  readonly force: boolean
  readonly points: ReadonlyArray<TrialPoint>
}): ReadonlyArray<TrialPoint> =>
  force || points.length <= optimizationEvidenceLiveRowWindow
    ? points
    : points.slice(-optimizationEvidenceLiveRowWindow)

const trialTableLabel = ({
  force,
  prefix,
  totalCount,
  visibleCount
}: {
  readonly force: boolean
  readonly prefix: string
  readonly totalCount: number
  readonly visibleCount: number
}): string =>
  force || visibleCount === totalCount
    ? `${prefix} trial coordinates`
    : `${prefix} trial coordinates (latest ${visibleCount} of ${totalCount})`

export const trialPositionsSection = ({
  force,
  randomPoints,
  tpePoints
}: {
  readonly force: boolean
  readonly randomPoints: ReadonlyArray<TrialPoint>
  readonly tpePoints: ReadonlyArray<TrialPoint>
}): EvidenceSection => {
  const visibleTpePoints = visibleTrialPoints({ force, points: tpePoints })
  const visibleRandomPoints = visibleTrialPoints({ force, points: randomPoints })

  return {
    title: "Trial Positions",
    items: [
      {
        _tag: "Table",
        label: trialTableLabel({
          force,
          prefix: "TPE",
          totalCount: tpePoints.length,
          visibleCount: visibleTpePoints.length
        }),
        columns: ["Trial", "x", "y", "Objective"],
        rows: Arr.map(visibleTpePoints, (point) => [
          String(point.index + 1),
          point.x.toFixed(4),
          point.y.toFixed(4),
          point.value.toFixed(6)
        ])
      },
      {
        _tag: "Table",
        label: trialTableLabel({
          force,
          prefix: "Random",
          totalCount: randomPoints.length,
          visibleCount: visibleRandomPoints.length
        }),
        columns: ["Trial", "x", "y", "Objective"],
        rows: Arr.map(visibleRandomPoints, (point) => [
          String(point.index + 1),
          point.x.toFixed(4),
          point.y.toFixed(4),
          point.value.toFixed(6)
        ])
      }
    ]
  }
}

export const bestFoundSection = (
  tpePoints: ReadonlyArray<TrialPoint>,
  randomPoints: ReadonlyArray<TrialPoint>
): Option.Option<EvidenceSection> =>
  Option.map(
    Option.zipWith(bestTrialPoint(tpePoints), bestTrialPoint(randomPoints), (tpe, random) => ({ tpe, random })),
    ({ tpe, random }) => ({
      title: "Best Found",
      items: [
        {
          _tag: "Text",
          label: "TPE best",
          value: `(${tpe.x.toFixed(4)}, ${tpe.y.toFixed(4)}) → ${tpe.value.toFixed(6)}`
        },
        {
          _tag: "Text",
          label: "Random best",
          value: `(${random.x.toFixed(4)}, ${random.y.toFixed(4)}) → ${random.value.toFixed(6)}`
        },
        {
          _tag: "Comparison",
          label: "Best objective value",
          baseline: random.value,
          improved: tpe.value,
          unit: "loss",
          direction: "lower-is-better"
        }
      ]
    })
  )

type TrialState =
  | { readonly _tag: string }
  | { readonly _tag: string; readonly value: number | ReadonlyArray<number> }

type TrialSnapshot = {
  readonly config: Config2D
  readonly state: TrialState
}

const emptyTrialPoints: ReadonlyArray<TrialPoint> = []

const stateValue = (state: TrialState): Option.Option<number> =>
  "value" in state
    ? typeof state.value === "number"
      ? Option.some(state.value)
      : Option.fromNullable(state.value.at(0))
    : Option.none<number>()

export const extractTrialPoints = (trials: ReadonlyArray<TrialSnapshot>): ReadonlyArray<TrialPoint> =>
  Arr.reduce(
    trials,
    emptyTrialPoints,
    (acc, trial, index) =>
      Option.match(stateValue(trial.state), {
        onNone: () => acc,
        onSome: (value) => Arr.append(acc, { x: trial.config.x, y: trial.config.y, value, index })
      })
  )

const appendBest = (history: ReadonlyArray<number>, value: number): ReadonlyArray<number> => {
  const nextBest = Option.match(Option.fromNullable(history.at(-1)), {
    onNone: () => value,
    onSome: (previousBest) => Math.min(previousBest, value)
  })
  return [...history, nextBest]
}

export const bestHistory = (trials: ReadonlyArray<TrialSnapshot>): ReadonlyArray<number> =>
  trials.reduce<ReadonlyArray<number>>((history, trial) =>
    Option.match(stateValue(trial.state), {
      onNone: () => history,
      onSome: (nextValue) => appendBest(history, nextValue)
    }), [])

export const bestTrialPoint = (trials: ReadonlyArray<TrialPoint>): Option.Option<TrialPoint> =>
  Arr.reduce(
    trials,
    Option.none<TrialPoint>(),
    (best, trial) =>
      Option.match(best, {
        onNone: () => Option.some(trial),
        onSome: (currentBest) => Option.some(trial.value < currentBest.value ? trial : currentBest)
      })
  )
