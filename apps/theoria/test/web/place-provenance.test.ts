import { describe, expect, it } from "@effect/vitest"
import { Effect, Option } from "effect"
import * as Arr from "effect/Array"

import { markersBeside } from "../../app/contracts/demo/imagined-place-flow.js"
import {
  codeSiteOf,
  composeSite,
  layoutSite,
  type PlaceMark,
  type PlaceProvenance,
  type PlaceStep,
  searchSite,
  separationSite
} from "../../app/contracts/demo/imagined-place-provenance.js"
import type { PlaceBuild } from "../../app/contracts/imagined-place-result.js"
import type { PlaceRenderFrame } from "../../app/web/atoms/imagined-place-render.js"
import { type PlaceOnPage, provenanceFor } from "../../app/web/view/home/placeProvenance.js"
import { currentVersion } from "../../app/web/view/home/placeViewModel.js"
import { onStage } from "../helpers/place-on-stage.js"

/**
 * What the page answers about a mark is read from the build the server
 * returned and the drawing on the paper this instant. These are the rules
 * that reading follows, checked against a real build and two real renderings
 * of it: the kept one the search found, and a narrower trial being shown.
 */

const page = (build: Option.Option<PlaceBuild>, shown: Option.Option<PlaceRenderFrame>): PlaceOnPage => ({
  build,
  shown
})

/** The answer the page has, which the test expects it to have. */
const answered = provenanceFor

const factValue = (provenance: PlaceProvenance, label: string): Option.Option<string> =>
  Option.map(Arr.findFirst(provenance.facts, (fact) => fact.label === label), (fact) => fact.value)

const codeLine = (step: PlaceStep, match: string): PlaceMark => ({ _tag: "CodeLine", step, match })

describe("place provenance", () => {
  it.effect("a line of the prose is answered from the drawing on the paper, not from the arrangement the search kept", () =>
    Effect.gen(function*() {
      const { build, kept, showingKept, showingTrial, trial } = yield* onStage
      expect(trial.projection.lines.length).not.toBe(kept.projection.lines.length)

      const onTrial = yield* answered({ _tag: "Line", index: 0 }, page(Option.some(build), Option.some(showingTrial)))
      expect(onTrial.title).toBe(`Line 1 of ${String(trial.projection.lines.length)}`)
      expect(onTrial.site).toEqual(layoutSite)
      const roomOnTrial = yield* factValue(onTrial, "Room")
      expect(roomOnTrial).toContain(`${String(trial.projection.stageWidth - 2 * trial.projection.padding)} px`)

      const onKept = yield* answered({ _tag: "Line", index: 0 }, page(Option.some(build), Option.some(showingKept)))
      expect(onKept.title).toBe(`Line 1 of ${String(kept.projection.lines.length)}`)
    }))

  it.effect("a feature's place in the drawing is the trial on the paper, and says whether the search kept it", () =>
    Effect.gen(function*() {
      const { build, showingKept, showingTrial, trial } = yield* onStage
      const drawn = yield* Arr.head(trial.projection.markers)
      const mark: PlaceMark = { _tag: "Feature", name: drawn.name }

      const onTrial = yield* answered(mark, page(Option.some(build), Option.some(showingTrial)))
      expect(yield* factValue(onTrial, "Drawn")).toBe(`Trial 1 · not kept · r ${String(Math.round(drawn.radius))} px`)

      const onKept = yield* answered(mark, page(Option.some(build), Option.some(showingKept)))
      expect(yield* factValue(onKept, "Drawn")).toMatch(/^Trial 2 · kept · r \d+ px$/u)

      const beforeDrawn = yield* answered(mark, page(Option.some(build), Option.none()))
      expect(factValue(beforeDrawn, "Drawn")).toEqual(Option.none())
    }))

  it.effect("the lines that measure the arrangement answer with the trial on the paper, each under its own package", () =>
    Effect.gen(function*() {
      const { build, showingTrial } = yield* onStage
      const on = page(Option.some(build), Option.some(showingTrial))

      const scored = yield* answered(codeLine("arrange", separationSite.match), on)
      expect(scored.mark).toEqual({ _tag: "Trial", index: 0 })
      expect(scored.title).toBe("Trial 1 · not kept")
      expect(scored.site).toEqual(separationSite)
      expect(scored.site.package).toBe("effect-math")

      const recorded = yield* answered(codeLine("arrange", searchSite.match), on)
      expect(recorded.mark).toEqual(scored.mark)
      expect(recorded.facts).toEqual(scored.facts)
      expect(recorded.site).toEqual(searchSite)
      expect(recorded.site.package).toBe("effect-search")
    }))

  it.effect("the layout's line answers with the first line of the drawing a disc narrows", () =>
    Effect.gen(function*() {
      const { build, showingTrial, trial } = yield* onStage
      const projection = trial.projection
      const narrowed = yield* Arr.findFirstIndex(
        projection.lines,
        (_, index) => Arr.isNonEmptyReadonlyArray(markersBeside(projection, projection.markers, index))
      )

      const laid = yield* answered(
        codeLine("arrange", layoutSite.match),
        page(Option.some(build), Option.some(showingTrial))
      )
      expect(laid.mark).toEqual({ _tag: "Line", index: narrowed })
      expect(laid.site).toEqual(layoutSite)
      expect(yield* factValue(laid, "Room")).toContain("beside a disc")
    }))

  it.effect("before a drawing is on the paper the build's own marks answer, and the drawing's have nothing to say", () =>
    Effect.gen(function*() {
      const { build } = yield* onStage
      const on = page(Option.some(build), Option.none())
      const origin = yield* Arr.head(build.evidence.lineage)
      const current = yield* currentVersion(build.evidence)

      const digest = yield* answered({ _tag: "Digest", contentId: origin.contentId }, on)
      expect(digest.title).toBe("v1 content ID")
      expect(digest.copy).toEqual(Option.some(origin.contentId))
      const signature = yield* answered({ _tag: "Signature", subject: current.contentId }, on)
      expect(signature.title).toBe(`ed25519 over v${String(current.version)}`)
      expect((yield* answered({ _tag: "Note" }, on)).title).toBe("Sealed note")
      expect((yield* answered({ _tag: "Inference" }, on)).title).toBe("Recorded inference")

      const composed = yield* answered(codeLine("compose", composeSite.match), on)
      expect(composed.title).toBe(build.artifact.composition.title)
      expect(yield* factValue(composed, "Features")).toBe(String(build.artifact.composition.features.length))

      expect(provenanceFor({ _tag: "Line", index: 0 }, on)).toEqual(Option.none())
      expect(provenanceFor({ _tag: "Trial", index: 0 }, on)).toEqual(Option.none())
      expect(provenanceFor(codeLine("arrange", layoutSite.match), on)).toEqual(Option.none())
    }))

  it.effect("a mark naming what the page does not have has no answer", () =>
    Effect.gen(function*() {
      const { build, showingTrial } = yield* onStage
      const on = page(Option.some(build), Option.some(showingTrial))
      expect(provenanceFor({ _tag: "Feature", name: "Nowhere" }, on)).toEqual(Option.none())
      expect(provenanceFor({ _tag: "Trial", index: 99 }, on)).toEqual(Option.none())
      expect(provenanceFor({ _tag: "Line", index: 99 }, on)).toEqual(Option.none())
      expect(provenanceFor({ _tag: "Digest", contentId: "blake3-256:nothing" }, on)).toEqual(Option.none())
      expect(codeSiteOf("compose", "nothing(")).toEqual(Option.none())
      expect(provenanceFor(codeLine("compose", "nothing("), on)).toEqual(Option.none())
    }))
})
