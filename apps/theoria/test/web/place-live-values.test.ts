import { Registry } from "@effect-atom/atom"
import { describe, expect, it } from "@effect/vitest"
import { Effect, Equal, Inspectable, Option, Struct, Tuple } from "effect"
import * as Arr from "effect/Array"
import * as Num from "effect/Number"
import * as Str from "effect/String"

import {
  layoutSite,
  proposalSignatureSite,
  versionSignatureSite
} from "../../app/contracts/demo/imagined-place-provenance.js"
import { PlaceRendering, RenderEvidence } from "../../app/contracts/imagined-place-result.js"
import { PlaceSearch, placeShownGeometryAtom, shownGeometry } from "../../app/web/atoms/imagined-place-render.js"
import { placeLiveValues } from "../../app/web/view/home/placeLiveValues.js"
import { provenanceFor } from "../../app/web/view/home/placeProvenance.js"
import { currentVersion, fixedDecimal, signatureFor, signatureLabel } from "../../app/web/view/home/placeViewModel.js"
import type { CodeAnnotation } from "../../app/web/view/primitives/code/CodeLine.js"
import { onStage, pageShowing } from "../helpers/place-on-stage.js"

/**
 * The values beside the Arrange code describe the drawing on the stage —
 * the one the reader sees and the one their press is answered from — not
 * the best the search has found, which may be a different drawing while a
 * trial is chosen from the trace or the discs are still on their way.
 */

const valueOf = (annotations: Iterable<CodeAnnotation>, match: string) =>
  Arr.findFirst(annotations, (annotation) => Equal.equals(annotation.match, match)).pipe(
    Option.map((found) => found.text)
  )

describe("place live values", () => {
  it.effect("formats stage positions and losses with rounding and retained decimal places", () =>
    Effect.forEach(
      Arr.make(
        Tuple.make(120, 1, "120.0"),
        Tuple.make(1.51956, 3, "1.520"),
        Tuple.make(0.00049, 3, "0.000"),
        Tuple.make(0.00051, 3, "0.001"),
        Tuple.make(14.125, 2, "14.13"),
        Tuple.make(1e16, 3, "10000000000000000.000")
      ),
      ([value, places, expected]) => Effect.sync(() => expect(fixedDecimal(value, places)).toBe(expected))
    ))

  it.effect("keeps proposal and version signatures attached to their own signing steps", () =>
    Effect.gen(function*() {
      const { build } = yield* onStage
      const neighbor = yield* Arr.findFirst(
        build.proposals,
        (record) => Equal.equals(record.proposal.proposer, "neighbor")
      )
      const versionSignature = yield* signatureFor(
        build.evidence.signatures,
        currentVersion(build.evidence).contentId
      )
      const proposalValues = placeLiveValues("propose", Option.some(build), Option.none(), Option.none())
      const recordValues = placeLiveValues("record", Option.some(build), Option.none(), Option.none())

      expect(valueOf(proposalValues, proposalSignatureSite.match)).toEqual(
        Option.some(signatureLabel(neighbor.signature))
      )
      expect(valueOf(recordValues, versionSignatureSite.match)).toEqual(Option.some(signatureLabel(versionSignature)))
    }))

  it.effect("say the lines and separation of the trial chosen, not of the best", () =>
    Effect.gen(function*() {
      const { build, kept, showingTrial, trial } = yield* onStage
      expect(trial.evidence.lineCount).not.toBe(kept.evidence.lineCount)
      const search = new PlaceSearch(Struct.evolve(showingTrial.search, {
        best: (best) =>
          PlaceRendering.make(Struct.evolve(best, {
            evidence: (evidence) =>
              RenderEvidence.make(Struct.evolve(evidence, {
                trials: () => 7,
                bestLoss: () => 1.51956
              }))
          }))
      }))
      const values = placeLiveValues(
        "arrange",
        Option.some(build),
        Option.some(search),
        Option.some(shownGeometry(showingTrial))
      )
      expect(valueOf(values, "Text.layoutLinesWith(")).toEqual(
        Option.some(
          `${Inspectable.toStringUnknown(trial.evidence.lineCount)} lines at ${
            Inspectable.toStringUnknown(trial.projection.stageWidth)
          } px`
        )
      )
      expect(valueOf(values, "Statistics.minimum(")).toEqual(
        Option.some(
          `closest markers ${
            Inspectable.toStringUnknown(Num.round(Num.multiply(trial.evidence.minimumSeparation, 100), 0))
          }% of width apart`
        )
      )
      // The search line still says where the search stands.
      expect(valueOf(values, "Optimization.tell(")).toEqual(
        Option.some("7 tried · best loss 1.520")
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
        Option.some(
          `${Inspectable.toStringUnknown(lines)} lines at ${
            Inspectable.toStringUnknown(showingTrial.rendering.projection.stageWidth)
          } px`
        )
      )
      // The press is answered with a line of that same drawing, out of that same count.
      expect(answer.title).toMatch(/^Line \d+ of \d+$/u)
      expect(Str.endsWith(` of ${Inspectable.toStringUnknown(lines)}`)(answer.title)).toBe(true)
    }))

  it.effect("are the same value from one frame to the next while the drawing has not changed", () =>
    Effect.gen(function*() {
      const { showingKept, showingTrial } = yield* onStage
      expect(Equal.equals(shownGeometry(showingKept), shownGeometry(Struct.evolve(showingKept, { paper: () => 0 }))))
        .toBe(true)
      expect(Equal.equals(shownGeometry(showingKept), shownGeometry(showingTrial))).toBe(false)
    }))

  it.effect("are absent before anything is drawn", () =>
    Effect.gen(function*() {
      const { build, showingTrial } = yield* onStage
      expect(placeLiveValues("arrange", Option.some(build), Option.some(showingTrial.search), Option.none())).toEqual(
        Arr.empty()
      )
      const registry = Registry.make()
      expect(registry.get(placeShownGeometryAtom)).toEqual(Option.none())
    }))
})
