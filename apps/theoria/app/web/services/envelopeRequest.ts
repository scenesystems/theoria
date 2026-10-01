import { HttpClient, type HttpClientError, HttpClientRequest } from "@effect/platform"
import { Data, Effect, identity, Match, Option, Schema } from "effect"
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

const isSuccessEnvelope = <A>(
  envelope: DecodedEnvelope<A>
): envelope is Extract<DecodedEnvelope<A>, { readonly ok: true }> => envelope.ok

/** An already-encoded JSON request body; `None` sends no body. */
export type JsonBody = Option.Option<string>

const requestErrorMessage = (error: HttpClientError.HttpClientError): string =>
  Match.value(error).pipe(
    Match.tag("ResponseError", (failure) => `Request failed with status ${String(failure.response.status)}`),
    Match.orElse((failure) => failure.message)
  )

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

const requestDecodedEnvelope = <A, I>(
  path: string,
  schema: Schema.Schema<DecodedEnvelope<A>, I>,
  method: "GET" | "POST",
  body: JsonBody
): Effect.Effect<DecodedEnvelope<A>, DemoError, HttpClient.HttpClient> =>
  requestJson(path, method, body).pipe(
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
): Effect.Effect<SuccessEnvelopeData<A>, DemoError, HttpClient.HttpClient> =>
  requestDecodedEnvelope(path, schema, method, body).pipe(
    Effect.flatMap((envelope) =>
      Match.value(envelope).pipe(
        Match.when(isSuccessEnvelope<A>, (success) =>
          Effect.succeed(
            new SuccessEnvelopeData({
              data: success.data,
              meta: success.meta
            })
          )),
        Match.orElse((failure) =>
          Effect.fail(
            new DemoExecutionError({
              code: failure.error.code,
              message: failure.error.message,
              retryable: failure.error.retryable
            })
          )
        )
      )
    )
  )
