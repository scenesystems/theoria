import type { Effect } from "effect"
import { Schema } from "effect"
import {
  ScoreProfileSchema,
  WorkflowEvaluationReportSchema,
  WorkflowExecutionRecordSchema,
  WorkflowKindSchema
} from "effect-inference/Contracts"

import { type DurableFingerprint, fingerprintOf } from "../../entry/fingerprint.js"
import { workflowEntryId } from "../../entry/id.js"
import { type WorkflowScenarioId, WorkflowScenarioIdSchema, WorkflowScenarioManifest } from "./manifest.js"

export { WorkflowScenarioIdSchema, WorkflowScenarioManifest }

export type { WorkflowScenarioId } from "./manifest.js"

const NonEmptyString = Schema.String.pipe(Schema.minLength(1))

export class WorkflowScenarioEntry extends Schema.Class<WorkflowScenarioEntry>("WorkflowScenarioEntry")({
  scenarioId: WorkflowScenarioIdSchema,
  entryId: Schema.Literal(workflowEntryId)
}) {
  static fingerprint(
    entry: WorkflowScenarioEntry
  ): Effect.Effect<typeof DurableFingerprint.Type, never, never> {
    return fingerprintOf(encodeWorkflowScenarioEntry(entry))
  }
}

export class WorkflowExecutionRecordPair
  extends Schema.Class<WorkflowExecutionRecordPair>("WorkflowExecutionRecordPair")({
    baseline: WorkflowExecutionRecordSchema,
    optimized: WorkflowExecutionRecordSchema
  })
{
  static fromVariants(variants: WorkflowScenarioVariants): WorkflowExecutionRecordPair {
    return WorkflowExecutionRecordPair.make({
      baseline: variants.baseline.record,
      optimized: variants.optimized.record
    })
  }
}

export class WorkflowEvaluationReportPair
  extends Schema.Class<WorkflowEvaluationReportPair>("WorkflowEvaluationReportPair")({
    baseline: WorkflowEvaluationReportSchema,
    optimized: WorkflowEvaluationReportSchema
  })
{
  static fromVariants(variants: WorkflowScenarioVariants): WorkflowEvaluationReportPair {
    return WorkflowEvaluationReportPair.make({
      baseline: variants.baseline.report,
      optimized: variants.optimized.report
    })
  }
}

export class BaselineWorkflowScenarioVariant extends Schema.TaggedClass<BaselineWorkflowScenarioVariant>()(
  "BaselineWorkflowScenarioVariant",
  {
    record: WorkflowExecutionRecordSchema,
    report: WorkflowEvaluationReportSchema
  }
) {
  static fromPair({
    record,
    report
  }: {
    readonly record: WorkflowExecutionRecordPair["baseline"]
    readonly report: WorkflowEvaluationReportPair["baseline"]
  }): BaselineWorkflowScenarioVariant {
    return BaselineWorkflowScenarioVariant.make({ record, report })
  }
}

export class OptimizedWorkflowScenarioVariant extends Schema.TaggedClass<OptimizedWorkflowScenarioVariant>()(
  "OptimizedWorkflowScenarioVariant",
  {
    record: WorkflowExecutionRecordSchema,
    report: WorkflowEvaluationReportSchema
  }
) {
  static fromPair({
    record,
    report
  }: {
    readonly record: WorkflowExecutionRecordPair["optimized"]
    readonly report: WorkflowEvaluationReportPair["optimized"]
  }): OptimizedWorkflowScenarioVariant {
    return OptimizedWorkflowScenarioVariant.make({ record, report })
  }
}

export const WorkflowScenarioVariantSchema = Schema.Union(
  BaselineWorkflowScenarioVariant,
  OptimizedWorkflowScenarioVariant
)

export type WorkflowScenarioVariant = Schema.Schema.Type<typeof WorkflowScenarioVariantSchema>

export class WorkflowScenarioVariants extends Schema.Class<WorkflowScenarioVariants>("WorkflowScenarioVariants")({
  baseline: BaselineWorkflowScenarioVariant,
  optimized: OptimizedWorkflowScenarioVariant
}) {}

export const WorkflowProfileLibrarySchema = Schema.Struct({
  taskOriented: ScoreProfileSchema,
  chatOriented: ScoreProfileSchema,
  retrievalOriented: ScoreProfileSchema,
  renderSensitive: ScoreProfileSchema
})

export type WorkflowProfileLibrary = Schema.Schema.Type<typeof WorkflowProfileLibrarySchema>

export class WorkflowScenario extends Schema.Class<WorkflowScenario>("WorkflowScenario")({
  entry: WorkflowScenarioEntry,
  label: NonEmptyString,
  summary: NonEmptyString,
  workflowKind: WorkflowKindSchema,
  records: WorkflowExecutionRecordPair,
  reports: WorkflowEvaluationReportPair
}) {
  static id(scenario: WorkflowScenario): WorkflowScenarioId {
    return scenario.entry.scenarioId
  }

  static fingerprint(
    scenario: WorkflowScenario
  ): Effect.Effect<typeof DurableFingerprint.Type, never, never> {
    return fingerprintOf(encodeWorkflowScenario(scenario))
  }

  static catalogFingerprint(
    catalog: WorkflowScenarioCatalog
  ): Effect.Effect<typeof DurableFingerprint.Type, never, never> {
    return fingerprintOf(encodeWorkflowScenarioCatalog(catalog))
  }

  static fromManifest({
    manifest,
    variants,
    workflowKind
  }: {
    readonly manifest: WorkflowScenarioManifest
    readonly variants: WorkflowScenarioVariants
    readonly workflowKind: typeof WorkflowKindSchema.Type
  }): WorkflowScenario {
    return WorkflowScenario.make({
      entry: WorkflowScenarioEntry.make({
        scenarioId: manifest.id,
        entryId: workflowEntryId
      }),
      label: manifest.label,
      summary: manifest.summary,
      workflowKind,
      records: WorkflowExecutionRecordPair.fromVariants(variants),
      reports: WorkflowEvaluationReportPair.fromVariants(variants)
    })
  }
}

export const WorkflowScenarioCatalogSchema = Schema.Array(WorkflowScenario)

export type WorkflowScenarioCatalog = Schema.Schema.Type<typeof WorkflowScenarioCatalogSchema>

export const decodeWorkflowScenario = Schema.decodeUnknownSync(WorkflowScenario)
export const decodeWorkflowExecutionRecord = Schema.decodeUnknownSync(WorkflowExecutionRecordSchema)
export const decodeWorkflowEvaluationReport = Schema.decodeUnknownSync(WorkflowEvaluationReportSchema)
export const decodeWorkflowProfile = Schema.decodeUnknownSync(ScoreProfileSchema)

export const encodeWorkflowScenarioEntry = Schema.encodeSync(WorkflowScenarioEntry)
export const encodeWorkflowScenario = Schema.encodeSync(WorkflowScenario)
const encodeWorkflowScenarioCatalog = Schema.encodeSync(WorkflowScenarioCatalogSchema)
