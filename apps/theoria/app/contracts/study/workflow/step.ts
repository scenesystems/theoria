import { Schema } from "effect"
import {
  type GraphVariant,
  GraphVariantSchema,
  RuntimeRoleSchema,
  WorkflowKindSchema,
  WorkflowNodeKindSchema,
  WorkflowStateLaneSchema
} from "effect-inference/Contracts"

import { WorkflowScenarioIdSchema } from "./manifest.js"
import { baselineWorkflowGraphVariant, optimizedWorkflowGraphVariant } from "./runtime-plan.js"

const NonEmptyString = Schema.String.pipe(Schema.minLength(1))
const PositiveInt = Schema.Number.pipe(Schema.int(), Schema.greaterThan(0))
const Score = Schema.Number.pipe(
  Schema.finite(),
  Schema.greaterThanOrEqualTo(0),
  Schema.lessThanOrEqualTo(1)
)

export class WorkflowCanonicalStep extends Schema.TaggedClass<WorkflowCanonicalStep>()(
  "WorkflowCanonicalStep",
  {
    scenarioId: WorkflowScenarioIdSchema,
    workflowKind: WorkflowKindSchema,
    variant: GraphVariantSchema,
    nodeId: NonEmptyString,
    nodeKind: WorkflowNodeKindSchema,
    runtimeRole: RuntimeRoleSchema,
    stepIndex: PositiveInt,
    stepCount: PositiveInt,
    lineage: Schema.Array(NonEmptyString),
    activeStateLanes: Schema.Array(WorkflowStateLaneSchema),
    outputText: NonEmptyString,
    aggregateScore: Score
  }
) {}

type WorkflowCanonicalStepInput = {
  readonly activeStateLanes: typeof WorkflowCanonicalStep.Type["activeStateLanes"]
  readonly aggregateScore: typeof WorkflowCanonicalStep.Type["aggregateScore"]
  readonly lineage: typeof WorkflowCanonicalStep.Type["lineage"]
  readonly nodeId: typeof WorkflowCanonicalStep.Type["nodeId"]
  readonly nodeKind: typeof WorkflowCanonicalStep.Type["nodeKind"]
  readonly outputText: typeof WorkflowCanonicalStep.Type["outputText"]
  readonly runtimeRole: typeof WorkflowCanonicalStep.Type["runtimeRole"]
  readonly scenarioId: typeof WorkflowCanonicalStep.Type["scenarioId"]
  readonly stepCount: typeof WorkflowCanonicalStep.Type["stepCount"]
  readonly stepIndex: typeof WorkflowCanonicalStep.Type["stepIndex"]
  readonly variant?: GraphVariant
  readonly workflowKind: typeof WorkflowCanonicalStep.Type["workflowKind"]
}

const workflowCanonicalStepForVariant =
  (variant: GraphVariant) => (input: WorkflowCanonicalStepInput): WorkflowCanonicalStep =>
    new WorkflowCanonicalStep({
      ...input,
      variant
    })

export const baselineWorkflowCanonicalStep = workflowCanonicalStepForVariant(baselineWorkflowGraphVariant)

export const optimizedWorkflowCanonicalStep = workflowCanonicalStepForVariant(optimizedWorkflowGraphVariant)
