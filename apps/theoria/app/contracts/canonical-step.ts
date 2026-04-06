import { Schema } from "effect"

import { DspCanonicalStep } from "./demo/dsp-runtime.js"
import { EffectSearchCanonicalStep } from "./demo/objective.js"
import { EffectMathCanonicalStep } from "./demo/power.js"
import { EffectTextProjectionStep } from "./demo/text.js"
import { WorkflowComparisonCanonicalStep } from "./workflow/comparison-step.js"

/**
 * Canonical run-step inputs authored by the shared runtime.
 *
 * This layer is intentionally separate from choreography: choreography
 * describes stage progression, while canonical steps carry the concrete
 * projection inputs that browser reactors project into view state.
 */
export const CanonicalStep = Schema.Union(
  EffectTextProjectionStep,
  EffectSearchCanonicalStep,
  EffectMathCanonicalStep,
  DspCanonicalStep,
  WorkflowComparisonCanonicalStep
)

export type CanonicalStep = typeof CanonicalStep.Type

/**
 * Versioned frame authority for the shared runtime spine.
 *
 * `CanonicalFrame` is the app contract boundary for in-flight frame truth.
 * The `Step` stream event carries this envelope, and browser widgets must only
 * project from it. Widget-local `LocalRunFrame` values are downstream view
 * state, not transport-level authority.
 */
export const CanonicalFrameVersion = Schema.Literal("v1")

export type CanonicalFrameVersion = typeof CanonicalFrameVersion.Type

export class CanonicalFrame extends Schema.Class<CanonicalFrame>("CanonicalFrame")({
  version: CanonicalFrameVersion,
  step: CanonicalStep
}) {}

export const canonicalFrameV1 = (step: CanonicalStep): CanonicalFrame => new CanonicalFrame({ version: "v1", step })

export {
  DspCanonicalStep,
  EffectMathCanonicalStep,
  EffectSearchCanonicalStep,
  EffectTextProjectionStep,
  WorkflowComparisonCanonicalStep
}
