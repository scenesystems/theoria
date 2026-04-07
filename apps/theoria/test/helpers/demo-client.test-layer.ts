import { Atom } from "@effect-atom/atom"
import { Effect, Layer } from "effect"

import { type DemoError, DemoRequestError } from "../../app/contracts/demo-error.js"
import type { Metadata } from "../../app/contracts/envelope.js"
import type { Id } from "../../app/contracts/id.js"
import type { ProgramPreview } from "../../app/contracts/program-preview.js"
import type { RunData } from "../../app/contracts/run.js"
import { DemoClient } from "../../app/web/services/DemoClient.js"
import { WorkflowComparisonClient } from "../../app/web/services/WorkflowComparisonClient.js"

import { programPreviewFixture, runDataFixture } from "./demo-fixtures.js"

export type DemoClientFixtures = {
  readonly run: (id: Id) => Effect.Effect<RunData, DemoError>
  readonly runWithMeta?: (id: Id) => Effect.Effect<{ readonly data: RunData; readonly meta: Metadata }, DemoError>
  readonly preload: (id: Id) => Effect.Effect<ProgramPreview, DemoError>
  readonly streamUrl?: (id: Id, manifest?: string | null, runToken?: string | null) => string
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
      versions: () => Effect.succeed({}),
      streamUrl: fixtures.streamUrl ?? ((id) => `/api/demos/${id}/stream`)
    })
  )

export const WorkflowComparisonClientTest = Layer.succeed(
  WorkflowComparisonClient,
  WorkflowComparisonClient.make({
    run: () => Effect.fail(new DemoRequestError({ message: "unused workflow-comparison run" })),
    runWithMeta: () => Effect.fail(new DemoRequestError({ message: "unused workflow-comparison run" })),
    streamUrl: (plan, runToken = null) => {
      const params = new URLSearchParams({
        comparisonId: plan.comparisonId,
        lane: plan.lane,
        optimize: `${plan.optimize}`,
        comparisonMode: plan.comparisonMode,
        runtimeProfile: plan.runtimeProfile,
        surfaceProfile: plan.surfaceProfile
      })

      if (runToken !== null && runToken.trim().length > 0) {
        params.set("runToken", runToken.trim())
      }

      return `/api/workflow-comparison/stream?${params.toString()}`
    }
  })
)

export const makeAppClientTestLayer = (fixtures: DemoClientFixtures) =>
  Layer.merge(makeDemoClientTestLayer(fixtures), WorkflowComparisonClientTest)

export const makeAppClientTestRuntime = (fixtures: DemoClientFixtures) => Atom.runtime(makeAppClientTestLayer(fixtures))

export const DemoClientTest = makeDemoClientTestLayer({
  run: () => Effect.succeed(runDataFixture("test run")),
  preload: () => Effect.succeed(programPreviewFixture)
})
