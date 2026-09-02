import { Effect, Option, Schema } from "effect"

import { type DemoError, DemoRequestError } from "../../contracts/demo-error.js"
import { type PlaceBuild, PlaceBuildEnvelope } from "../../contracts/imagined-place-result.js"
import { PlaceBuildRequest } from "../../contracts/imagined-place.js"

import { formatParseError, requestEnvelope } from "./envelopeRequest.js"

const buildPath = "/api/imagined-place/build"

const encodeBuildRequest = Schema.encode(Schema.parseJson(PlaceBuildRequest))

/**
 * The home page's client for the imagined-place build. The request is encoded
 * through its schema, never hand-serialized, and the response is decoded
 * through the same envelope schema the server encodes with.
 */
export class ImaginedPlaceClient extends Effect.Service<ImaginedPlaceClient>()("theoria/ImaginedPlaceClient", {
  succeed: {
    build: (request: PlaceBuildRequest): Effect.Effect<PlaceBuild, DemoError> =>
      encodeBuildRequest(request).pipe(
        Effect.mapError((error) => new DemoRequestError({ message: formatParseError(error) })),
        Effect.flatMap((json) => requestEnvelope(buildPath, PlaceBuildEnvelope, "POST", Option.some(json))),
        Effect.map(({ data }) => data)
      )
  }
}) {}
