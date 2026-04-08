import { Effect, Schema } from "effect"
import * as ParseResult from "effect/ParseResult"

import type { Metadata } from "../../contracts/envelope.js"
import type { ErrorModel } from "../../contracts/error.js"
import {
  OpenAgentTraceDecodeError,
  type OpenAgentTraceError,
  OpenAgentTraceExecutionError,
  openAgentTraceRegistryApiPath,
  type OpenAgentTraceRegistryEntry,
  OpenAgentTraceRegistryEnvelope,
  OpenAgentTraceRequestError
} from "../../contracts/study/workflow/open-agent-trace.js"

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
    catch: (cause) => new OpenAgentTraceRequestError({ message: String(cause) })
  }).pipe(
    Effect.flatMap((response) =>
      Effect.tryPromise({
        try: () => response.json(),
        catch: (cause) => new OpenAgentTraceRequestError({ message: String(cause) })
      })
    )
  )

const requestEnvelope = <A, I>(
  path: string,
  schema: Schema.Schema<DecodedEnvelope<A>, I>
): Effect.Effect<SuccessEnvelopeData<A>, OpenAgentTraceError> =>
  fetchJson(path).pipe(
    Effect.flatMap((json) =>
      Schema.decodeUnknown(schema)(json).pipe(
        Effect.mapError((error) => new OpenAgentTraceDecodeError({ message: formatParseError(error) }))
      )
    ),
    Effect.flatMap((envelope) =>
      envelope.ok
        ? Effect.succeed({ data: envelope.data, meta: envelope.meta })
        : Effect.fail(
          new OpenAgentTraceExecutionError({
            code: envelope.error.code,
            message: envelope.error.message,
            retryable: envelope.error.retryable
          })
        )
    )
  )

export class OpenAgentTraceClient extends Effect.Service<OpenAgentTraceClient>()("theoria/OpenAgentTraceClient", {
  succeed: {
    registry: (): Effect.Effect<ReadonlyArray<OpenAgentTraceRegistryEntry>, OpenAgentTraceError> =>
      requestEnvelope(openAgentTraceRegistryApiPath(), OpenAgentTraceRegistryEnvelope).pipe(
        Effect.map(({ data }) => data)
      )
  }
}) {}
