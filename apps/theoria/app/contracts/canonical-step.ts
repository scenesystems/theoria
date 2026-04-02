import { Schema } from "effect"

import { DspCanonicalStep } from "./demo/dsp-runtime.js"
import { EffectTextProjectionStep } from "./demo/text.js"

/**
 * Canonical run-step inputs authored by the shared runtime.
 *
 * This layer is intentionally separate from choreography: choreography
 * describes stage progression, while canonical steps carry the concrete
 * projection inputs that local drivers render into frames and evidence.
 */
export const CanonicalStep = Schema.Union(EffectTextProjectionStep, DspCanonicalStep)

export type CanonicalStep = typeof CanonicalStep.Type

export { DspCanonicalStep, EffectTextProjectionStep }
