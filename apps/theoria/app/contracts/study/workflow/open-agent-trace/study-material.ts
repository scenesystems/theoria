import { Match, Schema } from "effect"
import * as Experimental from "effect-dsp/experimental"
import * as ParseResult from "effect/ParseResult"

import type { ErrorModel } from "../../../error.js"
import { ErrorCode } from "../../../error.js"

import { ConsumerArtifact } from "../consumer-artifact.js"
import { WorkflowHookup } from "../workflow-hookup.js"

const NonEmptyString = Schema.String.pipe(Schema.minLength(1))

export const OpenAgentTraceRecordSchema = Experimental.OpenAgentTrace.Record
export const OpenAgentTraceWorkflowProjectionSchema = Experimental.OpenAgentTrace.WorkflowProjection
export const OpenAgentTraceCoverageSchema = Experimental.OpenAgentTrace.Coverage
export const OpenAgentTraceEntryIdSchema = Experimental.OpenAgentTrace.RecordId
export type OpenAgentTraceEntryId = typeof OpenAgentTraceEntryIdSchema.Type

export const OpenAgentTraceCorpusLaneLabelSchema = Schema.Literal(
  "empty",
  "fixture-backed",
  "import-backed",
  "mixed"
)
export type OpenAgentTraceCorpusLaneLabel = typeof OpenAgentTraceCorpusLaneLabelSchema.Type
export const emptyOpenAgentTraceCorpusLaneLabel: OpenAgentTraceCorpusLaneLabel = "empty"
export const fixtureBackedOpenAgentTraceCorpusLaneLabel: OpenAgentTraceCorpusLaneLabel = "fixture-backed"
export const importBackedOpenAgentTraceCorpusLaneLabel: OpenAgentTraceCorpusLaneLabel = "import-backed"
export const mixedOpenAgentTraceCorpusLaneLabel: OpenAgentTraceCorpusLaneLabel = "mixed"
export const OpenAgentTraceStudyMaterialLaneSchema = Schema.Literal("consumer-artifacts", "workflow-hookups")
export type OpenAgentTraceStudyMaterialLane = typeof OpenAgentTraceStudyMaterialLaneSchema.Type

export class OpenAgentTraceRegistryEntry
  extends Schema.Class<OpenAgentTraceRegistryEntry>("OpenAgentTraceRegistryEntry")({
    entryId: OpenAgentTraceEntryIdSchema,
    eyebrow: NonEmptyString,
    title: NonEmptyString,
    summary: NonEmptyString,
    consumerArtifact: ConsumerArtifact,
    workflowHookup: WorkflowHookup,
    record: OpenAgentTraceRecordSchema,
    workflowProjection: OpenAgentTraceWorkflowProjectionSchema
  })
{}

export const OpenAgentTraceRegistrySchema = Schema.Array(OpenAgentTraceRegistryEntry)
export const OpenAgentTraceConsumerArtifactCatalogSchema = Schema.Array(ConsumerArtifact)
export const OpenAgentTraceWorkflowHookupCatalogSchema = Schema.Array(WorkflowHookup)

export class OpenAgentTraceCatalog extends Schema.Class<OpenAgentTraceCatalog>("OpenAgentTraceCatalog")({
  consumerArtifacts: OpenAgentTraceConsumerArtifactCatalogSchema,
  registry: OpenAgentTraceRegistrySchema,
  workflowHookups: OpenAgentTraceWorkflowHookupCatalogSchema
}) {
  static empty(): OpenAgentTraceCatalog {
    return OpenAgentTraceCatalog.make({
      consumerArtifacts: [],
      registry: [],
      workflowHookups: []
    })
  }

  static fromParts({
    consumerArtifacts,
    registry,
    workflowHookups
  }: {
    readonly consumerArtifacts: OpenAgentTraceConsumerArtifactCatalog
    readonly registry: ReadonlyArray<OpenAgentTraceRegistryEntry>
    readonly workflowHookups: OpenAgentTraceWorkflowHookupCatalog
  }): OpenAgentTraceCatalog {
    return OpenAgentTraceCatalog.make({
      consumerArtifacts,
      registry,
      workflowHookups
    })
  }

  append(additive: OpenAgentTraceCatalog): OpenAgentTraceCatalog {
    return OpenAgentTraceCatalog.make({
      consumerArtifacts: [...this.consumerArtifacts, ...additive.consumerArtifacts],
      registry: [...this.registry, ...additive.registry],
      workflowHookups: [...this.workflowHookups, ...additive.workflowHookups]
    })
  }
}

export class OpenAgentTraceConsumerArtifactStudyMaterial
  extends Schema.TaggedClass<OpenAgentTraceConsumerArtifactStudyMaterial>()("consumer-artifacts", {
    items: OpenAgentTraceConsumerArtifactCatalogSchema
  })
{
  static fromCatalog(items: OpenAgentTraceConsumerArtifactCatalog): OpenAgentTraceConsumerArtifactStudyMaterial {
    return OpenAgentTraceConsumerArtifactStudyMaterial.make({ items })
  }

  description(): string {
    return "Imported study material remains first-class beside the trace registry so the proving surface can inspect what arrived before it inspects how it was normalized."
  }

  emptyText(): string {
    return "No consumer artifacts are currently published for this corpus lane."
  }

  title(): string {
    return "Consumer Artifacts"
  }
}

