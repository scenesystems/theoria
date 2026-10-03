import { expect } from "@effect/vitest"
import { Effect, Option, Struct } from "effect"
import * as Arr from "effect/Array"

import { markersBeside } from "../../app/contracts/demo/imagined-place-flow.js"
import {
  allCodeSites,
  type CodeSite,
  codeSiteOf,
  composeSite,
  inferenceSite,
  layoutSite,
  mergedDigestSite,
  originDigestSite,
  type PlaceMark,
  type PlaceProvenance,
  placeSourceId,
  type PlaceStep,
  proposalDigestSite,
  proposalSignatureSite,
  sealSite,
  searchSite,
  separationSite,
  versionSignatureSite
} from "../../app/contracts/demo/imagined-place-provenance.js"
import type { PlaceBuild } from "../../app/contracts/imagined-place-result.js"
import { drawingId, frameShowing, PlaceRenderFrame } from "../../app/web/atoms/imagined-place-render.js"
import { type PlaceOnPage, provenanceFor } from "../../app/web/view/home/placeProvenance.js"
import { currentVersion, proposalAnchorLine } from "../../app/web/view/home/placeViewModel.js"
import { describeOnStage, onStage } from "../helpers/place-on-stage.js"

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

const codeLine = (step: PlaceStep, match: string): PlaceMark => ({
  _tag: "CodeLine",
  site: Option.getOrThrow(codeSiteOf(step, match)).id
})

