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
 * Serializable envelope preserving requested intent, pre-execution route and
 * capability decisions, and caller-recorded post-execution observations as
 * separate fields. Decoding proves shape only, not provider authenticity.
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
 * Replay-oriented envelope that keeps caller intent, resolver decisions,
 * capability policy, and response observations in distinct channels. Its
 * decoded shape does not authenticate the provider or attest the contents.
 *
 * @since 0.1.0
 * @category type-level
 */
export type RuntimeEvidence = Schema.Schema.Type<typeof RuntimeEvidenceSchema>
