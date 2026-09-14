import { Registry } from "@effect-atom/atom"
import { describe, expect, it } from "@effect/vitest"
import { Effect, Equal, Option } from "effect"
import * as Arr from "effect/Array"

import { layoutSite } from "../../app/contracts/demo/imagined-place-provenance.js"
import { placeShownGeometryAtom, shownGeometry } from "../../app/web/atoms/imagined-place-render.js"
import { placeLiveValues } from "../../app/web/view/home/placeLiveValues.js"
import { provenanceFor } from "../../app/web/view/home/placeProvenance.js"
import { onStage, pageShowing } from "../helpers/place-on-stage.js"

/**
 * The values beside the Arrange code describe the drawing on the stage —
 * the one the reader sees and the one their press is answered from — not
 * the best the search has found, which may be a different drawing while a
 * trial is chosen from the trace or the discs are still on their way.
 */

const valueOf = (annotations: ReadonlyArray<{ readonly match: string; readonly text: string }>, match: string) =>
  Arr.findFirst(annotations, (annotation) => annotation.match === match).pipe(Option.map((found) => found.text))

describe("Arrange's live values", () => {
  it.effect("say the lines and separation of the trial chosen, not of the best", () =>
    Effect.gen(function*() {
      const { build, kept, showingTrial, trial } = yield* onStage
      expect(trial.evidence.lineCount).not.toBe(kept.evidence.lineCount)
      const values = placeLiveValues(
        "arrange",
        Option.some(build),
        Option.some(showingTrial.search),
        Option.some(shownGeometry(showingTrial))
      )
      expect(valueOf(values, "Text.layoutLinesWith(")).toEqual(
        Option.some(`${String(trial.evidence.lineCount)} lines at ${String(trial.projection.stageWidth)} px`)
      )
      expect(valueOf(values, "Statistics.minimum(")).toEqual(
        Option.some(`closest markers ${String(Math.round(trial.evidence.minimumSeparation * 100))}% of width apart`)
      )
      // The search line still says where the search stands.
      expect(valueOf(values, "Study.tell(")).toEqual(
        Option.some(`${String(kept.evidence.trials)} tried · best loss ${kept.evidence.bestLoss.toFixed(3)}`)
      )
    }))

  it.effect("agree with what a press on the layout line is answered with", () =>
    Effect.gen(function*() {
      const { build, showingTrial } = yield* onStage
      const registry = pageShowing(build, showingTrial)
      const shown = registry.get(placeShownGeometryAtom)
      const values = placeLiveValues("arrange", Option.some(build), Option.some(showingTrial.search), shown)
      const answer = yield* provenanceFor(
        { _tag: "CodeLine", site: layoutSite.id },
        { build: Option.some(build), shown: Option.some(showingTrial) }
      )
      const lines = yield* Option.map(shown, (geometry) => geometry.lineCount)
      expect(valueOf(values, "Text.layoutLinesWith(")).toEqual(
        Option.some(`${String(lines)} lines at ${String(showingTrial.rendering.projection.stageWidth)} px`)
      )
      // The press is answered with a line of that same drawing, out of that same count.
      expect(answer.title).toMatch(new RegExp(`^Line \\d+ of ${String(lines)}$`, "u"))
    }))

  it.effect("are the same value from one frame to the next while the drawing has not changed", () =>
    Effect.gen(function*() {
      const { showingKept, showingTrial } = yield* onStage
      expect(Equal.equals(shownGeometry(showingKept), shownGeometry({ ...showingKept, paper: 0 }))).toBe(true)
      expect(Equal.equals(shownGeometry(showingKept), shownGeometry(showingTrial))).toBe(false)
    }))

  it.effect("are absent before anything is drawn", () =>
    Effect.gen(function*() {
      const { build, showingTrial } = yield* onStage
      expect(placeLiveValues("arrange", Option.some(build), Option.some(showingTrial.search), Option.none())).toEqual(
        []
      )
      const registry = Registry.make()
      expect(registry.get(placeShownGeometryAtom)).toEqual(Option.none())
    }))
})
