/**
 * Versioned route decisions recorded before provider execution.
 *
 * @since 0.1.0
 */
import { Schema } from "effect"

import { ExecutionRouteSchema } from "./ExecutionRoute.js"
import { RuntimeFlavorSchema } from "./RuntimeFlavor.js"

/**
 * Current interpretation of serialized route-provenance records.
 *
 * @since 0.1.0
 * @category schemas
 */
export const ResolvedRouteProvenanceVersion = "resolved-route/v1"

/**
 * Accepts only the current `resolved-route/v1` interpretation when decoding
 * persisted provenance; no version is supplied by default.
 *
 * @since 0.1.0
 * @category schemas
 */
export const ResolvedRouteProvenanceVersionSchema = Schema.Literal(ResolvedRouteProvenanceVersion)

/**
 * Version marker that selects the interpretation of persisted route
 * provenance; `resolved-route/v1` is required rather than inferred on decode.
 *
 * @since 0.1.0
 * @category type-level
 */
export type ResolvedRouteProvenanceVersion = Schema.Schema.Type<typeof ResolvedRouteProvenanceVersionSchema>

/**
 * Pre-execution route provenance. Provider, deployment, and model fields are
 * resolution decisions or hints and must not be treated as response evidence;
 * `selectionReason` records why the resolver made that choice.
 *
 * @since 0.1.0
 * @category schemas
 */
export const ResolvedRouteDescriptorSchema = Schema.Struct({
  /** Execution route selected by the resolver. */
  route: ExecutionRouteSchema,
  /** Provider required by policy, when resolution fixes one. */
  selectedProvider: Schema.optional(Schema.String),
  /** Deployment selected before execution, when known. */
  selectedDeployment: Schema.optional(Schema.String),
  /** Model identifier passed to the selected provider. */
  providerModel: Schema.optional(Schema.String),
  /** Serving engine inferred or selected before execution. */
  runtimeFlavor: Schema.optional(RuntimeFlavorSchema),
  /** Stable diagnostic code describing the resolver decision. */
  selectionReason: Schema.String,
  /** Required version discriminator for persisted provenance. */
  schemaVersion: ResolvedRouteProvenanceVersionSchema
})

/**
 * Records the resolver's pre-execution route decision and rationale. Optional
 * provider, deployment, model, and flavor values mean the resolver did not
 * establish that detail when absent; none are response observations.
 *
 * @since 0.1.0
 * @category type-level
 */
export type ResolvedRouteDescriptor = Schema.Schema.Type<typeof ResolvedRouteDescriptorSchema>
