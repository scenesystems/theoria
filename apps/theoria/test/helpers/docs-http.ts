import { HttpClient, HttpClientResponse } from "@effect/platform"
import { Effect, Layer } from "effect"

import { DocsClient } from "../../app/web/services/DocsClient.js"

/**
 * An in-memory `HttpClient` that answers every request with the JSON chosen by
 * `body` for the requested URL path.
 */
export const staticHttpClient = (body: (path: string) => string): Layer.Layer<HttpClient.HttpClient> =>
  Layer.succeed(
    HttpClient.HttpClient,
    HttpClient.make((request, url) =>
      Effect.succeed(
        HttpClientResponse.fromWeb(
          request,
          new Response(body(url.pathname), {
            status: 200,
            headers: { "content-type": "application/json" }
          })
        )
      )
    )
  )

/**
 * `DocsClient` served from in-memory documentation data.
 */
export const staticDocsClient = (body: (path: string) => string): Layer.Layer<DocsClient> =>
  DocsClient.DefaultWithoutDependencies.pipe(Layer.provide(staticHttpClient(body)))
