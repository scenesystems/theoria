/**
 * Stable runtime-evidence projection consumed by sibling packages.
 *
 * @since 0.1.0
 */
import { Schema } from "effect"

import { DesiredRuntimeDescriptorSchema } from "./DesiredRuntimeDescriptor.js"
import { ResolvedRouteDescriptorSchema } from "./ResolvedRouteDescriptor.js"
import { ResolvedRuntimeDescriptorSchema } from "./ResolvedRuntimeDescriptor.js"
import { RuntimeCapabilitiesSchema } from "./RuntimeCapabilities.js"

/**
 * Schema bundling requested runtime intent, route resolution, and post-execution
 * runtime truth into one replay-safe record.
 *
 * @since 0.1.0
 * @category schemas
 */
export const RuntimeEvidenceSchema = Schema.Struct({
  desired: DesiredRuntimeDescriptorSchema,
  resolvedRoute: ResolvedRouteDescriptorSchema,
  resolvedRuntime: ResolvedRuntimeDescriptorSchema,
  capabilities: RuntimeCapabilitiesSchema
})

/**
 * Canonical runtime-evidence constructor surface.
 *
 * @since 0.1.0
 * @category constructors
 */
export const RuntimeEvidence = RuntimeEvidenceSchema

/**
 * Extracted runtime-evidence type.
 *
 * @since 0.1.0
 * @category type-level
 */
export type RuntimeEvidence = Schema.Schema.Type<typeof RuntimeEvidence>
