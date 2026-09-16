/**
 * Renders deterministic synthetic canvas scenarios used to detect changes in
 * real canvas/Text composition. The fixed widths make no browser-accuracy claim.
 *
 * Run with `bun run packages/effect-text/examples/06-synthetic-regression-artifacts.ts`.
 */
import { BunContext, BunRuntime } from "@effect/platform-bun"
import { Data, Effect } from "effect"
import * as Arr from "effect/Array"

import { CanvasProfile } from "@scenesystems/effect-text"
import * as CanvasRegression from "./live/canvasRegression.js"

class Report extends Data.Class<{
  readonly artifact: CanvasRegression.Artifact
  readonly profile: CanvasProfile.CanvasProfile
}> {}

const renderProfile = (profile: CanvasProfile.CanvasProfile) =>
  CanvasRegression.render(profile).pipe(
    Effect.map((artifact) =>
      new Report({
        artifact,
        profile
      })
    )
  )

const program = Effect.gen(function*() {
  const reports = yield* Effect.forEach(Arr.make(CanvasProfile.monospace, CanvasProfile.systemUi), renderProfile)
  yield* Effect.log("effect-text synthetic regression results", { reports })
}).pipe(Effect.provide(BunContext.layer))

BunRuntime.runMain(program)
