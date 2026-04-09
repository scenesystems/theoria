import { Effect, Schema } from "effect"
import * as ParseResult from "effect/ParseResult"

import type { FailureEnvelope, Metadata } from "../../contracts/envelope.js"

type RequestMethod = "GET" | "POST"

type DecodedEnvelope<A> = { readonly ok: true; readonly meta: Metadata; readonly data: A } | FailureEnvelope

type EnvelopeTransportErrors<E> = {
  readonly decode: (error: ParseResult.ParseError) => E
  readonly execution: (error: FailureEnvelope["error"]) => E
  readonly request: (message: string) => E
}

export type EnvelopeResponse<A> = {
  readonly data: A
  readonly meta: Metadata
}

export class EnvelopeTransport {
  private static fetchJson<E>({
    body,
    errors,
    method,
    path
  }: {
    readonly body: string | null
    readonly errors: EnvelopeTransportErrors<E>
    readonly method: RequestMethod
    readonly path: string
  }) {
    return Effect.tryPromise({
      try: () =>
        fetch(path, {
          method,
          headers: {
            accept: "application/json",
            ...(body === null ? {} : { "content-type": "application/json" })
          },
          ...(body === null ? {} : { body })
        }),
      catch: (cause) => errors.request(String(cause))
    }).pipe(
      Effect.flatMap((response) =>
        Effect.tryPromise({
          try: () => response.json(),
          catch: (cause) => errors.request(String(cause))
        })
      )
    )
  }

  static get<A, I, E>({
    errors,
    path,
    schema
  }: {
    readonly errors: EnvelopeTransportErrors<E>
    readonly path: string
    readonly schema: Schema.Schema<DecodedEnvelope<A>, I>
  }): Effect.Effect<EnvelopeResponse<A>, E> {
    return EnvelopeTransport.request({
      body: null,
      errors,
      method: "GET",
      path,
      schema
    })
  }

  static postJson<A, I, E>({
    body,
    errors,
    path,
    schema
  }: {
    readonly body: string
    readonly errors: EnvelopeTransportErrors<E>
    readonly path: string
    readonly schema: Schema.Schema<DecodedEnvelope<A>, I>
  }): Effect.Effect<EnvelopeResponse<A>, E> {
    return EnvelopeTransport.request({
      body,
      errors,
      method: "POST",
      path,
      schema
    })
  }

  static request<A, I, E>({
    body,
    errors,
    method,
    path,
    schema
  }: {
    readonly body: string | null
    readonly errors: EnvelopeTransportErrors<E>
    readonly method: RequestMethod
    readonly path: string
    readonly schema: Schema.Schema<DecodedEnvelope<A>, I>
  }): Effect.Effect<EnvelopeResponse<A>, E> {
    return EnvelopeTransport.fetchJson({ body, errors, method, path }).pipe(
      Effect.flatMap((json) => Schema.decodeUnknown(schema)(json).pipe(Effect.mapError(errors.decode))),
      Effect.flatMap((envelope) =>
        envelope.ok
          ? Effect.succeed({
            data: envelope.data,
            meta: envelope.meta
          })
          : Effect.fail(errors.execution(envelope.error))
      )
    )
  }
}
