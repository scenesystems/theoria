import { Match, Schema } from "effect"
import { WorkflowModuleGraphProjection } from "effect-dsp/contracts"
import { type GraphVariant, ScoreProfileSchema, WorkflowExecutionRecordSchema } from "effect-inference/Contracts"

export const WorkflowSelectedKnobs = Schema.Record({
  key: Schema.String,
  value: Schema.String
})

export type WorkflowSelectedKnobs = typeof WorkflowSelectedKnobs.Type

export const baselineWorkflowGraphVariant: GraphVariant = "baseline"

export const optimizedWorkflowGraphVariant: GraphVariant = "optimized"

export const emptyWorkflowSelectedKnobs = WorkflowSelectedKnobs.make({})

type WorkflowGraph = typeof WorkflowExecutionRecordSchema.Type["graph"]

type WorkflowGraphInput = {
  readonly edges: WorkflowGraph["edges"]
  readonly manifestId: WorkflowGraph["manifestId"]
  readonly nodes: WorkflowGraph["nodes"]
  readonly optimizationKnobs: WorkflowGraph["optimizationKnobs"]
  readonly variant?: GraphVariant
  readonly workflowKind: WorkflowGraph["workflowKind"]
}

const workflowGraphForVariant = (variant: GraphVariant) => (graph: WorkflowGraphInput): WorkflowGraph => ({
  ...graph,
  variant
})

export const baselineWorkflowGraph = workflowGraphForVariant(baselineWorkflowGraphVariant)

export const optimizedWorkflowGraph = workflowGraphForVariant(optimizedWorkflowGraphVariant)

const workflowVariantSelectionFields = {
  record: WorkflowExecutionRecordSchema,
  profile: ScoreProfileSchema,
  selectedKnobs: WorkflowSelectedKnobs
}

const workflowVariantPlanFields = {
  ...workflowVariantSelectionFields,
  graphProjection: WorkflowModuleGraphProjection
}

export class BaselineWorkflowVariantSelection extends Schema.TaggedClass<BaselineWorkflowVariantSelection>()(
  "BaselineWorkflowVariantSelection",
  workflowVariantSelectionFields
) {}

export class OptimizedWorkflowVariantSelection extends Schema.TaggedClass<OptimizedWorkflowVariantSelection>()(
  "OptimizedWorkflowVariantSelection",
  workflowVariantSelectionFields
) {}

export const WorkflowVariantSelection = Schema.Union(
  BaselineWorkflowVariantSelection,
  OptimizedWorkflowVariantSelection
)

export type WorkflowVariantSelection = typeof WorkflowVariantSelection.Type

export class BaselineWorkflowVariantPlan extends Schema.TaggedClass<BaselineWorkflowVariantPlan>()(
  "BaselineWorkflowVariantPlan",
  workflowVariantPlanFields
) {}

export class OptimizedWorkflowVariantPlan extends Schema.TaggedClass<OptimizedWorkflowVariantPlan>()(
  "OptimizedWorkflowVariantPlan",
  workflowVariantPlanFields
) {}

export const WorkflowVariantPlan = Schema.Union(
  BaselineWorkflowVariantPlan,
  OptimizedWorkflowVariantPlan
)

export type WorkflowVariantPlan = typeof WorkflowVariantPlan.Type

export const baselineWorkflowVariantSelection = ({
  profile,
  record,
  selectedKnobs = emptyWorkflowSelectedKnobs
}: {
  readonly profile: typeof ScoreProfileSchema.Type
  readonly record: typeof WorkflowExecutionRecordSchema.Type
  readonly selectedKnobs?: WorkflowSelectedKnobs
}): BaselineWorkflowVariantSelection =>
  BaselineWorkflowVariantSelection.make({
    profile,
    record,
    selectedKnobs
  })

export const optimizedWorkflowVariantSelection = ({
  profile,
  record,
  selectedKnobs = emptyWorkflowSelectedKnobs
}: {
  readonly profile: typeof ScoreProfileSchema.Type
  readonly record: typeof WorkflowExecutionRecordSchema.Type
  readonly selectedKnobs?: WorkflowSelectedKnobs
}): OptimizedWorkflowVariantSelection =>
  OptimizedWorkflowVariantSelection.make({
    profile,
    record,
    selectedKnobs
  })

export const workflowVariantSelectionFor = ({
  profile,
  record,
  selectedKnobs = emptyWorkflowSelectedKnobs,
  variant
}: {
  readonly profile: typeof ScoreProfileSchema.Type
  readonly record: typeof WorkflowExecutionRecordSchema.Type
  readonly selectedKnobs?: WorkflowSelectedKnobs
  readonly variant: GraphVariant
}): WorkflowVariantSelection =>
  Match.value(variant).pipe(
    Match.when(
      baselineWorkflowGraphVariant,
      () => baselineWorkflowVariantSelection({ profile, record, selectedKnobs })
    ),
    Match.when(
      optimizedWorkflowGraphVariant,
      () => optimizedWorkflowVariantSelection({ profile, record, selectedKnobs })
    ),
    Match.exhaustive
  )

export const workflowGraphVariantForSelection = (selection: WorkflowVariantSelection): GraphVariant =>
  Match.value(selection).pipe(
    Match.withReturnType<GraphVariant>(),
    Match.tag("BaselineWorkflowVariantSelection", () => baselineWorkflowGraphVariant),
    Match.tag("OptimizedWorkflowVariantSelection", () => optimizedWorkflowGraphVariant),
    Match.exhaustive
  )

export const workflowVariantPlanForSelection = ({
  graphProjection,
  selection
}: {
  readonly graphProjection: typeof WorkflowModuleGraphProjection.Type
  readonly selection: WorkflowVariantSelection
}): WorkflowVariantPlan =>
  Match.value(selection).pipe(
    Match.tag("BaselineWorkflowVariantSelection", ({ profile, record, selectedKnobs }) =>
      BaselineWorkflowVariantPlan.make({
        graphProjection,
        profile,
        record,
        selectedKnobs
      })),
    Match.tag("OptimizedWorkflowVariantSelection", ({ profile, record, selectedKnobs }) =>
      OptimizedWorkflowVariantPlan.make({
        graphProjection,
        profile,
        record,
        selectedKnobs
      })),
    Match.exhaustive
  )

export const workflowGraphVariantForPlan = (plan: WorkflowVariantPlan): GraphVariant =>
  Match.value(plan).pipe(
    Match.withReturnType<GraphVariant>(),
    Match.tag("BaselineWorkflowVariantPlan", () => baselineWorkflowGraphVariant),
    Match.tag("OptimizedWorkflowVariantPlan", () => optimizedWorkflowGraphVariant),
    Match.exhaustive
  )
