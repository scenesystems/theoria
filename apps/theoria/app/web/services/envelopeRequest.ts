import { Data, Effect, identity, Option, Schema } from "effect"
import * as HttpClient from "effect/http/HttpClient"
import type * as HttpClientError from "effect/http/HttpClientError"
import * as HttpClientRequest from "effect/http/HttpClientRequest"

import { DemoDecodeError, type DemoError, DemoExecutionError, DemoRequestError } from "../../contracts/demo-error.js"
import type { Metadata } from "../../contracts/envelope.js"
import type { ErrorModel } from "../../contracts/error.js"

export const formatParseError = (error: Schema.SchemaError): string => error.message

export class SuccessEnvelopeData<A> extends Data.Class<{
  readonly data: A
  readonly meta: Metadata
}> {}

export type DecodedEnvelope<A> =
  | { readonly ok: true; readonly meta: Metadata; readonly data: A }
  | { readonly ok: false; readonly meta: Metadata; readonly error: ErrorModel }

const isSuccessEnvelope = <A>(
  envelope: DecodedEnvelope<A>
): envelope is Extract<DecodedEnvelope<A>, { readonly ok: true }> => envelope.ok

/** An already-encoded JSON request body; `None` sends no body. */
export type JsonBody = Option.Option<string>

const requestErrorMessage = (error: HttpClientError.HttpClientError): string => error.message

/**
 * Sends the request through the platform `HttpClient` and reads the body as
 * JSON regardless of status: error envelopes arrive with error statuses and
 * are decoded like any other envelope.
 */
const requestJson = (
  path: string,
  method: "GET" | "POST",
  body: JsonBody
): Effect.Effect<unknown, DemoRequestError, HttpClient.HttpClient> =>
  Effect.flatMap(HttpClient.HttpClient, (http) =>
    http.execute(
      HttpClientRequest.make(method)(path).pipe(
        HttpClientRequest.acceptJson,
        Option.match(body, {
          onNone: () => identity,
          onSome: (json) => HttpClientRequest.bodyText(json, "application/json")
        })
      )
    ).pipe(
      Effect.flatMap((response) => response.json),
      Effect.mapError((error) => new DemoRequestError({ message: requestErrorMessage(error) }))
    ))

const requestDecodedEnvelope = <A>(
  path: string,
  schema: Schema.Codec<DecodedEnvelope<A>, unknown>,
  method: "GET" | "POST",
  body: JsonBody
) =>
  requestJson(path, method, body).pipe(
    Effect.flatMap((json) =>
      Schema.decodeUnknownEffect(schema)(json).pipe(
        Effect.mapError((error) => new DemoDecodeError({ message: formatParseError(error) }))
      )
    )
  )

/**
 * Fetches an API envelope and decodes it through its schema. A well-formed
 * error envelope becomes a typed `DemoExecutionError`; anything else that goes
 * wrong is a request or decode error.
 */
export const requestEnvelope = <A>(
  path: string,
  schema: Schema.Codec<DecodedEnvelope<A>, unknown>,
  method: "GET" | "POST" = "GET",
  body: JsonBody = Option.none()
): Effect.Effect<SuccessEnvelopeData<A>, DemoError, HttpClient.HttpClient> =>
  requestDecodedEnvelope(path, schema, method, body).pipe(
    Effect.flatMap((envelope) => {
      if (isSuccessEnvelope(envelope)) {
        return Effect.succeed(
          new SuccessEnvelopeData({
            data: envelope.data,
            meta: envelope.meta
          })
        )
      }
      return Effect.fail(
        new DemoExecutionError({
          code: envelope.error.code,
          message: envelope.error.message,
          retryable: envelope.error.retryable
        })
      )
    })
  )
