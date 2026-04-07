import type { Effect } from "effect"
import { Match, Schema } from "effect"
import {
  ScoreProfileSchema,
  WorkflowEvaluationReportSchema,
  WorkflowExecutionRecordSchema,
  WorkflowKindSchema
} from "effect-inference/Contracts"
import * as Arr from "effect/Array"

import { type DurableFingerprint, fingerprintOf } from "../fingerprint.js"
import { type AuthorityId, WorkflowComparisonConsumerId } from "../id.js"
import {
  type AuthorityCatalogDescriptor,
  authorityCatalogForId,
  authorityIdsForConsumer,
  publishedConsumerDescriptorFingerprint,
  workflowComparisonConsumerDescriptor
} from "../proving-substrate.js"

const NonEmptyString = Schema.String.pipe(Schema.minLength(1))

export const WorkflowComparisonIdSchema = Schema.Literal(
  "workflow-comparison/task-briefing",
  "workflow-comparison/chat-handoff",
  "workflow-comparison/retrieval-required",
  "workflow-comparison/render-sensitive"
)

export type WorkflowComparisonId = Schema.Schema.Type<typeof WorkflowComparisonIdSchema>

export const workflowComparisonIds: ReadonlyArray<WorkflowComparisonId> = [
  "workflow-comparison/task-briefing",
  "workflow-comparison/chat-handoff",
  "workflow-comparison/retrieval-required",
  "workflow-comparison/render-sensitive"
]

export const WorkflowComparisonOptionSchema = Schema.Struct({
  id: WorkflowComparisonIdSchema,
  label: NonEmptyString,
  summary: NonEmptyString
})

export type WorkflowComparisonOption = Schema.Schema.Type<typeof WorkflowComparisonOptionSchema>

export const workflowComparisonOptionForId = (id: WorkflowComparisonId): WorkflowComparisonOption =>
  Match.value(id).pipe(
    Match.when("workflow-comparison/task-briefing", () => ({
      id,
      label: "Task Briefing",
      summary:
        "Compares a baseline planning graph against an optimized task-first briefing flow under the same evaluation budget."
    })),
    Match.when("workflow-comparison/chat-handoff", () => ({
      id,
      label: "Chat Handoff",
      summary:
        "Compares a baseline conversation-handoff graph against an optimized multi-role continuation flow with the same runtime envelope."
    })),
    Match.when("workflow-comparison/retrieval-required", () => ({
      id,
      label: "Retrieval Required",
      summary:
        "Compares an ungrounded route summary against a retrieval-backed workflow that searches over evidence depth and bounded critique topology."
    })),
    Match.when("workflow-comparison/render-sensitive", () => ({
      id,
      label: "Render Sensitive",
      summary:
        "Compares a surface-agnostic reply against a render-aware workflow that searches over critique depth, render checks, and surface policy."
    })),
    Match.exhaustive
  )

export const workflowComparisonOptions: ReadonlyArray<WorkflowComparisonOption> = workflowComparisonIds.map(
  workflowComparisonOptionForId
)

export const workflowComparisonConsumerPublication = workflowComparisonConsumerDescriptor.publication

export const workflowComparisonAuthorityScopeIds = authorityIdsForConsumer(
  workflowComparisonConsumerPublication.consumerId
)

export const WorkflowComparisonPublicationSchema = Schema.Struct({
  comparisonId: WorkflowComparisonIdSchema,
  consumerId: WorkflowComparisonConsumerId
})

export type WorkflowComparisonPublication = Schema.Schema.Type<typeof WorkflowComparisonPublicationSchema>

export const WorkflowComparisonAuthorityBindingsSchema = Schema.Struct({
  numeric: Schema.Literal("effect-math"),
  program: Schema.Literal("effect-dsp"),
  render: Schema.Literal("effect-text"),
  runtime: Schema.Literal("effect-inference"),
  score: Schema.Literal("effect-inference"),
  search: Schema.Literal("effect-search")
})

export type WorkflowComparisonAuthorityBindings = Schema.Schema.Type<typeof WorkflowComparisonAuthorityBindingsSchema>

export const workflowComparisonAuthorityBindings: WorkflowComparisonAuthorityBindings = {
  numeric: "effect-math",
  program: "effect-dsp",
  render: "effect-text",
  runtime: "effect-inference",
  score: "effect-inference",
  search: "effect-search"
}

export type WorkflowComparisonAuthorityCatalog = {
  readonly numeric: AuthorityCatalogDescriptor
  readonly program: AuthorityCatalogDescriptor
  readonly render: AuthorityCatalogDescriptor
  readonly runtime: AuthorityCatalogDescriptor
  readonly score: AuthorityCatalogDescriptor
  readonly search: AuthorityCatalogDescriptor
}

