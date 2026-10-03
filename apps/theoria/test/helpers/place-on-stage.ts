import { layer } from "@effect/vitest"
import { Cipher } from "@scenesystems/seal"
import { Context, Effect, Layer, Record, Tuple } from "effect"
import * as Arr from "effect/Array"
import * as HashSet from "effect/HashSet"
import { AsyncResult as Result, AtomRegistry as Registry } from "effect/reactivity"

import { Arrangement } from "../../app/contracts/demo/imagined-place-arrangement.js"
import { stageFor } from "../../app/contracts/demo/imagined-place-flow.js"
import type { PlaceBuild, PlaceRendering } from "../../app/contracts/imagined-place-result.js"
import { PlaceBuildRequest } from "../../app/contracts/imagined-place.js"
import { ParticipantsLive } from "../../app/server/imagined-place/authority.js"
import { render } from "../../app/server/imagined-place/render.js"
import { buildPlace } from "../../app/server/imagined-place/run.js"
import { scenarioById } from "../../app/server/imagined-place/scenarios.js"
import { PlaceRenderFrame, PlaceSearch, placeShownFrameAtom } from "../../app/web/atoms/imagined-place-render.js"
import { placeBuildAtom } from "../../app/web/atoms/imagined-place.js"

/**
 * A place as the page has it: a real build from the server's own programs,
 * and two real renderings of it — the wide one the search kept, and a
 * narrower trial — so what the page derives from them is checked against
 * the thing itself, not a sketch of it.
 */

const request = PlaceBuildRequest.make({
  scenario: "unfinished-light",
  brief: scenarioById("unfinished-light").brief,
  acceptNeighbor: true,
  acceptProgram: false
})

const otherRequest = PlaceBuildRequest.make({
  scenario: "lost-market",
  brief: scenarioById("lost-market").brief,
  acceptNeighbor: true,
  acceptProgram: false
})

const arrangementOf = (rendering: PlaceRendering) =>
  Arrangement.make({
    markers: rendering.projection.markers,
    lines: rendering.projection.lines,
    quality: {
      loss: rendering.evidence.bestLoss,
      lineCount: rendering.evidence.lineCount,
      narrowestLine: rendering.evidence.narrowestLine,
      raggedness: rendering.evidence.raggedness
    }
  })

const makeOnStage = Effect.gen(function*() {
  const [build, otherBuild] = yield* Effect.all(Tuple.make(
    buildPlace(request).pipe(Effect.provide([ParticipantsLive, Cipher.layer])),
    buildPlace(otherRequest).pipe(Effect.provide([ParticipantsLive, Cipher.layer]))
  ))
  const kept = yield* render(build.artifact, 660)
  const trial = yield* render(build.artifact, 320)
  const otherRendering = yield* render(otherBuild.artifact, 660)
  const search = new PlaceSearch({
    source: build,
    phase: "complete",
    stage: stageFor(660),
    tried: Arr.make(arrangementOf(trial), arrangementOf(kept)),
    bestIndex: 1,
    best: kept,
    prose: Arr.join(Arr.map(kept.projection.lines, (line) => line.text), " "),
    labels: Record.empty(),
    settled: HashSet.empty()
  })
  const showingTrial = new PlaceRenderFrame({ search, trial: 0, rendering: trial, paper: trial.projection.stageHeight })
  const showingKept = new PlaceRenderFrame({ search, trial: 1, rendering: kept, paper: kept.projection.stageHeight })
  const otherSearch = new PlaceSearch({
    source: otherBuild,
    phase: "complete",
    stage: stageFor(660),
    tried: Arr.of(arrangementOf(otherRendering)),
    bestIndex: 0,
    best: otherRendering,
    prose: Arr.join(Arr.map(otherRendering.projection.lines, (line) => line.text), " "),
    labels: Record.empty(),
    settled: HashSet.empty()
  })
  const otherShowing = new PlaceRenderFrame({
    search: otherSearch,
    trial: 0,
    rendering: otherRendering,
    paper: otherRendering.projection.stageHeight
  })
  return {
    build,
    kept,
    trial,
    showingTrial,
    showingKept,
    other: { build: otherBuild, showing: otherShowing }
  }
})

/** The two builds, with the first build's trial and kept frames and the other build's complete frame. */
export class onStage
  extends Context.Service<onStage, Effect.Success<typeof makeOnStage>>()("@theoria/test/helpers/PlaceOnStage")
{}

/**
 * Builds the immutable fixture once per test suite, not once per assertion.
 * Tests still create their own registries; no atom state or live services are shared.
 * The setup runs three full rendering searches, so it has a one-minute hook
 * budget. Individual assertions keep the normal test timeout.
 */
export const describeOnStage = layer(Layer.effect(onStage, makeOnStage), { timeout: "1 minute" })

/**
 * A page with `build` arrived in the column and `shown` on the paper, as the
 * page has them: held mounted, since the column and the stage render them
 * for as long as the page stands. A seeded value only stands while its node
 * does; unmounted, the node goes when the last thing reading it lets go,
 * and the next read computes the atom afresh — for the build, from the
 * network. Callers await scheduled derivations before reading their results.
 */
export const pageShowing = (build: PlaceBuild, shown: PlaceRenderFrame): Registry.AtomRegistry => {
  const registry = Registry.make({
    initialValues: Tuple.make(
      Tuple.make(placeBuildAtom, Result.success(build)),
      Tuple.make(placeShownFrameAtom, Result.success(shown))
    )
  })
  registry.mount(placeBuildAtom)
  registry.mount(placeShownFrameAtom)
  return registry
}
