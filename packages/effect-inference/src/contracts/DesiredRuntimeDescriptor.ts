/**
 * Caller-owned model intent supplied to runtime resolution.
 *
 * @since 0.1.0
 */
import { Schema } from "effect"

import { CapabilityRequirementsSchema } from "./CapabilityRequirements.js"
import { ExecutionRouteSchema } from "./ExecutionRoute.js"
import { ModelArtifactSchema } from "./ModelArtifact.js"

/**
 * Accepts role hints used by downstream selection policy. A role does not
 * determine a route family.
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
  /** Model identity requested by the caller. */
  artifact: ModelArtifactSchema,
  /** Explicit execution route; the live resolver rejects its absence. */
  route: Schema.optional(ExecutionRouteSchema),
  /** Constraints checked against the selected route's capability policy. */
  capabilities: Schema.optional(CapabilityRequirementsSchema),
  /** Workload hint available to downstream selection policy. */
  role: Schema.optional(RuntimeRoleSchema),
  /** Uninterpreted caller labels retained with the request. */
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
