import { Effect, Schema } from "effect"

import {
  type CapabilityAvailability,
  CapabilityAvailabilityEnvelope,
  CapabilityAvailabilityPathname
} from "../../contracts/capability/availability.js"
import { type PackageVersions, PackageVersionsEnvelope } from "../../contracts/capability/package-versions.js"
import {
  EntryDecodeError,
  type EntryError,
  EntryExecutionError,
  EntryRequestError
} from "../../contracts/entry-error.js"
import type { EntryId } from "../../contracts/entry/id.js"
import { type EntryRunRequest } from "../../contracts/entry/registry.js"
import { EntryRunRequest as EntryRunRequestSchema } from "../../contracts/entry/registry.js"
import { type ProgramPreview, ProgramPreviewEnvelope } from "../../contracts/presentation/program-preview.js"
import { type RunData, RunEnvelope } from "../../contracts/study/run.js"
import { type EnvelopeResponse, EnvelopeTransport } from "./EnvelopeTransport.js"

const EntryRunRequestJson = Schema.parseJson(EntryRunRequestSchema)
const encodeEntryRunRequestJson = Schema.encodeSync(EntryRunRequestJson)

export const entryRunPath = (id: EntryId): string => `/api/entries/${id}/run`
export const entryPreloadPath = (id: EntryId): string => `/api/entries/${id}/preload`
export const entryStreamPath = (id: EntryId): string => `/api/entries/${id}/stream`
export const capabilityAvailabilityPath = (): string => CapabilityAvailabilityPathname

const entryTransportErrors = {
  decode: EntryDecodeError.fromParseError,
  execution: EntryExecutionError.fromErrorModel,
  request: EntryRequestError.fromMessage
}

export class EntryClient extends Effect.Service<EntryClient>()("theoria/EntryClient", {
  succeed: {
    run: (request: EntryRunRequest): Effect.Effect<RunData, EntryError> =>
      EnvelopeTransport.postJson({
        body: encodeEntryRunRequestJson(request),
        errors: entryTransportErrors,
        path: entryRunPath(request.draft.entryId),
        schema: RunEnvelope
      }).pipe(Effect.map(({ data }) => data)),
    runWithMeta: (request: EntryRunRequest): Effect.Effect<EnvelopeResponse<RunData>, EntryError> =>
      EnvelopeTransport.postJson({
        body: encodeEntryRunRequestJson(request),
        errors: entryTransportErrors,
        path: entryRunPath(request.draft.entryId),
        schema: RunEnvelope
      }),
    preload: (id: EntryId): Effect.Effect<ProgramPreview, EntryError> =>
      EnvelopeTransport.get({
        errors: entryTransportErrors,
        path: entryPreloadPath(id),
        schema: ProgramPreviewEnvelope
      }).pipe(Effect.map(({ data }) => data)),
    capabilityAvailability: (): Effect.Effect<CapabilityAvailability, EntryError> =>
      EnvelopeTransport.get({
        errors: entryTransportErrors,
        path: capabilityAvailabilityPath(),
        schema: CapabilityAvailabilityEnvelope
      }).pipe(Effect.map(({ data }) => data)),
    versions: (): Effect.Effect<PackageVersions, EntryError> =>
      EnvelopeTransport.get({
        errors: entryTransportErrors,
        path: "/api/versions/packages",
        schema: PackageVersionsEnvelope
      }).pipe(Effect.map(({ data }) => data))
  }
}) {}
