import { Schema } from "effect"

const NonEmptyString = Schema.String.pipe(Schema.minLength(1))
const NonNegativeInt = Schema.Number.pipe(Schema.int(), Schema.greaterThanOrEqualTo(0))
const PositiveInt = Schema.Number.pipe(Schema.int(), Schema.greaterThan(0))

export const effectSearchStudyRuntimeSectionTitle = "Study runtime"
export const effectSearchStudyTraceSectionTitle = "Study event trace"

export const EffectSearchStudySignal = Schema.Struct({
  label: NonEmptyString,
  value: Schema.String
})

export type EffectSearchStudySignal = typeof EffectSearchStudySignal.Type

export const EffectSearchStudyLaneTelemetry = Schema.Struct({
  completedTrials: NonNegativeInt,
  eventCount: NonNegativeInt,
  lastSignal: NonEmptyString,
  bestValue: Schema.String,
  recentSignals: Schema.Array(EffectSearchStudySignal)
})

export type EffectSearchStudyLaneTelemetry = typeof EffectSearchStudyLaneTelemetry.Type

export const EffectSearchStudyTelemetry = Schema.Struct({
  trialBudget: PositiveInt,
  tpe: EffectSearchStudyLaneTelemetry,
  random: EffectSearchStudyLaneTelemetry
})

export type EffectSearchStudyTelemetry = typeof EffectSearchStudyTelemetry.Type
