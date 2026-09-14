import { describe, expect, it } from "@effect/vitest"
import { Effect } from "effect"
import * as Arr from "effect/Array"

import { legendFromMarkers, legendFromOutline } from "../../app/web/view/home/placeViewModel.js"
import { onStage } from "../helpers/place-on-stage.js"

/**
 * The stage's marker legend is laid from the outline before the first drawing
 * and from the drawing's markers after it. The two must be the same legend —
 * the same names in the same order, each in its contributor's tone — or the
 * first frame would move what is under the stage.
 */
describe("place legend", () => {
  it.effect("the legend from the outline is the legend from the drawing's markers", () =>
    Effect.gen(function*() {
      const { build, kept } = yield* onStage
      const fromOutline = legendFromOutline(build.artifact)
      const fromMarkers = legendFromMarkers(kept.projection.markers)
      expect(fromOutline).toEqual(fromMarkers)
      expect(fromOutline.length).toBe(kept.projection.markers.length)
    }))

  it.effect("the composition's features are the author's; a merged feature keeps its proposer", () =>
    Effect.gen(function*() {
      const { build } = yield* onStage
      const legend = legendFromOutline(build.artifact)
      const own = Arr.take(legend, build.artifact.composition.features.length)
      const merged = Arr.drop(legend, build.artifact.composition.features.length)
      expect(Arr.every(own, (entry) => entry.contributedBy === "author")).toBe(true)
      expect(Arr.map(merged, (entry) => entry.contributedBy)).toEqual(
        Arr.map(build.artifact.accepted, (proposal) => proposal.proposer)
      )
      expect(merged.length).toBeGreaterThan(0)
    }))
})
