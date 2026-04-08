/**
 * Stream manifest — typed per-demo parameters for SSE stream requests.
 *
 * Each demo declares a tagged variant with its own fields. The transport
 * layer encodes the manifest as JSON in a single URL query parameter.
 * Server-side `streamElements` receives the decoded schema; client-side
 * snapshots construct the appropriate variant from widget atoms.
 *
 * @since 0.1.0
 * @module
 */
import { Schema } from "effect"

import { DspModuleType, DspScenarioId } from "../capability/effect-dsp.js"
import {
  powerAlphaMax,
  powerAlphaMin,
  powerEffectSizeMax,
  powerEffectSizeMin,
  powerSampleSizeMax,
  powerSampleSizeMin
} from "../capability/effect-math.js"
import { optimizationTrialBudgetMax, optimizationTrialBudgetMin } from "../capability/effect-search.js"

export class EffectTextManifest extends Schema.TaggedClass<EffectTextManifest>()("effect-text", {
  customText: Schema.String,
  viewportWidthPx: Schema.optionalWith(
    Schema.Number.pipe(Schema.greaterThanOrEqualTo(0), Schema.int()),
    { default: () => 0 }
  )
}) {}

export class EffectDspManifest extends Schema.TaggedClass<EffectDspManifest>()("effect-dsp", {
  scenarioId: DspScenarioId,
  moduleType: DspModuleType,
  optimizationBudget: Schema.Number.pipe(Schema.int(), Schema.between(1, 5))
}) {}

export class EffectSearchManifest extends Schema.TaggedClass<EffectSearchManifest>()("effect-search", {
  trialBudget: Schema.Number.pipe(Schema.int(), Schema.between(optimizationTrialBudgetMin, optimizationTrialBudgetMax))
}) {}

export class EffectMathManifest extends Schema.TaggedClass<EffectMathManifest>()("effect-math", {
  d: Schema.Number.pipe(Schema.between(powerEffectSizeMin, powerEffectSizeMax)),
  n: Schema.Number.pipe(Schema.int(), Schema.between(powerSampleSizeMin, powerSampleSizeMax)),
  alpha: Schema.Number.pipe(Schema.between(powerAlphaMin, powerAlphaMax))
}) {}

export const StreamManifest = Schema.Union(
  EffectTextManifest,
  EffectDspManifest,
  EffectSearchManifest,
  EffectMathManifest
)

export type StreamManifest = typeof StreamManifest.Type

export const encodeStreamManifest = Schema.encodeSync(Schema.parseJson(StreamManifest))

export const decodeStreamManifest = Schema.decodeUnknownOption(Schema.parseJson(StreamManifest))
