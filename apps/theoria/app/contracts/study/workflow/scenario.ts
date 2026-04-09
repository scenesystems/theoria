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

import { type DurableFingerprint, fingerprintOf } from "../../entry/fingerprint.js"
import { workflowEntryId } from "../../entry/id.js"
import {
  chatHandoffWorkflowScenarioId,
  chatHandoffWorkflowScenarioManifest,
  defaultWorkflowScenarioId,
  renderSensitiveWorkflowScenarioId,
  renderSensitiveWorkflowScenarioManifest,
  retrievalRequiredWorkflowScenarioId,
  retrievalRequiredWorkflowScenarioManifest,
  taskBriefingWorkflowScenarioId,
  taskBriefingWorkflowScenarioManifest,
  type WorkflowScenarioId,
  workflowScenarioIds,
  WorkflowScenarioIdSchema
} from "./manifest.js"

export {
  chatHandoffWorkflowScenarioId,
  chatHandoffWorkflowScenarioManifest,
  defaultWorkflowScenarioId,
  renderSensitiveWorkflowScenarioId,
  renderSensitiveWorkflowScenarioManifest,
  retrievalRequiredWorkflowScenarioId,
  retrievalRequiredWorkflowScenarioManifest,
  taskBriefingWorkflowScenarioId,
  taskBriefingWorkflowScenarioManifest,
  workflowScenarioIds,
  WorkflowScenarioIdSchema
}

export type { WorkflowScenarioId } from "./manifest.js"

const NonEmptyString = Schema.String.pipe(Schema.minLength(1))

export const WorkflowScenarioOptionSchema = Schema.Struct({
  id: WorkflowScenarioIdSchema,
  label: NonEmptyString,
  summary: NonEmptyString
})

export type WorkflowScenarioOption = Schema.Schema.Type<typeof WorkflowScenarioOptionSchema>

const workflowScenarioOption = ({
  id,
  label,
  summary
}: {
  readonly id: WorkflowScenarioId
  readonly label: string
  readonly summary: string
}): WorkflowScenarioOption => ({ id, label, summary })

export const workflowScenarioOptions: ReadonlyArray<WorkflowScenarioOption> = Arr.map(
  [
    taskBriefingWorkflowScenarioManifest,
    chatHandoffWorkflowScenarioManifest,
    retrievalRequiredWorkflowScenarioManifest,
    renderSensitiveWorkflowScenarioManifest
  ],
  (manifest) => workflowScenarioOption(manifest)
)

const defaultWorkflowScenarioOption = workflowScenarioOption({
  id: taskBriefingWorkflowScenarioManifest.id,
  label: taskBriefingWorkflowScenarioManifest.label,
  summary: taskBriefingWorkflowScenarioManifest.summary
})

export const workflowScenarioOptionForId = (id: WorkflowScenarioId): WorkflowScenarioOption =>
  Option.getOrElse(
    Arr.findFirst(workflowScenarioOptions, (option) => option.id === id),
    () => defaultWorkflowScenarioOption
  )

export const WorkflowScenarioEntrySchema = Schema.Struct({
  scenarioId: WorkflowScenarioIdSchema,
  entryId: Schema.Literal(workflowEntryId)
})

export type WorkflowScenarioEntry = Schema.Schema.Type<typeof WorkflowScenarioEntrySchema>

export const WorkflowAuthorityBindingsSchema = Schema.Struct({
  numeric: Schema.Literal("effect-math"),
  program: Schema.Literal("effect-dsp"),
  render: Schema.Literal("effect-text"),
  runtime: Schema.Literal("effect-inference"),
  score: Schema.Literal("effect-inference"),
  search: Schema.Literal("effect-search")
})

export type WorkflowAuthorityBindings = Schema.Schema.Type<typeof WorkflowAuthorityBindingsSchema>

export const workflowAuthorityBindings: WorkflowAuthorityBindings = {
  numeric: "effect-math",
  program: "effect-dsp",
  render: "effect-text",
  runtime: "effect-inference",
  score: "effect-inference",
  search: "effect-search"
}

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

export class BaselineWorkflowScenarioVariant extends Schema.TaggedClass<BaselineWorkflowScenarioVariant>()(
  "BaselineWorkflowScenarioVariant",
  {
    record: WorkflowExecutionRecordSchema,
    report: WorkflowEvaluationReportSchema
  }
) {}

