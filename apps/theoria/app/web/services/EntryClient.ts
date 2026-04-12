import { Effect, Schema } from "effect"
import type * as ParseResult from "effect/ParseResult"

import {
  type CapabilityAvailability,
  CapabilityAvailabilityEnvelope,
  CapabilityAvailabilityRoute
} from "../../contracts/capability/availability.js"
import {
  type PackageVersions,
  PackageVersionsEnvelope,
  PackageVersionsRoute
} from "../../contracts/capability/package-versions.js"
import {
  EntryDecodeError,
  type EntryError,
  EntryExecutionError,
  EntryRequestError
} from "../../contracts/entry-error.js"
import { EntryPreloadRoute, EntryRunRoute } from "../../contracts/entry/api-route.js"
import type { EntryId } from "../../contracts/entry/id.js"
import { type EntryRunRequest } from "../../contracts/entry/registry.js"
import { EntryRunRequest as EntryRunRequestSchema } from "../../contracts/entry/registry.js"
import type { ErrorModel } from "../../contracts/error.js"
import { type ProgramPreview, ProgramPreviewEnvelope } from "../../contracts/presentation/program-preview.js"
import { type RunData, RunEnvelope } from "../../contracts/study/run.js"
import { type EnvelopeResponse, EnvelopeTransport } from "./EnvelopeTransport.js"

const EntryRunRequestJson = Schema.parseJson(EntryRunRequestSchema)
const encodeEntryRunRequestJson = Schema.encodeSync(EntryRunRequestJson)

const entryTransportErrors = {
  decode: (error: ParseResult.ParseError): EntryError => EntryDecodeError.fromParseError(error),
  execution: (error: ErrorModel): EntryError => EntryExecutionError.fromErrorModel(error),
  request: (message: string): EntryError => EntryRequestError.fromMessage(message)
}

export class EntryClient extends Effect.Service<EntryClient>()("theoria/EntryClient", {
  succeed: {
    run: (request: EntryRunRequest): Effect.Effect<RunData, EntryError> =>
      EnvelopeTransport.postJson({
        body: encodeEntryRunRequestJson(request),
        errors: entryTransportErrors,
        path: EntryRunRoute.fromEntryId(request.draft.entryId).path(),
        schema: RunEnvelope
      }).pipe(Effect.map(({ data }) => data)),
    runWithMeta: (request: EntryRunRequest): Effect.Effect<EnvelopeResponse<RunData>, EntryError> =>
      EnvelopeTransport.postJson({
        body: encodeEntryRunRequestJson(request),
        errors: entryTransportErrors,
        path: EntryRunRoute.fromEntryId(request.draft.entryId).path(),
        schema: RunEnvelope
      }),
    preload: (id: EntryId): Effect.Effect<ProgramPreview, EntryError> =>
      EnvelopeTransport.get({
        errors: entryTransportErrors,
        path: EntryPreloadRoute.fromEntryId(id).path(),
        schema: ProgramPreviewEnvelope
      }).pipe(Effect.map(({ data }) => data)),
    capabilityAvailability: (): Effect.Effect<CapabilityAvailability, EntryError> =>
      EnvelopeTransport.get({
        errors: entryTransportErrors,
        path: CapabilityAvailabilityRoute.availability().path(),
        schema: CapabilityAvailabilityEnvelope
      }).pipe(Effect.map(({ data }) => data)),
    versions: (): Effect.Effect<PackageVersions, EntryError> =>
      EnvelopeTransport.get({
        errors: entryTransportErrors,
        path: PackageVersionsRoute.packages().path(),
        schema: PackageVersionsEnvelope
      }).pipe(Effect.map(({ data }) => data))
  }
}) {}
