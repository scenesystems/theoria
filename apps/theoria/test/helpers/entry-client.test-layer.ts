import { Atom } from "@effect-atom/atom"
import { Effect, Layer } from "effect"

import type { DemoError } from "../../app/contracts/demo-error.js"
import type { Metadata } from "../../app/contracts/envelope.js"
import type { EntryId } from "../../app/contracts/id.js"
import type { ProgramPreview } from "../../app/contracts/program-preview.js"
import type { EntryRunRequest } from "../../app/contracts/proving-substrate.js"
import type { RunData } from "../../app/contracts/run.js"
import { EntryClient } from "../../app/web/services/EntryClient.js"

import { programPreviewFixture, runDataFixture } from "./demo-fixtures.js"

export type EntryClientFixtures = {
  readonly run: (id: EntryId, request?: EntryRunRequest) => Effect.Effect<RunData, DemoError>
  readonly runWithMeta?: (
    id: EntryId,
    request?: EntryRunRequest
  ) => Effect.Effect<{ readonly data: RunData; readonly meta: Metadata }, DemoError>
  readonly preload: (id: EntryId) => Effect.Effect<ProgramPreview, DemoError>
}

export const makeEntryClientTestLayer = (fixtures: EntryClientFixtures): Layer.Layer<EntryClient> =>
  Layer.succeed(
    EntryClient,
    {
      _tag: "theoria/EntryClient",
      run: (request: EntryRunRequest) => fixtures.run(request.draft.entryId, request),
      runWithMeta: (request: EntryRunRequest) =>
        (fixtures.runWithMeta ?? ((id, resolvedRequest) =>
          fixtures.run(id, resolvedRequest).pipe(
            Effect.map((data) => ({
              data,
              meta: {
                requestId: `req-${id}`,
                buildSha: "test-build",
                durationMs: data.durationMs
              }
            }))
          )))(request.draft.entryId, request),
      preload: fixtures.preload,
      versions: () => Effect.succeed({})
    }
  )

export const makeAppClientTestLayer = (fixtures: EntryClientFixtures) => makeEntryClientTestLayer(fixtures)

export const makeAppClientTestRuntime = (fixtures: EntryClientFixtures) =>
  Atom.runtime(makeAppClientTestLayer(fixtures))

export const EntryClientTest = makeEntryClientTestLayer({
  run: () => Effect.succeed(runDataFixture("test run")),
  preload: () => Effect.succeed(programPreviewFixture)
})
