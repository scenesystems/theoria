import { Effect, Option, Schema } from "effect"

import { type DemoError, DemoRequestError } from "../../contracts/demo-error.js"
import { type PlaceBuild, PlaceBuildEnvelope } from "../../contracts/imagined-place-result.js"
import { PlaceBuildRequest } from "../../contracts/imagined-place.js"

import { formatParseError, requestEnvelope, type SuccessEnvelopeData } from "./envelopeRequest.js"

const buildPath = "/api/imagined-place/build"

const encodeBuildRequest = Schema.encode(Schema.parseJson(PlaceBuildRequest))

/**
 * The home page's client for the imagined-place build. The request is encoded
 * through its schema, never hand-serialized, and the response is decoded
 * through the same envelope schema the server encodes with. The envelope's
 * metadata comes back too: it names the commit the server was built from.
 */
export class ImaginedPlaceClient extends Effect.Service<ImaginedPlaceClient>()("theoria/ImaginedPlaceClient", {
  succeed: {
    build: (request: PlaceBuildRequest): Effect.Effect<SuccessEnvelopeData<PlaceBuild>, DemoError> =>
      encodeBuildRequest(request).pipe(
        Effect.mapError((error) => new DemoRequestError({ message: formatParseError(error) })),
        Effect.flatMap((json) => requestEnvelope(buildPath, PlaceBuildEnvelope, "POST", Option.some(json)))
      )
  }
}) {}
