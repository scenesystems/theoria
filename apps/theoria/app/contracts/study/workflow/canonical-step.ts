import { Schema } from "effect"

import { WorkflowCanonicalStep } from "./step.js"

/**
 * Canonical run-step inputs authored by the workflow study runtime.
 *
 * The entry-owned package step envelopes were deleted with the legacy
 * adapter/runtime stack. The browser now reduces one workflow-authored step
 * shape for every live execution.
 */
export const CanonicalStep = WorkflowCanonicalStep

export type CanonicalStep = typeof CanonicalStep.Type

/**
 * Versioned frame authority for the shared runtime spine.
 *
 * `CanonicalFrame` is the app contract boundary for in-flight frame truth.
 * The `Step` stream event carries this envelope, and browser surfaces must
 * only project from it. Local browser state is downstream projection, not
 * transport-level authority.
 */
export const CanonicalFrameVersion = Schema.Literal("v1")

export type CanonicalFrameVersion = typeof CanonicalFrameVersion.Type

export class CanonicalFrame extends Schema.Class<CanonicalFrame>("CanonicalFrame")({
  version: CanonicalFrameVersion,
  step: CanonicalStep
}) {}

export const canonicalFrameV1 = (step: CanonicalStep): CanonicalFrame => new CanonicalFrame({ version: "v1", step })
