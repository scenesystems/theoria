import { Schema } from "effect"
import * as Experimental from "effect-dsp/experimental"

import { Envelope } from "../../envelope.js"
import { ErrorCode } from "../../error.js"

const NonEmptyString = Schema.String.pipe(Schema.minLength(1))

export const OpenAgentTraceRecordSchema = Experimental.OpenAgentTrace.OpenAgentTraceRecord

export const OpenAgentTraceWorkflowProjectionSchema = Experimental.OpenAgentTrace.OpenAgentTraceWorkflowProjection

export const OpenAgentTraceCoverageSchema = Experimental.OpenAgentTrace.OpenAgentTraceCoverage

export const OpenAgentTraceRegistryEntryIdSchema = Schema.Literal("task-first", "chat-continuation")

export const OpenAgentTraceRegistryEntrySchema = Schema.Struct({
  entryId: OpenAgentTraceRegistryEntryIdSchema,
  title: NonEmptyString,
  summary: NonEmptyString,
  record: OpenAgentTraceRecordSchema,
  workflowProjection: OpenAgentTraceWorkflowProjectionSchema
})

export const OpenAgentTraceRegistrySchema = Schema.Array(OpenAgentTraceRegistryEntrySchema)

export const OpenAgentTraceRegistryEnvelope = Envelope(OpenAgentTraceRegistrySchema)

export const OpenAgentTraceApiRegistryPathname = "/api/open-agent-trace/registry"

export class OpenAgentTraceRequestError extends Schema.TaggedError<OpenAgentTraceRequestError>()(
  "OpenAgentTraceRequestError",
  {
    message: Schema.String
  }
) {}

export class OpenAgentTraceDecodeError extends Schema.TaggedError<OpenAgentTraceDecodeError>()(
  "OpenAgentTraceDecodeError",
  {
    message: Schema.String
  }
) {}

export class OpenAgentTraceExecutionError extends Schema.TaggedError<OpenAgentTraceExecutionError>()(
  "OpenAgentTraceExecutionError",
  {
    code: ErrorCode,
    message: Schema.String,
    retryable: Schema.Boolean
  }
) {}

export const OpenAgentTraceError = Schema.Union(
  OpenAgentTraceRequestError,
  OpenAgentTraceDecodeError,
  OpenAgentTraceExecutionError
)

export type OpenAgentTraceCoverage = typeof OpenAgentTraceCoverageSchema.Type
export type OpenAgentTraceError = typeof OpenAgentTraceError.Type
export type OpenAgentTraceRecord = typeof OpenAgentTraceRecordSchema.Type
export type OpenAgentTraceRegistryEntry = typeof OpenAgentTraceRegistryEntrySchema.Type
export type OpenAgentTraceWorkflowProjection = typeof OpenAgentTraceWorkflowProjectionSchema.Type

export const openAgentTraceRegistryApiPath = (): string => OpenAgentTraceApiRegistryPathname
