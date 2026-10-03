import { BrowserHttpClient } from "@effect/platform-browser"
import { Context, Effect, Layer, Option, Schema } from "effect"
import * as HttpClient from "effect/http/HttpClient"

import { type DemoError, DemoRequestError } from "../../contracts/demo-error.js"
import { type PlaceBuild, PlaceBuildEnvelope } from "../../contracts/imagined-place-result.js"
import { PlaceBuildRequest } from "../../contracts/imagined-place.js"

import { formatParseError, requestEnvelope, type SuccessEnvelopeData } from "./envelopeRequest.js"

const buildPath = "/api/imagined-place/build"

const encodeBuildRequest = Schema.encodeEffect(Schema.fromJsonString(PlaceBuildRequest))

const make = Effect.gen(function*() {
  const http = yield* HttpClient.HttpClient

  return {
    build: (request: PlaceBuildRequest): Effect.Effect<SuccessEnvelopeData<PlaceBuild>, DemoError> =>
      encodeBuildRequest(request).pipe(
        Effect.mapError((error) => new DemoRequestError({ message: formatParseError(error) })),
        Effect.flatMap((json) => requestEnvelope(buildPath, PlaceBuildEnvelope, "POST", Option.some(json))),
        Effect.provideService(HttpClient.HttpClient, http)
      )
  }
})

/**
 * The home page's client for the imagined-place build. The request is encoded
 * through its schema, never hand-serialized, and the response is decoded
 * through the same envelope schema the server encodes with. The envelope's
 * metadata comes back too: it names the commit the server was built from.
 * Requests go through the platform `HttpClient`, so the production layer uses
 * `fetch` while tests can provide an in-memory client through
 * `ImaginedPlaceClient.DefaultWithoutDependencies`.
 */
export class ImaginedPlaceClient extends Context.Service<ImaginedPlaceClient, Effect.Success<typeof make>>()(
  "@theoria/app/web/services/ImaginedPlaceClient"
) {
  static readonly DefaultWithoutDependencies = Layer.effect(ImaginedPlaceClient, make)
  static readonly Default = ImaginedPlaceClient.DefaultWithoutDependencies.pipe(
    Layer.provide(BrowserHttpClient.layerFetch)
  )
}
