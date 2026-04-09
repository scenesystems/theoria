import { Effect, Schema } from "effect"

import { EntryExecutionError } from "../../contracts/entry-error.js"
import type { RunnableEntryId } from "../../contracts/entry/id.js"

import { DspProviderUnavailable } from "../capability/effect-dsp.js"

const isProviderUnavailable = Schema.is(DspProviderUnavailable)
const isEntryExecutionError = Schema.is(EntryExecutionError)

export const executionTimeoutError = (): EntryExecutionError =>
  new EntryExecutionError({
    code: "execution-timeout",
    message: "Entry execution timed out.",
    retryable: true
  })

const providerUnavailableError = (message: string): EntryExecutionError =>
  new EntryExecutionError({
    code: "provider-unavailable",
    message,
    retryable: false
  })

const genericExecutionError = (): EntryExecutionError =>
  new EntryExecutionError({
    code: "execution-failed",
    message: "Entry execution failed.",
    retryable: true
  })

const unexpectedExecutionFailure = ({
  entryId,
  executionId,
  runToken,
  error
}: {
  readonly entryId: RunnableEntryId
  readonly executionId: string
  readonly runToken: string
  readonly error: unknown
}) =>
  Effect.logError("theoria entry workflow failed").pipe(
    Effect.annotateLogs("entryId", entryId),
    Effect.annotateLogs("executionId", executionId),
    Effect.annotateLogs("runToken", runToken),
    Effect.annotateLogs("error", String(error)),
    Effect.as(genericExecutionError())
  )

export const resolveWorkflowExecutionError = ({
  entryId,
  executionId,
  error,
  runToken
}: {
  readonly entryId: RunnableEntryId
  readonly executionId: string
  readonly error: unknown
  readonly runToken: string
}) =>
  isProviderUnavailable(error)
    ? Effect.succeed(providerUnavailableError(error.message))
    : isEntryExecutionError(error)
    ? Effect.succeed(error)
    : unexpectedExecutionFailure({ entryId, executionId, error, runToken })

export const normalizeWorkflowExecutionError = ({
  entryId,
  executionId,
  error,
  runToken
}: {
  readonly entryId: RunnableEntryId
  readonly executionId: string
  readonly error: unknown
  readonly runToken: string
}) => resolveWorkflowExecutionError({ entryId, executionId, error, runToken }).pipe(Effect.flatMap(Effect.fail))