export class OpenAgentTraceWorkflowHookupStudyMaterial
  extends Schema.TaggedClass<OpenAgentTraceWorkflowHookupStudyMaterial>()("workflow-hookups", {
    items: OpenAgentTraceWorkflowHookupCatalogSchema
  })
{
  static fromCatalog(items: OpenAgentTraceWorkflowHookupCatalog): OpenAgentTraceWorkflowHookupStudyMaterial {
    return OpenAgentTraceWorkflowHookupStudyMaterial.make({ items })
  }

  description(): string {
    return "Workflow hookup contracts stay visible as study material so the surface shows how external traces become executable workflow evidence inside Theoria."
  }

  emptyText(): string {
    return "No workflow hookups are currently published for this corpus lane."
  }

  title(): string {
    return "Workflow Hookups"
  }
}

export const OpenAgentTraceStudyMaterial = Schema.Union(
  OpenAgentTraceConsumerArtifactStudyMaterial,
  OpenAgentTraceWorkflowHookupStudyMaterial
)

export type OpenAgentTraceStudyMaterial = typeof OpenAgentTraceStudyMaterial.Type

export class OpenAgentTracePanelData extends Schema.Class<OpenAgentTracePanelData>("OpenAgentTracePanelData")({
  registry: OpenAgentTraceRegistrySchema,
  studyMaterials: Schema.Array(OpenAgentTraceStudyMaterial)
}) {
  static fromCatalog(catalog: OpenAgentTraceCatalog): OpenAgentTracePanelData {
    return OpenAgentTracePanelData.make({
      registry: catalog.registry,
      studyMaterials: [
        OpenAgentTraceConsumerArtifactStudyMaterial.fromCatalog(catalog.consumerArtifacts),
        OpenAgentTraceWorkflowHookupStudyMaterial.fromCatalog(catalog.workflowHookups)
      ]
    })
  }

  static assemble({
    consumerArtifacts,
    registry,
    workflowHookups
  }: {
    readonly consumerArtifacts: OpenAgentTraceConsumerArtifactCatalog
    readonly registry: ReadonlyArray<OpenAgentTraceRegistryEntry>
    readonly workflowHookups: OpenAgentTraceWorkflowHookupCatalog
  }): OpenAgentTracePanelData {
    return OpenAgentTracePanelData.fromCatalog(
      OpenAgentTraceCatalog.fromParts({
        consumerArtifacts,
        registry,
        workflowHookups
      })
    )
  }

  studyMaterialCount(lane: OpenAgentTraceStudyMaterialLane): number {
    return Match.value(lane).pipe(
      Match.when(
        "consumer-artifacts",
        () =>
          this.studyMaterials.find((studyMaterial) => studyMaterial._tag === "consumer-artifacts")?.items.length ?? 0
      ),
      Match.when(
        "workflow-hookups",
        () => this.studyMaterials.find((studyMaterial) => studyMaterial._tag === "workflow-hookups")?.items.length ?? 0
      ),
      Match.exhaustive
    )
  }
}

export class OpenAgentTraceRequestError extends Schema.TaggedError<OpenAgentTraceRequestError>()(
  "OpenAgentTraceRequestError",
  { message: Schema.String }
) {
  static fromMessage(message: string): OpenAgentTraceRequestError {
    return new OpenAgentTraceRequestError({ message })
  }
}

export class OpenAgentTraceDecodeError extends Schema.TaggedError<OpenAgentTraceDecodeError>()(
  "OpenAgentTraceDecodeError",
  { message: Schema.String }
) {
  static fromParseError(error: ParseResult.ParseError): OpenAgentTraceDecodeError {
    return new OpenAgentTraceDecodeError({
      message: ParseResult.TreeFormatter.formatErrorSync(error)
    })
  }
}

export class OpenAgentTraceExecutionError extends Schema.TaggedError<OpenAgentTraceExecutionError>()(
  "OpenAgentTraceExecutionError",
  {
    code: ErrorCode,
    message: Schema.String,
    retryable: Schema.Boolean
  }
) {
  static fromErrorModel(error: ErrorModel): OpenAgentTraceExecutionError {
    return new OpenAgentTraceExecutionError({
      code: error.code,
      message: error.message,
      retryable: error.retryable
    })
  }
}

export const OpenAgentTraceError = Schema.Union(
  OpenAgentTraceRequestError,
  OpenAgentTraceDecodeError,
  OpenAgentTraceExecutionError
)

export type OpenAgentTraceCoverage = typeof OpenAgentTraceCoverageSchema.Type
export type OpenAgentTraceConsumerArtifactCatalog = typeof OpenAgentTraceConsumerArtifactCatalogSchema.Type
export type OpenAgentTraceError = typeof OpenAgentTraceError.Type
export type OpenAgentTraceRecord = typeof OpenAgentTraceRecordSchema.Type
export type OpenAgentTraceWorkflowHookupCatalog = typeof OpenAgentTraceWorkflowHookupCatalogSchema.Type
export type OpenAgentTraceWorkflowProjection = typeof OpenAgentTraceWorkflowProjectionSchema.Type
