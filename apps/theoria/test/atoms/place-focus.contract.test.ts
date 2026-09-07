import { Registry, Result } from "@effect-atom/atom"
import { describe, expect, it } from "@effect/vitest"
import { Effect, Option } from "effect"
import * as Arr from "effect/Array"

import {
  type CodeSite,
  composeSite,
  encodeMark,
  layoutSite,
  type PlaceMark,
  proposalDigestSite,
  separationSite
} from "../../app/contracts/demo/imagined-place-provenance.js"
import type { PlaceBuild } from "../../app/contracts/imagined-place-result.js"
import {
  placeAnsweredMarkAtom,
  placeFeatureFocusedAtom,
  placeFocusAtom,
  placeFocusedLineAtom,
  placeMarkFocusedAtom
} from "../../app/web/atoms/imagined-place-experience.js"
import {
  placeProposalLineAtom,
  type PlaceRenderFrame,
  placeShownFrameAtom
} from "../../app/web/atoms/imagined-place-render.js"
import { placeBuildAtom } from "../../app/web/atoms/imagined-place.js"
import { proposalAnchorLine } from "../../app/web/view/home/placeViewModel.js"
import { onStage } from "../helpers/place-on-stage.js"

/**
 * One mark is pointed at; everything the overlay's answer is about lights
 * where it stands — a disc, a line of the prose, the line of code — from
 * whichever end the visitor starts. These are the rules of that lighting,
 * read from the atoms alone, with a real build and drawing on the page.
 */

/** A registry with the build arrived and the frame on the paper, as the page has them. */
const pageShowing = (build: PlaceBuild, shown: PlaceRenderFrame): Registry.Registry =>
  Registry.make({
    initialValues: [
      [placeBuildAtom, Result.success(build)],
      [placeShownFrameAtom, Result.success(shown)]
    ],
    scheduleTask: (task) => {
      task()
    }
  })

const lit = (registry: Registry.Registry, mark: PlaceMark): boolean =>
  registry.get(placeMarkFocusedAtom(encodeMark(mark)))

const line = (index: number): PlaceMark => ({ _tag: "Line", index })

const codeLineAt = (site: CodeSite): PlaceMark => ({ _tag: "CodeLine", step: site.step, match: site.match })

