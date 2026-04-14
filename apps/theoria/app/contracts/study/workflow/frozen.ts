import { ContentDigest } from "@scenesystems/digest"
import type { Effect } from "effect"
import { Schema } from "effect"
import {
  type GraphVariant,
  ScoreProfileSchema,
  WorkflowExecutionRecordSchema,
  WorkflowKindSchema
} from "effect-inference/Contracts"

import {
  DurableFingerprint,
  type DurableFingerprint as DurableFingerprintType,
  fingerprintOf
} from "../../entry/fingerprint.js"
import { workflowEntryId } from "../../entry/id.js"

import { WorkflowSeedIdSchema } from "./manifest.js"
import { WorkflowReference, type WorkflowRevision } from "./revision.js"
import { type WorkflowVariantSelection, workflowVariantSelectionFor } from "./runtime-plan.js"

const NonEmptyString = Schema.String.pipe(Schema.minLength(1))

const frozenWorkflowVariantFields = {
  record: WorkflowExecutionRecordSchema,
  profile: ScoreProfileSchema,
  recordFingerprint: DurableFingerprint
}

export class BaselineFrozenWorkflowVariant extends Schema.TaggedClass<BaselineFrozenWorkflowVariant>()(
  "BaselineFrozenWorkflowVariant",
  frozenWorkflowVariantFields
) {}

export class OptimizedFrozenWorkflowVariant extends Schema.TaggedClass<OptimizedFrozenWorkflowVariant>()(
  "OptimizedFrozenWorkflowVariant",
  frozenWorkflowVariantFields
) {}

export const FrozenWorkflowVariant = Schema.Union(
  BaselineFrozenWorkflowVariant,
  OptimizedFrozenWorkflowVariant
)

export type FrozenWorkflowVariant = typeof FrozenWorkflowVariant.Type

export class FrozenWorkflowRun extends Schema.Class<FrozenWorkflowRun>("FrozenWorkflowRun")({
  entryId: Schema.Literal(workflowEntryId),
  seedId: WorkflowSeedIdSchema,
  reference: WorkflowReference,
  revisionDigest: ContentDigest,
  label: NonEmptyString,
  summary: NonEmptyString,
  workflowKind: WorkflowKindSchema,
  baseline: BaselineFrozenWorkflowVariant,
  optimized: OptimizedFrozenWorkflowVariant
}) {
  static fromRevision({
    baseline,
    optimized,
    revision
  }: {
    readonly baseline: BaselineFrozenWorkflowVariant
    readonly optimized: OptimizedFrozenWorkflowVariant
    readonly revision: WorkflowRevision
  }): FrozenWorkflowRun {
    return FrozenWorkflowRun.make({
      entryId: workflowEntryId,
      seedId: revision.reference.seedId,
      reference: revision.reference,
      revisionDigest: revision.revisionDigest,
      label: revision.title,
      summary: revision.summary,
      workflowKind: revision.workflowKind,
      baseline,
      optimized
    })
  }

  static fingerprint(workflowRun: FrozenWorkflowRun): Effect.Effect<DurableFingerprintType, never, never> {
    return fingerprintOf(encodeFrozenWorkflowRun(workflowRun))
  }

  static selectionForVariant(
    workflowRun: FrozenWorkflowRun,
    variant: GraphVariant
  ): WorkflowVariantSelection {
    return workflowVariantSelectionFor({
      variant,
      profile: variant === "baseline" ? workflowRun.baseline.profile : workflowRun.optimized.profile,
      record: variant === "baseline" ? workflowRun.baseline.record : workflowRun.optimized.record
    })
  }
}

const encodeFrozenWorkflowRun = Schema.encodeSync(FrozenWorkflowRun)