const authorityCatalogFromBindings = (
  bindings: WorkflowComparisonAuthorityBindings
): WorkflowComparisonAuthorityCatalog => ({
  numeric: authorityCatalogForId(bindings.numeric),
  program: authorityCatalogForId(bindings.program),
  render: authorityCatalogForId(bindings.render),
  runtime: authorityCatalogForId(bindings.runtime),
  score: authorityCatalogForId(bindings.score),
  search: authorityCatalogForId(bindings.search)
})

export const workflowComparisonAuthorityCatalog = authorityCatalogFromBindings(workflowComparisonAuthorityBindings)

const bindingAuthorityIds = (bindings: WorkflowComparisonAuthorityBindings): ReadonlyArray<AuthorityId> => [
  bindings.numeric,
  bindings.program,
  bindings.render,
  bindings.runtime,
  bindings.score,
  bindings.search
]

export const workflowComparisonBindingsWithinPublishedConsumerScope = (
  bindings: WorkflowComparisonAuthorityBindings
): boolean =>
  Arr.every(bindingAuthorityIds(bindings), (authorityId) => workflowComparisonAuthorityScopeIds.includes(authorityId))

export const WorkflowExecutionRecordPairSchema = Schema.Struct({
  baseline: WorkflowExecutionRecordSchema,
  optimized: WorkflowExecutionRecordSchema
})

export type WorkflowExecutionRecordPair = Schema.Schema.Type<typeof WorkflowExecutionRecordPairSchema>

export const WorkflowEvaluationReportPairSchema = Schema.Struct({
  baseline: WorkflowEvaluationReportSchema,
  optimized: WorkflowEvaluationReportSchema
})

export type WorkflowEvaluationReportPair = Schema.Schema.Type<typeof WorkflowEvaluationReportPairSchema>

export const WorkflowProfileLibrarySchema = Schema.Struct({
  taskOriented: ScoreProfileSchema,
  chatOriented: ScoreProfileSchema,
  retrievalOriented: ScoreProfileSchema,
  renderSensitive: ScoreProfileSchema
})

export type WorkflowProfileLibrary = Schema.Schema.Type<typeof WorkflowProfileLibrarySchema>

export const WorkflowComparisonSchema = Schema.Struct({
  publication: WorkflowComparisonPublicationSchema,
  authorities: WorkflowComparisonAuthorityBindingsSchema,
  label: NonEmptyString,
  summary: NonEmptyString,
  workflowKind: WorkflowKindSchema,
  records: WorkflowExecutionRecordPairSchema,
  reports: WorkflowEvaluationReportPairSchema
})

export type WorkflowComparison = Schema.Schema.Type<typeof WorkflowComparisonSchema>

export const WorkflowComparisonCatalogSchema = Schema.Array(WorkflowComparisonSchema)

export type WorkflowComparisonCatalog = Schema.Schema.Type<typeof WorkflowComparisonCatalogSchema>

const encodeWorkflowComparisonPublication = Schema.encodeSync(WorkflowComparisonPublicationSchema)
const encodeWorkflowComparison = Schema.encodeSync(WorkflowComparisonSchema)
const encodeWorkflowComparisonCatalog = Schema.encodeSync(WorkflowComparisonCatalogSchema)

export const workflowComparisonId = (comparison: WorkflowComparison): WorkflowComparisonId =>
  comparison.publication.comparisonId

export const resolveWorkflowComparisonAuthorityCatalog = (
  comparison: WorkflowComparison
): WorkflowComparisonAuthorityCatalog => authorityCatalogFromBindings(comparison.authorities)

export const workflowComparisonPublicationFingerprint = (
  publication: WorkflowComparisonPublication
): Effect.Effect<typeof DurableFingerprint.Type, never, never> =>
  fingerprintOf(encodeWorkflowComparisonPublication(publication))

export const workflowComparisonConsumerDescriptorFingerprint = (): Effect.Effect<
  typeof DurableFingerprint.Type,
  never,
  never
> => publishedConsumerDescriptorFingerprint(workflowComparisonConsumerDescriptor)

export const workflowComparisonAuthorityCatalogFingerprint = (
  comparison: WorkflowComparison
): Effect.Effect<typeof DurableFingerprint.Type, never, never> =>
  fingerprintOf(resolveWorkflowComparisonAuthorityCatalog(comparison))

export const workflowComparisonFingerprint = (
  comparison: WorkflowComparison
): Effect.Effect<typeof DurableFingerprint.Type, never, never> => fingerprintOf(encodeWorkflowComparison(comparison))

export const workflowComparisonCatalogFingerprint = (
  catalog: WorkflowComparisonCatalog
): Effect.Effect<typeof DurableFingerprint.Type, never, never> =>
  fingerprintOf(encodeWorkflowComparisonCatalog(catalog))
