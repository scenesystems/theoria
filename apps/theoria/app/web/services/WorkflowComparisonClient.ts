import { Effect, Schema } from "effect"
import * as ParseResult from "effect/ParseResult"

import { DemoDecodeError, type DemoError, DemoExecutionError, DemoRequestError } from "../../contracts/demo-error.js"
import type { Metadata } from "../../contracts/envelope.js"
import type { ErrorModel } from "../../contracts/error.js"
import {
  WorkflowComparisonRunEnvelope,
  type WorkflowComparisonRunPlan,
  type WorkflowComparisonRunSuccess
} from "../../contracts/workflow/comparison-run.js"

const formatParseError = (error: ParseResult.ParseError): string => ParseResult.TreeFormatter.formatErrorSync(error)

type SuccessEnvelopeData<A> = {
  readonly data: A
  readonly meta: Metadata
}

type DecodedEnvelope<A> =
  | { readonly ok: true; readonly meta: Metadata; readonly data: A }
  | { readonly ok: false; readonly meta: Metadata; readonly error: ErrorModel }

const fetchJson = (path: string) =>
  Effect.tryPromise({
    try: () =>
      fetch(path, {
        method: "GET",
        headers: {
          accept: "application/json"
        }
      }),
    catch: (cause) => new DemoRequestError({ message: String(cause) })
  }).pipe(
    Effect.flatMap((response) =>
      Effect.tryPromise({
        try: () => response.json(),
        catch: (cause) => new DemoRequestError({ message: String(cause) })
      })
    )
  )

const requestDecodedEnvelope = <A, I>(
  path: string,
  schema: Schema.Schema<DecodedEnvelope<A>, I>
) =>
  fetchJson(path).pipe(
    Effect.flatMap((json) =>
      Schema.decodeUnknown(schema)(json).pipe(
        Effect.mapError((error) => new DemoDecodeError({ message: formatParseError(error) }))
      )
    )
  )

const requestEnvelope = <A, I>(
  path: string,
  schema: Schema.Schema<DecodedEnvelope<A>, I>
): Effect.Effect<SuccessEnvelopeData<A>, DemoError> =>
  requestDecodedEnvelope(path, schema).pipe(
    Effect.flatMap((envelope) =>
      envelope.ok
        ? Effect.succeed({
          data: envelope.data,
          meta: envelope.meta
        })
        : Effect.fail(
          new DemoExecutionError({
            code: envelope.error.code,
            message: envelope.error.message,
            retryable: envelope.error.retryable
          })
        )
    )
  )

const workflowComparisonPath = (
  endpoint: "run" | "stream",
  plan: WorkflowComparisonRunPlan,
  runToken: string | null
) => {
  const params = new URLSearchParams({
    comparisonId: plan.comparisonId,
    lane: plan.lane
  })

  if (runToken !== null && runToken.trim().length > 0) {
    params.set("runToken", runToken.trim())
  }

  return `/api/workflow-comparison/${endpoint}?${params.toString()}`
}

export class WorkflowComparisonClient extends Effect.Service<WorkflowComparisonClient>()(
  "theoria/WorkflowComparisonClient",
  {
    succeed: {
      run: (plan: WorkflowComparisonRunPlan): Effect.Effect<WorkflowComparisonRunSuccess, DemoError> =>
        requestEnvelope(workflowComparisonPath("run", plan, null), WorkflowComparisonRunEnvelope).pipe(
          Effect.map(({ data }) => data)
        ),
      runWithMeta: (
        plan: WorkflowComparisonRunPlan
      ): Effect.Effect<SuccessEnvelopeData<WorkflowComparisonRunSuccess>, DemoError> =>
        requestEnvelope(workflowComparisonPath("run", plan, null), WorkflowComparisonRunEnvelope),
      streamUrl: (plan: WorkflowComparisonRunPlan, runToken: string | null = null): string =>
        workflowComparisonPath("stream", plan, runToken)
    }
  }
) {}
