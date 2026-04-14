/**
 * Package-owned implementation-strategy coding surface.
 *
 * @since 0.2.0
 */
import {
  inputFields as inputFieldsValue,
  InputSchema as InputSchemaValue,
  outputFields as outputFieldsValue,
  OutputSchema as OutputSchemaValue,
  signatureDescription as signatureDescriptionValue
} from "./schema.js"

/**
 * Package-owned checked-in Amp corpus and deterministic dataset loader.
 *
 * @since 0.2.0
 */
export * from "./corpus.js"

/**
 * Deterministic importer from normalized Amp captures plus checked-in sidecars.
 *
 * @since 0.2.0
 */
export * from "./importer.js"

/**
 * Checked-in sidecar schemas for the Amp implementation-strategy corpus.
 *
 * @since 0.2.0
 */
export * from "./importerSchema.js"

/**
 * Rubric metric for implementation-strategy outputs.
 *
 * @since 0.2.0
 */
export * from "./metric.js"

/**
 * Projectors and prompt-surface helpers for implementation-strategy cases.
 *
 * @since 0.2.0
 */
export * from "./project.js"

/**
 * Canonical instruction text for the implementation-strategy surface.
 *
 * @since 0.2.0
 */
export const signatureDescription = signatureDescriptionValue

/**
 * Canonical input fields for the implementation-strategy surface.
 *
 * @since 0.2.0
 */
export const inputFields = inputFieldsValue

/**
 * Canonical input schema for the implementation-strategy surface.
 *
 * @since 0.2.0
 */
export const InputSchema = InputSchemaValue

/**
 * Canonical output fields for the implementation-strategy surface.
 *
 * @since 0.2.0
 */
export const outputFields = outputFieldsValue

/**
 * Canonical output schema for the implementation-strategy surface.
 *
 * @since 0.2.0
 */
export const OutputSchema = OutputSchemaValue
