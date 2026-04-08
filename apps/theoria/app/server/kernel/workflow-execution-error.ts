import { Effect, Schema } from "effect"

import { DemoExecutionError } from "../../contracts/demo-error.js"
import type { RunnableEntryId } from "../../contracts/entry/id.js"

import { DspProviderUnavailable } from "../capability/effect-dsp.js"

const isProviderUnavailable = Schema.is(DspProviderUnavailable)
const isDemoExecutionError = Schema.is(DemoExecutionError)

export const executionTimeoutError = (): DemoExecutionError =>
  new DemoExecutionError({
    code: "execution-timeout",
    message: "Demo execution timed out.",
    retryable: true
  })

const providerUnavailableError = (message: string): DemoExecutionError =>
  new DemoExecutionError({
    code: "provider-unavailable",
    message,
    retryable: false
  })

const genericExecutionError = (): DemoExecutionError =>
  new DemoExecutionError({
    code: "execution-failed",
    message: "Demo execution failed.",
    retryable: true
  })

const unexpectedExecutionFailure = ({
  demoId,
  executionId,
  runToken,
  error
}: {
  readonly demoId: RunnableEntryId
  readonly executionId: string
  readonly runToken: string
  readonly error: unknown
}) =>
  Effect.logError("theoria demo workflow failed").pipe(
    Effect.annotateLogs("demoId", demoId),
    Effect.annotateLogs("executionId", executionId),
    Effect.annotateLogs("runToken", runToken),
    Effect.annotateLogs("error", String(error)),
    Effect.as(genericExecutionError())
  )

export const resolveWorkflowExecutionError = ({
  demoId,
  executionId,
  error,
  runToken
}: {
  readonly demoId: RunnableEntryId
  readonly executionId: string
  readonly error: unknown
  readonly runToken: string
}) =>
  isProviderUnavailable(error)
    ? Effect.succeed(providerUnavailableError(error.message))
    : isDemoExecutionError(error)
    ? Effect.succeed(error)
    : unexpectedExecutionFailure({ demoId, executionId, error, runToken })

export const normalizeWorkflowExecutionError = ({
  demoId,
  executionId,
  error,
  runToken
}: {
  readonly demoId: RunnableEntryId
  readonly executionId: string
  readonly error: unknown
  readonly runToken: string
}) => resolveWorkflowExecutionError({ demoId, executionId, error, runToken }).pipe(Effect.flatMap(Effect.fail))
