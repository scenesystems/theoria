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
 * Decodes caller intent before resolution; optional route, capability, role,
 * and tag fields remain absent rather than receiving inferred defaults.
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
 * Caller-owned inference intent supplied to resolution. A missing route asks
 * an outer policy to choose one (and is rejected by the live resolver), while
 * missing capabilities, role, or tags add no constraints or policy hints.
 *
 * @since 0.1.0
 * @category type-level
 */
export type DesiredRuntimeDescriptor = Schema.Schema.Type<typeof DesiredRuntimeDescriptorSchema>
