import { Atom } from "@effect-atom/atom"
import { Effect, Layer } from "effect"

import { CapabilityAvailability } from "../../app/contracts/capability/availability.js"
import { PackageVersions } from "../../app/contracts/capability/package-versions.js"
import type { EntryError } from "../../app/contracts/entry-error.js"
import type { EntryId } from "../../app/contracts/entry/id.js"
import { Metadata } from "../../app/contracts/envelope.js"
import type { ProgramPreview } from "../../app/contracts/presentation/program-preview.js"
import type { StudyRunRequest } from "../../app/contracts/study/registry.js"
import type { RunData } from "../../app/contracts/study/run.js"
import { EntryClient } from "../../app/web/services/EntryClient.js"

import { programPreviewFixture, runDataFixture } from "./entry-fixtures.js"

type EnvelopeMetadata = typeof Metadata.Type

export type EntryClientFixtures = {
  readonly run: (id: EntryId, request?: StudyRunRequest) => Effect.Effect<RunData, EntryError>
  readonly runWithMeta?: (
    id: EntryId,
    request?: StudyRunRequest
  ) => Effect.Effect<{ readonly data: RunData; readonly meta: EnvelopeMetadata }, EntryError>
  readonly preload: (id: EntryId) => Effect.Effect<ProgramPreview, EntryError>
  readonly capabilityAvailability?: () => Effect.Effect<CapabilityAvailability, EntryError>
}

const defaultCapabilityAvailability = (): CapabilityAvailability =>
  CapabilityAvailability.make({
    entries: [],
    dsp: {
      enabled: false,
      reason: "Test DSP runtime unavailable."
    }
  })

export const makeEntryClientTestLayer = (fixtures: EntryClientFixtures): Layer.Layer<EntryClient> =>
  Layer.succeed(
    EntryClient,
    {
      _tag: "theoria/EntryClient",
      run: (request: StudyRunRequest) => fixtures.run(request.draft.entryId, request),
      runWithMeta: (request: StudyRunRequest) =>
        (fixtures.runWithMeta ?? ((id, resolvedRequest) =>
          fixtures.run(id, resolvedRequest).pipe(
            Effect.map((data) => ({
              data,
              meta: Metadata.make({
                requestId: `req-${id}`,
                buildSha: "test-build",
                durationMs: data.durationMs
              })
            }))
          )))(request.draft.entryId, request),
      preload: fixtures.preload,
      capabilityAvailability: () =>
        fixtures.capabilityAvailability?.() ?? Effect.succeed(defaultCapabilityAvailability()),
      versions: () => Effect.succeed(PackageVersions.fromRecord({}))
    }
  )

export const makeAppClientTestLayer = (fixtures: EntryClientFixtures) => makeEntryClientTestLayer(fixtures)

export const makeAppClientTestRuntime = (fixtures: EntryClientFixtures) =>
  Atom.runtime(makeAppClientTestLayer(fixtures))

export const EntryClientTest = makeEntryClientTestLayer({
  run: () => Effect.succeed(runDataFixture("test run")),
  preload: () => Effect.succeed(programPreviewFixture)
})
