import { describe, expect, it } from "@effect/vitest"
import { Effect, Option } from "effect"
import * as Arr from "effect/Array"
import * as HashSet from "effect/HashSet"

import { discDrawn, PlaceRenderFrame, PlaceSearch } from "../../app/web/atoms/imagined-place-render.js"
import { onStage } from "../helpers/place-on-stage.js"

/**
 * How each disc of a frame is drawn is told from that frame — the one the
 * stage shows — so a disc whose feature has left the place is told it is
 * leaving, and shrinks with the drawing, rather than being told from a later
 * frame it is not in. A story change is the case that has every kind at
 * once: the old story's discs still stand, verbatim, while its lines leave,
 * and the new story's search is heading for features none of them are.
 */

const names = (frame: PlaceRenderFrame) => Arr.map(frame.rendering.projection.markers, (marker) => marker.name)

/** The first feature drawn in the frame; every place drawn has one. */
const firstName = (frame: PlaceRenderFrame): string => Option.getOrThrow(Arr.head(names(frame)))

describe("how a disc is drawn, told from the frame it stands in", () => {
  it.effect("a disc of a feature the search is not heading for is leaving; one it is making room for is arriving; one it has settled stays", () =>
    Effect.gen(function*() {
      const { other, showingKept } = yield* onStage
      // The new story's search, just begun: the drawing rests as the old story left it.
      const search = new PlaceSearch({
        ...other.showing.search,
        phase: "running",
        settled: HashSet.fromIterable(names(showingKept))
      })
      const resting = new PlaceRenderFrame({ ...showingKept, search })
      const oldName = firstName(showingKept)
      const newName = firstName(other.showing)
      expect(Arr.contains(names(other.showing), oldName)).toBe(false)
      expect(discDrawn("sketch", Option.some(resting), oldName)).toBe("leaving")
      // The new features are drawn once the travel begins, as rings, until the search settles.
      const travelling = new PlaceRenderFrame({ ...other.showing, search })
      expect(discDrawn("sketch", Option.some(travelling), newName)).toBe("arriving")
      // A feature the last settled drawing drew, and the search draws again, stays a disc.
      const settledAgain = new PlaceSearch({ ...search, settled: HashSet.fromIterable(names(other.showing)) })
      expect(
        discDrawn("sketch", Option.some(new PlaceRenderFrame({ ...other.showing, search: settledAgain })), newName)
      )
        .toBe("settled")
    }))

  it.effect("a kept drawing's discs are settled and a scrubbed trial's are placed outright, whatever the frame; before a frame every disc is settled", () =>
    Effect.gen(function*() {
      const { showingKept, showingTrial } = yield* onStage
      const name = firstName(showingKept)
      expect(discDrawn("kept", Option.some(showingKept), name)).toBe("settled")
      expect(discDrawn("trial", Option.some(showingTrial), name)).toBe("trial")
      expect(discDrawn("trial", Option.none(), name)).toBe("trial")
      expect(discDrawn("sketch", Option.none(), name)).toBe("settled")
    }))
})
