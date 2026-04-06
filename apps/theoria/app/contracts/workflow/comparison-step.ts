import { Schema } from "effect"
import {
  GraphVariantSchema,
  RuntimeRoleSchema,
  WorkflowKindSchema,
  WorkflowNodeKindSchema,
  WorkflowStateLaneSchema
} from "effect-inference/Contracts"

import { WorkflowComparisonIdSchema } from "./comparison.js"

const NonEmptyString = Schema.String.pipe(Schema.minLength(1))
const PositiveInt = Schema.Number.pipe(Schema.int(), Schema.greaterThan(0))
const Score = Schema.Number.pipe(
  Schema.finite(),
  Schema.greaterThanOrEqualTo(0),
  Schema.lessThanOrEqualTo(1)
)

export class WorkflowComparisonCanonicalStep extends Schema.TaggedClass<WorkflowComparisonCanonicalStep>()(
  "WorkflowComparisonCanonicalStep",
  {
    comparisonId: WorkflowComparisonIdSchema,
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
