import { Registry, Result } from "@effect-atom/atom"
import { Data, Effect, Record, Tuple } from "effect"
import * as Arr from "effect/Array"
import * as HashSet from "effect/HashSet"

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

/** The two builds, with the first build's trial and kept frames and the other build's complete frame. */
export const onStage = Effect.gen(function*() {
  const [build, otherBuild] = yield* Effect.all(Tuple.make(
    buildPlace(request).pipe(Effect.provide(ParticipantsLive)),
    buildPlace(otherRequest).pipe(Effect.provide(ParticipantsLive))
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
  return Data.struct({
    build,
    kept,
    trial,
    showingTrial,
    showingKept,
    other: Data.struct({ build: otherBuild, showing: otherShowing })
  })
})

/**
 * A page with `build` arrived in the column and `shown` on the paper, as the
 * page has them: held mounted, since the column and the stage render them
 * for as long as the page stands. A seeded value only stands while its node
 * does; unmounted, the node goes when the last thing reading it lets go,
 * and the next read computes the atom afresh — for the build, from the
 * network. Tasks run inline, so every derivation is settled by the time
 * `set` returns.
 */
export const pageShowing = (build: PlaceBuild, shown: PlaceRenderFrame): Registry.Registry => {
  const registry = Registry.make({
    initialValues: Tuple.make(
      Tuple.make(placeBuildAtom, Result.success(build)),
      Tuple.make(placeShownFrameAtom, Result.success(shown))
    ),
    scheduleTask: (task) => {
      task()
    }
  })
  registry.mount(placeBuildAtom)
  registry.mount(placeShownFrameAtom)
  return registry
}