describeOnStage("place provenance", (it) => {
  it.effect("a line of the prose is answered from the drawing on the paper, not from the arrangement the search kept", () =>
    Effect.gen(function*() {
      const { build, kept, showingKept, showingTrial, trial } = yield* Effect.service(onStage)
      expect(trial.projection.lines.length).not.toBe(kept.projection.lines.length)

      const onTrial = Option.getOrThrow(answered(
        { _tag: "Line", index: 0, drawing: drawingId(showingTrial.search) },
        page(Option.some(build), Option.some(showingTrial))
      ))
      expect(onTrial.title).toBe(`Line 1 of ${String(trial.projection.lines.length)}`)
      expect(onTrial.site).toEqual(layoutSite)
      const roomOnTrial = Option.getOrThrow(factValue(onTrial, "Room"))
      expect(roomOnTrial).toContain(`${String(trial.projection.stageWidth - 2 * trial.projection.padding)} px`)

      const onKept = Option.getOrThrow(answered(
        { _tag: "Line", index: 0, drawing: drawingId(showingKept.search) },
        page(Option.some(build), Option.some(showingKept))
      ))
      expect(onKept.title).toBe(`Line 1 of ${String(kept.projection.lines.length)}`)
    }))

  it.effect("a feature's place in the drawing is the trial on the paper, and says whether the search kept it", () =>
    Effect.gen(function*() {
      const { build, showingKept, showingTrial, trial } = yield* Effect.service(onStage)
      const drawn = Option.getOrThrow(Arr.head(trial.projection.markers))
      const mark: PlaceMark = { _tag: "Feature", name: drawn.name }

      const onTrial = Option.getOrThrow(answered(mark, page(Option.some(build), Option.some(showingTrial))))
      expect(Option.getOrThrow(factValue(onTrial, "Drawn"))).toBe(
        `Trial 1 · not kept · r ${String(Math.round(drawn.radius))} px`
      )

      const onKept = Option.getOrThrow(answered(mark, page(Option.some(build), Option.some(showingKept))))
      expect(Option.getOrThrow(factValue(onKept, "Drawn"))).toMatch(/^Trial 2 · kept · r \d+ px$/u)

      const beforeDrawn = Option.getOrThrow(answered(mark, page(Option.some(build), Option.none())))
      expect(factValue(beforeDrawn, "Drawn")).toEqual(Option.none())
    }))

  it.effect("the lines that measure the arrangement answer with the trial on the paper, each under its own package", () =>
    Effect.gen(function*() {
      const { build, showingTrial } = yield* Effect.service(onStage)
      const on = page(Option.some(build), Option.some(showingTrial))

      const scored = Option.getOrThrow(answered(codeLine("arrange", separationSite.match), on))
      expect(scored.mark).toEqual({ _tag: "Trial", index: 0, drawing: drawingId(showingTrial.search) })
      expect(scored.title).toBe("Trial 1 · not kept")
      expect(scored.site).toEqual(separationSite)
      expect(scored.site.package).toBe("effect-math")

      const recorded = Option.getOrThrow(answered(codeLine("arrange", searchSite.match), on))
      expect(recorded.mark).toEqual(scored.mark)
      expect(recorded.facts).toEqual(scored.facts)
      expect(recorded.site).toEqual(searchSite)
      expect(recorded.site.package).toBe("effect-search")
    }))

  it.effect("the layout's line answers with the first line of the drawing a disc narrows", () =>
    Effect.gen(function*() {
      const { build, showingTrial, trial } = yield* Effect.service(onStage)
      const projection = trial.projection
      const narrowed = Option.getOrThrow(Arr.findFirstIndex(
        projection.lines,
        (_, index) => Arr.isReadonlyArrayNonEmpty(markersBeside(projection, projection.markers, index))
      ))

      const laid = Option.getOrThrow(answered(
        codeLine("arrange", layoutSite.match),
        page(Option.some(build), Option.some(showingTrial))
      ))
      expect(laid.mark).toEqual({ _tag: "Line", index: narrowed, drawing: drawingId(showingTrial.search) })
      expect(laid.site).toEqual(layoutSite)
      expect(Option.getOrThrow(factValue(laid, "Room"))).toContain("beside a disc")
    }))

  it.effect("before a drawing is on the paper the build's own marks answer, and the drawing's have nothing to say", () =>
    Effect.gen(function*() {
      const { build } = yield* Effect.service(onStage)
      const on = page(Option.some(build), Option.none())
      const origin = Option.getOrThrow(Arr.head(build.evidence.lineage))
      const current = currentVersion(build.evidence)

      const digest = Option.getOrThrow(answered({ _tag: "Digest", contentId: origin.contentId }, on))
      expect(digest.title).toBe("v1 content ID")
      expect(digest.copy).toEqual(Option.some(origin.contentId))
      const signature = Option.getOrThrow(answered({ _tag: "Signature", subject: current.contentId }, on))
      expect(signature.title).toBe(`ed25519 over v${String(current.version)}`)
      expect((Option.getOrThrow(answered({ _tag: "Note" }, on))).title).toBe("Sealed note")
      expect((Option.getOrThrow(answered({ _tag: "Inference" }, on))).title).toBe("Recorded inference")

      const composed = Option.getOrThrow(answered(codeLine("compose", composeSite.match), on))
      expect(composed.title).toBe(build.artifact.composition.title)
      expect(Option.getOrThrow(factValue(composed, "Features"))).toBe(
        String(build.artifact.composition.features.length)
      )

      const drawing = { source: "blake3-256:test", stageWidth: 660 }
      expect(provenanceFor({ _tag: "Line", index: 0, drawing }, on)).toEqual(Option.none())
      expect(provenanceFor({ _tag: "Trial", index: 0, drawing }, on)).toEqual(Option.none())
      expect(provenanceFor(codeLine("arrange", layoutSite.match), on)).toEqual(Option.none())
    }))

  it.effect("a mark naming what the page does not have has no answer", () =>
    Effect.gen(function*() {
      const { build, showingTrial } = yield* Effect.service(onStage)
      const on = page(Option.some(build), Option.some(showingTrial))
      expect(provenanceFor({ _tag: "Feature", name: "Nowhere" }, on)).toEqual(Option.none())
      const drawing = drawingId(showingTrial.search)
      expect(provenanceFor({ _tag: "Trial", index: 99, drawing }, on)).toEqual(Option.none())
      expect(provenanceFor({ _tag: "Line", index: 99, drawing }, on)).toEqual(Option.none())
      expect(provenanceFor({ _tag: "Digest", contentId: "blake3-256:nothing" }, on)).toEqual(Option.none())
      expect(codeSiteOf("compose", "nothing(")).toEqual(Option.none())
    }))

  it.effect("a drawing on its way to a trial says so, and says which trial only once it has arrived", () =>
    Effect.gen(function*() {
      const { build, kept, showingTrial } = yield* Effect.service(onStage)
      const drawn = Option.getOrThrow(Arr.head(kept.projection.markers))
      const mark: PlaceMark = { _tag: "Feature", name: drawn.name }
      // The discs stand where the kept arrangement put them, heading for the first trial.
      const onTheWay = new PlaceRenderFrame(Struct.evolve(showingTrial, { rendering: () => kept }))

      const travelling = Option.getOrThrow(answered(mark, page(Option.some(build), Option.some(onTheWay))))
      expect(Option.getOrThrow(factValue(travelling, "Drawn"))).toBe(
        `Toward trial 1 · r ${String(Math.round(drawn.radius))} px`
      )

      const arrived = Option.getOrThrow(answered(mark, page(Option.some(build), Option.some(showingTrial))))
      expect(Option.getOrThrow(factValue(arrived, "Drawn"))).toMatch(/^Trial 1 · not kept · r \d+ px$/u)
    }))

  it.effect("a trial chosen from the trace is answered as itself: its discs, its lines, its loss", () =>
    Effect.gen(function*() {
      const { build, showingKept, trial } = yield* Effect.service(onStage)
      const chosen = frameShowing(showingKept, Option.some(0))
      expect(chosen.trial).toBe(0)
      const on = page(Option.some(build), Option.some(chosen))

      const drawing = drawingId(chosen.search)
      const asTrial = Option.getOrThrow(answered({ _tag: "Trial", index: 0, drawing }, on))
      expect(asTrial.title).toBe("Trial 1 · not kept")
      expect(Option.getOrThrow(factValue(asTrial, "Loss"))).toBe(trial.evidence.bestLoss.toFixed(3))

      const drawn = Option.getOrThrow(Arr.head(chosen.rendering.projection.markers))
      const asFeature = Option.getOrThrow(answered({ _tag: "Feature", name: drawn.name }, on))
      expect(Option.getOrThrow(factValue(asFeature, "Drawn"))).toBe(
        `Trial 1 · not kept · r ${String(Math.round(drawn.radius))} px`
      )

      const asLine = Option.getOrThrow(answered({ _tag: "Line", index: 0, drawing }, on))
      expect(asLine.title).toBe(`Line 1 of ${String(trial.projection.lines.length)}`)

      const scored = Option.getOrThrow(answered(codeLine("arrange", separationSite.match), on))
      expect(scored.mark).toEqual({ _tag: "Trial", index: 0, drawing })
    }))

  it.effect("every line of the code is answered by what it made, under its own package", () =>
    Effect.gen(function*() {
      const { build, showingTrial } = yield* Effect.service(onStage)
      const on = page(Option.some(build), Option.some(showingTrial))
      const neighbor = Option.getOrThrow(
        Arr.findFirst(build.proposals, (record) => record.proposal.proposer === "neighbor")
      )
      const current = currentVersion(build.evidence)
      const origin = Option.getOrThrow(Arr.head(build.evidence.lineage))
      const merged = Option.getOrThrow(Arr.get(build.evidence.lineage, 1))
      const projection = showingTrial.rendering.projection
      const narrowed = Option.getOrThrow(Arr.findFirstIndex(
        projection.lines,
        (_, index) => Arr.isReadonlyArrayNonEmpty(markersBeside(projection, projection.markers, index))
      ))
      const expected: ReadonlyArray<readonly [site: CodeSite, title: string, made: PlaceMark]> = [
        [composeSite, build.artifact.composition.title, codeLine("compose", composeSite.match)],
        [inferenceSite, "Recorded inference", { _tag: "Inference" }],
        [proposalDigestSite, "Proposal content ID", { _tag: "Digest", contentId: neighbor.contentId }],
        [proposalSignatureSite, "ed25519 over the proposal", { _tag: "Signature", subject: neighbor.contentId }],
        [sealSite, "Sealed note", { _tag: "Note" }],
        [originDigestSite, "v1 content ID", { _tag: "Digest", contentId: origin.contentId }],
        [mergedDigestSite, "v2 content ID", { _tag: "Digest", contentId: merged.contentId }],
        [versionSignatureSite, `ed25519 over v${String(current.version)}`, {
          _tag: "Signature",
          subject: current.contentId
        }],
        [layoutSite, `Line ${String(narrowed + 1)} of ${String(projection.lines.length)}`, {
          _tag: "Line",
          index: narrowed,
          drawing: drawingId(showingTrial.search)
        }],
        [separationSite, "Trial 1 · not kept", { _tag: "Trial", index: 0, drawing: drawingId(showingTrial.search) }],
        [searchSite, "Trial 1 · not kept", { _tag: "Trial", index: 0, drawing: drawingId(showingTrial.search) }]
      ]
      expect(expected.length).toBe(allCodeSites.length)
      yield* Effect.forEach(expected, ([site, title, made]) =>
        Effect.gen(function*() {
          const provenance = Option.getOrThrow(answered(codeLine(site.step, site.match), on))
          expect([site.id, provenance.title]).toEqual([site.id, title])
          expect([site.id, provenance.site]).toEqual([site.id, site])
          expect([site.id, provenance.mark]).toEqual([site.id, made])
        }))
    }))
})