export class OptimizedWorkflowScenarioVariant extends Schema.TaggedClass<OptimizedWorkflowScenarioVariant>()(
  "OptimizedWorkflowScenarioVariant",
  {
    record: WorkflowExecutionRecordSchema,
    report: WorkflowEvaluationReportSchema
  }
) {}

export const WorkflowScenarioVariantSchema = Schema.Union(
  BaselineWorkflowScenarioVariant,
  OptimizedWorkflowScenarioVariant
)

export type WorkflowScenarioVariant = Schema.Schema.Type<typeof WorkflowScenarioVariantSchema>

type WorkflowScenarioVariantPair = {
  readonly baseline: BaselineWorkflowScenarioVariant
  readonly optimized: OptimizedWorkflowScenarioVariant
}

export const workflowScenarioVariantPair = ({
  baseline,
  optimized
}: WorkflowScenarioVariantPair): WorkflowScenarioVariantPair => ({
  baseline,
  optimized
})

export const baselineWorkflowScenarioVariant = ({
  record,
  report
}: {
  readonly record: WorkflowExecutionRecordPair["baseline"]
  readonly report: WorkflowEvaluationReportPair["baseline"]
}): BaselineWorkflowScenarioVariant => BaselineWorkflowScenarioVariant.make({ record, report })

export const optimizedWorkflowScenarioVariant = ({
  record,
  report
}: {
  readonly record: WorkflowExecutionRecordPair["optimized"]
  readonly report: WorkflowEvaluationReportPair["optimized"]
}): OptimizedWorkflowScenarioVariant => OptimizedWorkflowScenarioVariant.make({ record, report })

export const workflowScenarioRecordPair = ({
  baseline,
  optimized
}: WorkflowScenarioVariantPair): WorkflowExecutionRecordPair => ({
  baseline: baseline.record,
  optimized: optimized.record
})

export const workflowScenarioReportPair = ({
  baseline,
  optimized
}: WorkflowScenarioVariantPair): WorkflowEvaluationReportPair => ({
  baseline: baseline.report,
  optimized: optimized.report
})

export const WorkflowProfileLibrarySchema = Schema.Struct({
  taskOriented: ScoreProfileSchema,
  chatOriented: ScoreProfileSchema,
  retrievalOriented: ScoreProfileSchema,
  renderSensitive: ScoreProfileSchema
})

export type WorkflowProfileLibrary = Schema.Schema.Type<typeof WorkflowProfileLibrarySchema>

export const WorkflowScenarioSchema = Schema.Struct({
  entry: WorkflowScenarioEntrySchema,
  authorities: WorkflowAuthorityBindingsSchema,
  label: NonEmptyString,
  summary: NonEmptyString,
  workflowKind: WorkflowKindSchema,
  records: WorkflowExecutionRecordPairSchema,
  reports: WorkflowEvaluationReportPairSchema
})

export type WorkflowScenario = Schema.Schema.Type<typeof WorkflowScenarioSchema>

export const WorkflowScenarioCatalogSchema = Schema.Array(WorkflowScenarioSchema)

export type WorkflowScenarioCatalog = Schema.Schema.Type<typeof WorkflowScenarioCatalogSchema>

const encodeWorkflowScenarioEntry = Schema.encodeSync(WorkflowScenarioEntrySchema)
const encodeWorkflowScenario = Schema.encodeSync(WorkflowScenarioSchema)
const encodeWorkflowScenarioCatalog = Schema.encodeSync(WorkflowScenarioCatalogSchema)

export const workflowScenarioId = (scenario: WorkflowScenario): WorkflowScenarioId => scenario.entry.scenarioId

export const workflowScenarioEntryFingerprint = (
  entry: WorkflowScenarioEntry
): Effect.Effect<typeof DurableFingerprint.Type, never, never> => fingerprintOf(encodeWorkflowScenarioEntry(entry))

export const workflowScenarioFingerprint = (
  scenario: WorkflowScenario
): Effect.Effect<typeof DurableFingerprint.Type, never, never> => fingerprintOf(encodeWorkflowScenario(scenario))

export const workflowScenarioCatalogFingerprint = (
  catalog: WorkflowScenarioCatalog
): Effect.Effect<typeof DurableFingerprint.Type, never, never> => fingerprintOf(encodeWorkflowScenarioCatalog(catalog))
