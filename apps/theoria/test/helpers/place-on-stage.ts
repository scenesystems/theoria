import { Effect } from "effect"
import * as Arr from "effect/Array"
import * as HashSet from "effect/HashSet"

import { stageFor } from "../../app/contracts/demo/imagined-place-flow.js"
import type { PlaceRendering } from "../../app/contracts/imagined-place-result.js"
import type { PlaceBuildRequest } from "../../app/contracts/imagined-place.js"
import { ParticipantsLive } from "../../app/server/imagined-place/authority.js"
import { render } from "../../app/server/imagined-place/render.js"
import { buildPlace } from "../../app/server/imagined-place/run.js"
import { scenarioById } from "../../app/server/imagined-place/scenarios.js"
import { PlaceRenderFrame, PlaceSearch } from "../../app/web/atoms/imagined-place-render.js"

/**
 * A place as the page has it: a real build from the server's own programs,
 * and two real renderings of it — the wide one the search kept, and a
 * narrower trial — so what the page derives from them is checked against
 * the thing itself, not a sketch of it.
 */

const request: PlaceBuildRequest = {
  scenario: "unfinished-light",
  brief: scenarioById("unfinished-light").brief,
  acceptNeighbor: true,
  acceptProgram: false
}

const arrangementOf = (rendering: PlaceRendering) => ({
  markers: rendering.projection.markers,
  lines: rendering.projection.lines,
  quality: {
    loss: rendering.evidence.bestLoss,
    lineCount: rendering.evidence.lineCount,
    narrowestLine: rendering.evidence.narrowestLine,
    raggedness: rendering.evidence.raggedness
  }
})

/** The build; a search that kept the wide rendering after trying a narrow one; a frame showing either. */
export const onStage = Effect.gen(function*() {
  const build = yield* buildPlace(request).pipe(Effect.provide(ParticipantsLive))
  const kept = yield* render(build.artifact, 660)
  const trial = yield* render(build.artifact, 320)
  const search = new PlaceSearch({
    phase: "complete",
    stage: stageFor(660),
    tried: [arrangementOf(trial), arrangementOf(kept)],
    bestIndex: 1,
    best: kept,
    prose: Arr.join(Arr.map(kept.projection.lines, (line) => line.text), " "),
    labels: {},
    settled: HashSet.empty()
  })
  const showingTrial = new PlaceRenderFrame({ search, trial: 0, rendering: trial, paper: trial.projection.stageHeight })
  const showingKept = new PlaceRenderFrame({ search, trial: 1, rendering: kept, paper: kept.projection.stageHeight })
  return { build, kept, trial, showingTrial, showingKept }
})
