/**
 * Provider HTTP fixtures for usage-observation contract tests.
 *
 * @since 0.4.0
 * @module
 */
import * as HttpClient from "@effect/platform/HttpClient"
import * as HttpClientResponse from "@effect/platform/HttpClientResponse"
import * as HttpServerResponse from "@effect/platform/HttpServerResponse"
import * as Arr from "effect/Array"
import * as Chunk from "effect/Chunk"
import * as Effect from "effect/Effect"
import * as Schema from "effect/Schema"
import * as Str from "effect/String"

const encodeJson = Schema.encodeSync(Schema.parseJson(Schema.Unknown))

/**
 * Makes a platform HTTP client that returns one JSON response.
 *
 * @since 0.4.0
 * @category testing
 */
export const jsonHttpClient = (body: unknown): HttpClient.HttpClient =>
  HttpClient.make((request) =>
    Effect.succeed(
      HttpClientResponse.fromWeb(
        request,
        HttpServerResponse.toWeb(HttpServerResponse.unsafeJson(body))
      )
    )
  )

/**
 * Makes a platform HTTP client that returns one SSE response.
 *
 * @since 0.4.0
 * @category testing
 */
export const sseHttpClient = (body: string): HttpClient.HttpClient =>
  HttpClient.make((request) =>
    Effect.succeed(
      HttpClientResponse.fromWeb(
        request,
        HttpServerResponse.toWeb(
          HttpServerResponse.text(body, { contentType: "text/event-stream" })
        )
      )
    )
  )

/**
 * Encodes fixture values as SSE data frames.
 *
 * @since 0.4.0
 * @category testing
 */
export const encodeSse = (events: Chunk.Chunk<unknown>): string =>
  events.pipe(
    Chunk.map((event) => Str.concat(Str.concat("data: ", encodeJson(event)), "\n\n")),
    Chunk.toArray,
    Arr.join("")
  )
