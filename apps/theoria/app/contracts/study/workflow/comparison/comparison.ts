import type { Effect } from "effect"
import { Schema } from "effect"
import {
  ScoreProfileSchema,
  WorkflowEvaluationReportSchema,
  WorkflowExecutionRecordSchema,
  WorkflowKindSchema
} from "effect-inference/Contracts"
import * as Arr from "effect/Array"
import * as Option from "effect/Option"

import { type AuthorityCatalogDescriptor, authorityCatalogForId } from "../../../capability/catalog.js"
import { entryDescriptorFingerprint } from "../../../entry/descriptor.js"
import { workflowEntryDescriptor as workflowEntryAuthorityDescriptor } from "../../../entry/descriptors/workflow.js"
import { type DurableFingerprint, fingerprintOf } from "../../../entry/fingerprint.js"
import { authorityIdsForEntry } from "../../../entry/focus.js"
import { type AuthorityId } from "../../../entry/id.js"
import {
  chatHandoffWorkflowComparisonId,
  chatHandoffWorkflowComparisonManifest,
  defaultWorkflowComparisonId,
  renderSensitiveWorkflowComparisonId,
  renderSensitiveWorkflowComparisonManifest,
  retrievalRequiredWorkflowComparisonId,
  retrievalRequiredWorkflowComparisonManifest,
  taskBriefingWorkflowComparisonId,
  taskBriefingWorkflowComparisonManifest,
  type WorkflowComparisonId,
  workflowComparisonIds,
  WorkflowComparisonIdSchema
} from "./manifest.js"

export {
  chatHandoffWorkflowComparisonId,
  chatHandoffWorkflowComparisonManifest,
  defaultWorkflowComparisonId,
  renderSensitiveWorkflowComparisonId,
  renderSensitiveWorkflowComparisonManifest,
  retrievalRequiredWorkflowComparisonId,
  retrievalRequiredWorkflowComparisonManifest,
  taskBriefingWorkflowComparisonId,
  taskBriefingWorkflowComparisonManifest,
  workflowComparisonIds,
  WorkflowComparisonIdSchema
}

export type { WorkflowComparisonId } from "./manifest.js"

const NonEmptyString = Schema.String.pipe(Schema.minLength(1))

export const WorkflowComparisonOptionSchema = Schema.Struct({
  id: WorkflowComparisonIdSchema,
  label: NonEmptyString,
  summary: NonEmptyString
})

export type WorkflowComparisonOption = Schema.Schema.Type<typeof WorkflowComparisonOptionSchema>

const toWorkflowComparisonOption = ({
  id,
  label,
  summary
}: {
  readonly id: WorkflowComparisonId
  readonly label: string
  readonly summary: string
}): WorkflowComparisonOption => ({ id, label, summary })

export const workflowComparisonOptions: ReadonlyArray<WorkflowComparisonOption> = Arr.map(
  [
    taskBriefingWorkflowComparisonManifest,
    chatHandoffWorkflowComparisonManifest,
    retrievalRequiredWorkflowComparisonManifest,
    renderSensitiveWorkflowComparisonManifest
  ],
  (manifest) => toWorkflowComparisonOption(manifest)
)

const defaultWorkflowComparisonOption = toWorkflowComparisonOption({
  id: taskBriefingWorkflowComparisonManifest.id,
  label: taskBriefingWorkflowComparisonManifest.label,
  summary: taskBriefingWorkflowComparisonManifest.summary
})

export const workflowComparisonOptionForId = (id: WorkflowComparisonId): WorkflowComparisonOption =>
  Option.getOrElse(
    Arr.findFirst(workflowComparisonOptions, (option) => option.id === id),
    () => defaultWorkflowComparisonOption
  )

export const workflowEntryDescriptor = workflowEntryAuthorityDescriptor

export const workflowEntryAuthorityIds = authorityIdsForEntry("workflow")

export const WorkflowComparisonEntrySchema = Schema.Struct({
  comparisonId: WorkflowComparisonIdSchema,
  entryId: Schema.Literal("workflow")
})

export type WorkflowComparisonEntry = Schema.Schema.Type<typeof WorkflowComparisonEntrySchema>

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
): boolean => Arr.every(bindingAuthorityIds(bindings), (authorityId) => workflowEntryAuthorityIds.includes(authorityId))

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
  entry: WorkflowComparisonEntrySchema,
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

const encodeWorkflowComparisonEntry = Schema.encodeSync(WorkflowComparisonEntrySchema)
const encodeWorkflowComparison = Schema.encodeSync(WorkflowComparisonSchema)
const encodeWorkflowComparisonCatalog = Schema.encodeSync(WorkflowComparisonCatalogSchema)

export const workflowComparisonId = (comparison: WorkflowComparison): WorkflowComparisonId =>
  comparison.entry.comparisonId

export const resolveWorkflowComparisonAuthorityCatalog = (
  comparison: WorkflowComparison
): WorkflowComparisonAuthorityCatalog => authorityCatalogFromBindings(comparison.authorities)

export const workflowComparisonEntryFingerprint = (
  entry: WorkflowComparisonEntry
): Effect.Effect<typeof DurableFingerprint.Type, never, never> => fingerprintOf(encodeWorkflowComparisonEntry(entry))

export const workflowEntryDescriptorFingerprint = (): Effect.Effect<
  typeof DurableFingerprint.Type,
  never,
  never
> => entryDescriptorFingerprint(workflowEntryDescriptor)

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
