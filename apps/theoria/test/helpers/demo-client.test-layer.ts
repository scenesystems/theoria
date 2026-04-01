import { Effect, Layer } from "effect"

import type { DemoError } from "../../app/contracts/demo-error.js"
import type { Metadata } from "../../app/contracts/envelope.js"
import type { Id } from "../../app/contracts/id.js"
import type { ProgramPreview } from "../../app/contracts/program-preview.js"
import type { RunData } from "../../app/contracts/run.js"
import { DemoClient } from "../../app/web/services/DemoClient.js"

import { programPreviewFixture, runDataFixture } from "./demo-fixtures.js"

export type DemoClientFixtures = {
  readonly run: (id: Id) => Effect.Effect<RunData, DemoError>
  readonly runWithMeta?: (id: Id) => Effect.Effect<{ readonly data: RunData; readonly meta: Metadata }, DemoError>
  readonly preload: (id: Id) => Effect.Effect<ProgramPreview, DemoError>
  readonly streamUrl?: (id: Id, customText?: string | null) => string
}

export const makeDemoClientTestLayer = (fixtures: DemoClientFixtures): Layer.Layer<DemoClient> =>
  Layer.succeed(
    DemoClient,
    DemoClient.make({
      run: fixtures.run,
      runWithMeta: fixtures.runWithMeta ?? ((id) =>
        fixtures.run(id).pipe(
          Effect.map((data) => ({
            data,
            meta: {
              requestId: `req-${id}`,
              buildSha: "test-build",
              durationMs: data.durationMs
            }
          }))
        )),
      preload: fixtures.preload,
      streamUrl: fixtures.streamUrl ?? ((id) => `/api/demos/${id}/stream`)
    })
  )

export const DemoClientTest = makeDemoClientTestLayer({
  run: () => Effect.succeed(runDataFixture("test run")),
  preload: () => Effect.succeed(programPreviewFixture)
})
