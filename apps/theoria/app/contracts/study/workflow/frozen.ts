import { Match, Schema } from "effect"
import { ScoreProfileSchema, WorkflowExecutionRecordSchema, WorkflowKindSchema } from "effect-inference/Contracts"

import { DurableFingerprint } from "../../entry/fingerprint.js"
import { workflowEntryId } from "../../entry/id.js"

import { WorkflowScenarioIdSchema } from "./manifest.js"
import { WorkflowAuthorityBindingsSchema } from "./scenario.js"

const NonEmptyString = Schema.String.pipe(Schema.minLength(1))

type FrozenWorkflowVariantFields = {
  readonly record: typeof WorkflowExecutionRecordSchema.Type
  readonly profile: typeof ScoreProfileSchema.Type
  readonly recordFingerprint: typeof DurableFingerprint.Type
}

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

export const baselineFrozenWorkflowVariant = (fields: FrozenWorkflowVariantFields): BaselineFrozenWorkflowVariant =>
  BaselineFrozenWorkflowVariant.make(fields)

export const optimizedFrozenWorkflowVariant = (fields: FrozenWorkflowVariantFields): OptimizedFrozenWorkflowVariant =>
  OptimizedFrozenWorkflowVariant.make(fields)

export const frozenWorkflowVariantLabel = (
  variant: FrozenWorkflowVariant
): "baseline" | "optimized" =>
  Match.value(variant).pipe(
    Match.withReturnType<"baseline" | "optimized">(),
    Match.tag("BaselineFrozenWorkflowVariant", () => "baseline"),
    Match.tag("OptimizedFrozenWorkflowVariant", () => "optimized"),
    Match.exhaustive
  )

export const FrozenWorkflowRun = Schema.Struct({
  entryId: Schema.Literal(workflowEntryId),
  scenarioId: WorkflowScenarioIdSchema,
  label: NonEmptyString,
  summary: NonEmptyString,
  workflowKind: WorkflowKindSchema,
  authorities: WorkflowAuthorityBindingsSchema,
  baseline: BaselineFrozenWorkflowVariant,
  optimized: OptimizedFrozenWorkflowVariant
})

export type FrozenWorkflowRun = typeof FrozenWorkflowRun.Type

export const encodeFrozenWorkflowRun = Schema.encodeSync(
  FrozenWorkflowRun
)