describeOnStage("answers from the drawing's own source", (it) => {
  it.effect("a disc on the paper is answered from the drawing it is on, not from the build in the column", () =>
    Effect.gen(function*() {
      const { build, showingTrial, trial, other } = yield* Effect.service(onStage)
      const name = (Option.getOrThrow(Arr.head(trial.projection.markers))).name
      const on = page(Option.some(other.build), Option.some(showingTrial))
      const disc = Option.getOrThrow(answered({ _tag: "Disc", name, source: placeSourceId(build) }, on))
      expect(disc.title).toBe(name)
      expect(disc.about).toEqual([name])
      expect(Option.getOrThrow(factValue(disc, "Drawn"))).toMatch(/^Trial 1 · not kept/u)
      expect(
        (Option.getOrThrow(answered({ _tag: "Line", index: 0, drawing: drawingId(showingTrial.search) }, on))).title
      )
        .toBe(`Line 1 of ${String(trial.projection.lines.length)}`)
      expect(Option.isSome(provenanceFor({ _tag: "Trial", index: 0, drawing: drawingId(showingTrial.search) }, on)))
        .toBe(true)
      const otherName = (Option.getOrThrow(Arr.head(other.build.artifact.composition.features))).name
      const feature = Option.getOrThrow(answered({ _tag: "Feature", name: otherName }, on))
      expect(factValue(feature, "Drawn")).toEqual(Option.none())
    }))

  it.effect("a mark of a drawing no longer on the paper has no answer", () =>
    Effect.gen(function*() {
      const { build, showingKept, showingTrial, trial, other } = yield* Effect.service(onStage)
      const name = (Option.getOrThrow(Arr.head(trial.projection.markers))).name
      const onOther = page(Option.some(build), Option.some(other.showing))
      expect(provenanceFor({ _tag: "Disc", name, source: placeSourceId(build) }, onOther)).toEqual(Option.none())
      expect(provenanceFor({ _tag: "Line", index: 0, drawing: drawingId(showingTrial.search) }, onOther)).toEqual(
        Option.none()
      )
      expect(provenanceFor({ _tag: "Trial", index: 0, drawing: drawingId(showingTrial.search) }, onOther)).toEqual(
        Option.none()
      )
      expect(provenanceFor({
        _tag: "Line",
        index: 0,
        drawing: { source: placeSourceId(build), stageWidth: 320 }
      }, page(Option.some(build), Option.some(showingKept)))).toEqual(Option.none())
    }))

  it.effect("about names the features an answer is about, from the answer's own source", () =>
    Effect.gen(function*() {
      const { build, showingTrial, trial } = yield* Effect.service(onStage)
      const on = page(Option.some(build), Option.some(showingTrial))
      const name = (Option.getOrThrow(Arr.head(trial.projection.markers))).name
      const composed = Arr.map(build.artifact.composition.features, (feature) => feature.name)
      const origin = Arr.headNonEmpty(build.evidence.lineage)
      expect((Option.getOrThrow(answered({ _tag: "Disc", name, source: placeSourceId(build) }, on))).about).toEqual([
        name
      ])
      expect((Option.getOrThrow(answered({ _tag: "Inference" }, on))).about).toEqual(composed)
      expect((Option.getOrThrow(answered({ _tag: "Digest", contentId: origin.contentId }, on))).about).toEqual(composed)
      // The first line carries the composition's own opening, not a proposal's sentence.
      expect(
        (Option.getOrThrow(answered({ _tag: "Line", index: 0, drawing: drawingId(showingTrial.search) }, on))).about
      ).toEqual(
        []
      )
      expect(
        (Option.getOrThrow(answered({ _tag: "Trial", index: 0, drawing: drawingId(showingTrial.search) }, on))).about
      ).toEqual(
        []
      )
      expect((Option.getOrThrow(answered({ _tag: "Note" }, on))).about).toEqual([])
    }))

  it.effect("a line of the prose is about the merged proposal whose sentence stands on it, read from the drawing shown", () =>
    Effect.gen(function*() {
      const { build, kept, showingKept, showingTrial, trial } = yield* Effect.service(onStage)
      const neighbor = Option.getOrThrow(
        Arr.findFirst(build.proposals, (record) => record.proposal.proposer === "neighbor")
      )
      const program = Option.getOrThrow(
        Arr.findFirst(build.proposals, (record) => record.proposal.proposer === "program")
      )
      expect(neighbor.accepted).toBe(true)
      expect(program.accepted).toBe(false)

      // On the kept drawing: the line the sentence begins on names the feature; the line before it does not.
      const onKept = page(Option.some(build), Option.some(showingKept))
      const keptLine = Option.getOrThrow(proposalAnchorLine(kept.projection, neighbor))
      const standing = Option.getOrThrow(answered(
        { _tag: "Line", index: keptLine, drawing: drawingId(showingKept.search) },
        onKept
      ))
      expect(standing.about).toEqual([neighbor.proposal.feature.name])
      expect(Option.getOrThrow(factValue(standing, "Adds"))).toBe(neighbor.proposal.feature.name)
      const before = Option.getOrThrow(answered(
        { _tag: "Line", index: keptLine - 1, drawing: drawingId(showingKept.search) },
        onKept
      ))
      expect(before.about).toEqual([])
      expect(factValue(before, "Adds")).toEqual(Option.none())

      // The narrower trial reflows the prose; the sentence stands on another line, and the answer follows the drawing shown.
      const onTrial = page(Option.some(build), Option.some(showingTrial))
      const trialLine = Option.getOrThrow(proposalAnchorLine(trial.projection, neighbor))
      expect(trialLine).not.toBe(keptLine)
      const moved = Option.getOrThrow(answered(
        { _tag: "Line", index: trialLine, drawing: drawingId(showingTrial.search) },
        onTrial
      ))
      expect(moved.about).toEqual([neighbor.proposal.feature.name])
      const stale = Option.getOrThrow(
        answered({ _tag: "Line", index: keptLine, drawing: drawingId(showingTrial.search) }, onTrial)
      )
      expect(stale.about).toEqual([])

      // A declined proposal is not in the prose, so no line is about it.
      const every = yield* Effect.forEach(
        Arr.map(kept.projection.lines, (_, index) => index),
        (index) => Effect.fromOption(answered({ _tag: "Line", index, drawing: drawingId(showingKept.search) }, onKept))
      )
      expect(Arr.some(every, (line) => Arr.contains(line.about, program.proposal.feature.name))).toBe(false)
    }))
})
