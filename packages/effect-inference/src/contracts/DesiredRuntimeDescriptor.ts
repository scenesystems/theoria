/**
 * Requested runtime descriptor combining model, route hints, and capability
 * requirements.
 *
 * @since 0.1.0
 */
import { Schema } from "effect"

import { CapabilityRequirementsSchema } from "./CapabilityRequirements.js"
import { ExecutionRouteSchema } from "./ExecutionRoute.js"
import { ModelArtifactSchema } from "./ModelArtifact.js"

/**
 * Role hints used by downstream policy layers without becoming route-family
 * truth.
 *
 * @since 0.1.0
 * @category schemas
 */
export const RuntimeRoleSchema = Schema.Literal(
  "task",
  "teacher",
  "proposer",
  "evaluator",
  "critic"
)

/**
 * Schema describing the caller's desired runtime intent.
 *
 * @since 0.1.0
 * @category schemas
 */
export const DesiredRuntimeDescriptorSchema = Schema.Struct({
  artifact: ModelArtifactSchema,
  route: Schema.optional(ExecutionRouteSchema),
  capabilities: Schema.optional(CapabilityRequirementsSchema),
  role: Schema.optional(RuntimeRoleSchema),
  tags: Schema.optional(Schema.Array(Schema.String))
})

/**
 * Canonical desired-runtime descriptor constructor surface.
 *
 * @since 0.1.0
 * @category constructors
 */
export const DesiredRuntimeDescriptor = DesiredRuntimeDescriptorSchema

/**
 * Extracted desired-runtime descriptor type.
 *
 * @since 0.1.0
 * @category type-level
 */
export type DesiredRuntimeDescriptor = Schema.Schema.Type<typeof DesiredRuntimeDescriptor>
