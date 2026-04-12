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

import { WorkflowScenarioIdSchema } from "./manifest.js"
import { type WorkflowVariantSelection, workflowVariantSelectionFor } from "./runtime-plan.js"
import type { WorkflowScenario } from "./scenario.js"

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
  scenarioId: WorkflowScenarioIdSchema,
  label: NonEmptyString,
  summary: NonEmptyString,
  workflowKind: WorkflowKindSchema,
  baseline: BaselineFrozenWorkflowVariant,
  optimized: OptimizedFrozenWorkflowVariant
}) {
  static fromScenario({
    baseline,
    optimized,
    scenario
  }: {
    readonly baseline: BaselineFrozenWorkflowVariant
    readonly optimized: OptimizedFrozenWorkflowVariant
    readonly scenario: WorkflowScenario
  }): FrozenWorkflowRun {
    return FrozenWorkflowRun.make({
      entryId: scenario.entry.entryId,
      scenarioId: scenario.entry.scenarioId,
      label: scenario.label,
      summary: scenario.summary,
      workflowKind: scenario.workflowKind,
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
