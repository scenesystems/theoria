/**
 * Route-resolution output authority.
 *
 * @since 0.1.0
 */
import { Schema } from "effect"

import { ExecutionRouteSchema } from "./ExecutionRoute.js"
import { RuntimeFlavorSchema } from "./RuntimeFlavor.js"

/**
 * Stable schema version for replay-safe resolved-route provenance records.
 *
 * @since 0.1.0
 * @category schemas
 */
export const ResolvedRouteProvenanceVersion = "resolved-route/v1"

/**
 * Schema for the stable resolved-route provenance version literal.
 *
 * @since 0.1.0
 * @category schemas
 */
export const ResolvedRouteProvenanceVersionSchema = Schema.Literal(ResolvedRouteProvenanceVersion)

/**
 * Extracted resolved-route provenance version type.
 *
 * @since 0.1.0
 * @category type-level
 */
export type ResolvedRouteProvenanceVersion = Schema.Schema.Type<typeof ResolvedRouteProvenanceVersionSchema>

/**
 * Schema describing how requested runtime intent resolved onto an execution
 * route.
 *
 * @since 0.1.0
 * @category schemas
 */
export const ResolvedRouteDescriptorSchema = Schema.Struct({
  route: ExecutionRouteSchema,
  selectedProvider: Schema.optional(Schema.String),
  selectedDeployment: Schema.optional(Schema.String),
  providerModel: Schema.optional(Schema.String),
  runtimeFlavor: Schema.optional(RuntimeFlavorSchema),
  selectionReason: Schema.String,
  schemaVersion: ResolvedRouteProvenanceVersionSchema
})

/**
 * Canonical resolved-route descriptor constructor surface.
 *
 * @since 0.1.0
 * @category constructors
 */
export const ResolvedRouteDescriptor = ResolvedRouteDescriptorSchema

/**
 * Extracted resolved-route descriptor type.
 *
 * @since 0.1.0
 * @category type-level
 */
export type ResolvedRouteDescriptor = Schema.Schema.Type<typeof ResolvedRouteDescriptor>