describe("place focus", () => {
  it.effect("nothing pointed at lights nothing", () =>
    Effect.gen(function*() {
      const { build, showingTrial } = yield* onStage
      const registry = pageShowing(build, showingTrial)
      expect(registry.get(placeAnsweredMarkAtom)).toEqual(Option.none())
      expect(registry.get(placeFocusedLineAtom)).toEqual(Option.none())
      expect(lit(registry, line(0))).toBe(false)
      expect(Arr.some(showingTrial.rendering.projection.markers, (marker) =>
        lit(registry, { _tag: "Feature", name: marker.name })))
        .toBe(false)
    }))

  it.effect("a merged proposal's feature, pointed at, lights its disc and the line its sentence stands on", () =>
    Effect.gen(function*() {
      const { build, showingTrial } = yield* onStage
      const registry = pageShowing(build, showingTrial)
      const merged = yield* Arr.findFirst(build.proposals, (record) => record.accepted)
      const anchored = yield* proposalAnchorLine(showingTrial.rendering.projection, merged)
      const feature: PlaceMark = { _tag: "Feature", name: merged.proposal.feature.name }

      registry.set(placeFocusAtom, Option.some(feature))
      expect(registry.get(placeAnsweredMarkAtom)).toEqual(Option.some(feature))
      expect(lit(registry, feature)).toBe(true)
      expect(registry.get(placeFocusedLineAtom)).toEqual(Option.some(anchored))
      expect(lit(registry, line(anchored))).toBe(true)
      expect(lit(registry, line(anchored + 1))).toBe(false)
      // And the line of code that made the proposal's identity, in the panel.
      expect(lit(registry, codeLineAt(proposalDigestSite))).toBe(true)
      expect(lit(registry, codeLineAt(layoutSite))).toBe(false)
      // The other features stand unlit.
      const others = Arr.filter(build.artifact.composition.features, (other) => other.name !== feature.name)
      expect(Arr.some(others, (other) => lit(registry, { _tag: "Feature", name: other.name }))).toBe(false)
    }))

  it.effect("the composing line, pointed at, lights every feature it composed and no line of the prose", () =>
    Effect.gen(function*() {
      const { build, showingTrial } = yield* onStage
      const registry = pageShowing(build, showingTrial)
      const composing = codeLineAt(composeSite)

      registry.set(placeFocusAtom, Option.some(composing))
      expect(registry.get(placeAnsweredMarkAtom)).toEqual(Option.some(composing))
      expect(lit(registry, composing)).toBe(true)
      expect(
        Arr.every(build.artifact.composition.features, (feature) => registry.get(placeFeatureFocusedAtom(feature.name)))
      ).toBe(true)
      expect(registry.get(placeFocusedLineAtom)).toEqual(Option.none())
    }))

  it.effect("the layout's line, pointed at, lights the first narrowed line of the drawing on the paper", () =>
    Effect.gen(function*() {
      const { build, showingTrial } = yield* onStage
      const registry = pageShowing(build, showingTrial)
      const laying = codeLineAt(layoutSite)

      registry.set(placeFocusAtom, Option.some(laying))
      const answered = yield* registry.get(placeAnsweredMarkAtom)
      expect(answered._tag).toBe("Line")
      const index = yield* registry.get(placeFocusedLineAtom)
      expect(answered).toEqual(line(index))
      expect(lit(registry, line(index))).toBe(true)
      expect(lit(registry, laying)).toBe(true)
    }))

  it.effect("a line of the prose, pointed at, lights the layout's line of code, and only that one", () =>
    Effect.gen(function*() {
      const { build, showingTrial } = yield* onStage
      const registry = pageShowing(build, showingTrial)
      registry.set(placeFocusAtom, Option.some(line(2)))
      expect(lit(registry, line(2))).toBe(true)
      expect(lit(registry, codeLineAt(layoutSite))).toBe(true)
      expect(lit(registry, codeLineAt(separationSite))).toBe(false)
      expect(lit(registry, codeLineAt(composeSite))).toBe(false)
    }))

  it.effect("the scoring line, pointed at, lights the trial on the paper and nothing of the prose", () =>
    Effect.gen(function*() {
      const { build, showingTrial } = yield* onStage
      const registry = pageShowing(build, showingTrial)
      const scoring = codeLineAt(separationSite)
      const trial: PlaceMark = { _tag: "Trial", index: showingTrial.trial }

      registry.set(placeFocusAtom, Option.some(scoring))
      expect(registry.get(placeAnsweredMarkAtom)).toEqual(Option.some(trial))
      expect(lit(registry, trial)).toBe(true)
      expect(lit(registry, scoring)).toBe(true)
      expect(lit(registry, { _tag: "Trial", index: showingTrial.search.bestIndex })).toBe(false)
      expect(registry.get(placeFocusedLineAtom)).toEqual(Option.none())
      expect(
        Arr.some(build.artifact.composition.features, (feature) => registry.get(placeFeatureFocusedAtom(feature.name)))
      ).toBe(false)
    }))

  it.effect("what is lit follows the drawing: the same feature stands on another line of another trial", () =>
    Effect.gen(function*() {
      const { build, showingKept, showingTrial } = yield* onStage
      const merged = yield* Arr.findFirst(build.proposals, (record) => record.accepted)
      const feature: PlaceMark = { _tag: "Feature", name: merged.proposal.feature.name }
      const onTrial = pageShowing(build, showingTrial)
      const onKept = pageShowing(build, showingKept)
      onTrial.set(placeFocusAtom, Option.some(feature))
      onKept.set(placeFocusAtom, Option.some(feature))

      expect(onTrial.get(placeFocusedLineAtom)).toEqual(
        proposalAnchorLine(showingTrial.rendering.projection, merged)
      )
      expect(onKept.get(placeFocusedLineAtom)).toEqual(
        proposalAnchorLine(showingKept.rendering.projection, merged)
      )
      expect(onTrial.get(placeFocusedLineAtom)).not.toEqual(onKept.get(placeFocusedLineAtom))
    }))

  it.effect("a proposal's sentence is anchored on the line it stands on in the drawing shown, a chosen trial included", () =>
    Effect.gen(function*() {
      const { build, showingKept, showingTrial } = yield* onStage
      const merged = yield* Arr.findFirst(build.proposals, (record) => record.accepted)
      const onKept = pageShowing(build, showingKept)
      expect(onKept.get(placeProposalLineAtom(merged.proposal.proposer))).toEqual(
        proposalAnchorLine(showingKept.rendering.projection, merged)
      )
      const onTrial = pageShowing(build, showingTrial)
      expect(onTrial.get(placeProposalLineAtom(merged.proposal.proposer))).toEqual(
        proposalAnchorLine(showingTrial.rendering.projection, merged)
      )
      expect(onTrial.get(placeProposalLineAtom(merged.proposal.proposer))).not.toEqual(
        onKept.get(placeProposalLineAtom(merged.proposal.proposer))
      )
    }))
})
