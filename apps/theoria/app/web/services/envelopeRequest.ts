import { Data, Effect, Option, Schema } from "effect"
import * as ParseResult from "effect/ParseResult"

import { DemoDecodeError, type DemoError, DemoExecutionError, DemoRequestError } from "../../contracts/demo-error.js"
import type { Metadata } from "../../contracts/envelope.js"
import type { ErrorModel } from "../../contracts/error.js"

export const formatParseError = (error: ParseResult.ParseError): string =>
  ParseResult.TreeFormatter.formatErrorSync(error)

export class SuccessEnvelopeData<A> extends Data.Class<{
  readonly data: A
  readonly meta: Metadata
}> {}

export type DecodedEnvelope<A> =
  | { readonly ok: true; readonly meta: Metadata; readonly data: A }
  | { readonly ok: false; readonly meta: Metadata; readonly error: ErrorModel }

/** An already-encoded JSON request body; `None` sends no body. */
export type JsonBody = Option.Option<string>

const fetchJson = (path: string, method: "GET" | "POST", body: JsonBody) =>
  Effect.tryPromise({
    try: () =>
      fetch(path, {
        method,
        headers: Option.match(body, {
          onNone: () => ({ accept: "application/json" }),
          onSome: () => ({ accept: "application/json", "content-type": "application/json" })
        }),
        ...Option.match(body, { onNone: () => ({}), onSome: (json) => ({ body: json }) })
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
  schema: Schema.Schema<DecodedEnvelope<A>, I>,
  method: "GET" | "POST",
  body: JsonBody
) =>
  fetchJson(path, method, body).pipe(
    Effect.flatMap((json) =>
      Schema.decodeUnknown(schema)(json).pipe(
        Effect.mapError((error) => new DemoDecodeError({ message: formatParseError(error) }))
      )
    )
  )

/**
 * Fetches an API envelope and decodes it through its schema. A well-formed
 * error envelope becomes a typed `DemoExecutionError`; anything else that goes
 * wrong is a request or decode error.
 */
export const requestEnvelope = <A, I>(
  path: string,
  schema: Schema.Schema<DecodedEnvelope<A>, I>,
  method: "GET" | "POST" = "GET",
  body: JsonBody = Option.none()
): Effect.Effect<SuccessEnvelopeData<A>, DemoError> =>
  requestDecodedEnvelope(path, schema, method, body).pipe(
    Effect.flatMap((envelope) =>
      envelope.ok
        ? Effect.succeed(
          new SuccessEnvelopeData({
            data: envelope.data,
            meta: envelope.meta
          })
        )
        : Effect.fail(
          new DemoExecutionError({
            code: envelope.error.code,
            message: envelope.error.message,
            retryable: envelope.error.retryable
          })
        )
    )
  )
