/**
 * Canonical contract for the implementation-strategy coding surface.
 *
 * @since 0.2.0
 */
import { Schema } from "effect"

import * as Signature from "../../../Signature/index.js"

/**
 * Default instruction text for the implementation-strategy surface.
 *
 * @since 0.2.0
 * @category constants
 */
export const signatureDescription =
  "Draft a concise implementation strategy for a strict Effect-native refactor. Return a strategy that obeys all constraints and avoids the rejected moves."

/**
 * Canonical input fields for the implementation-strategy surface.
 *
 * @since 0.2.0
 * @category schemas
 */
export const inputFields = {
  task: Signature.describe(Schema.String, "The refactor task to solve"),
  constraints: Signature.describe(Schema.String, "Hard constraints that must not be violated"),
  files: Signature.describe(Schema.String, "Files that define the authority seam for the work"),
  rejectedMoves: Signature.describe(Schema.String, "Moves that previously caused rejection")
}

/**
 * Canonical output fields for the implementation-strategy surface.
 *
 * @since 0.2.0
 * @category schemas
 */
export const outputFields = {
  strategy: Signature.describe(Schema.String, "A concise implementation strategy that satisfies the task")
}

/**
 * Canonical input schema for the implementation-strategy surface.
 *
 * @since 0.2.0
 * @category schemas
 */
export const InputSchema = Schema.Struct(inputFields).annotations({
  identifier: "effect-dsp/OpenAgentTrace/ImplementationStrategyInput"
})

/**
 * Canonical output schema for the implementation-strategy surface.
 *
 * @since 0.2.0
 * @category schemas
 */
export const OutputSchema = Schema.Struct(outputFields).annotations({
  identifier: "effect-dsp/OpenAgentTrace/ImplementationStrategyOutput"
})

/**
 * Decoded input type for the implementation-strategy surface.
 *
 * @since 0.2.0
 * @category type-level
 */
export type Input = typeof InputSchema.Type

/**
 * Decoded output type for the implementation-strategy surface.
 *
 * @since 0.2.0
 * @category type-level
 */
export type Output = typeof OutputSchema.Type
