import { expect } from "@effect/vitest"
import { Effect, Number as Num, Option } from "effect"
import * as Arr from "effect/Array"

import { description } from "../../app/contracts/demo/imagined-place-arrangement.js"
import type { PlaceLine, PlaceProjection, ProposalRecord } from "../../app/contracts/imagined-place-result.js"
import { proposalAnchorLine } from "../../app/web/view/home/placeViewModel.js"
import { describeOnStage, onStage } from "../helpers/place-on-stage.js"

/**
 * The line a merged proposal's sentence begins on is where the proposal is
 * anchored beside the prose. The lines here are written by hand, with the
 * sentence broken where a narrow stage would break it, so the expectation
 * does not come from the function under test.
 */

const lines = (texts: ReadonlyArray<string>): ReadonlyArray<PlaceLine> =>
  Arr.map(texts, (text, index) => ({ text, y: Num.multiply(24, Num.increment(index)), maxWidth: 200, width: 180 }))

const projectionOf = (texts: ReadonlyArray<string>): PlaceProjection => ({
  stageWidth: 240,
  stageHeight: Num.multiply(24, Num.increment(texts.length)),
  padding: 20,
  lineHeight: 24,
  markers: [],
  lines: lines(texts)
})

const saying = (record: ProposalRecord, sentence: string, accepted: boolean): ProposalRecord => ({
  ...record,
  accepted,
  proposal: { ...record.proposal, feature: { ...record.proposal.feature, description: sentence } }
})

const arrow =
  "On the door of the building the market has just left, one arrow is chalked, pointing the way to the next."

describeOnStage("proposal anchor line", (it) => {
  it.effect("finds the sentence where it begins, even when its first words are broken across lines", () =>
    Effect.gen(function*() {
      const { build } = yield* onStage
      const merged = yield* Arr.findFirst(build.proposals, (record) => record.accepted)
      // "Once" holds the letters "On": the composition's first line must not answer for the proposal's sentence.
      const projection = projectionOf([
        "Once a month the market sets up in",
        "whatever building the town has most",
        "recently emptied. On the",
        "door of the building the market has",
        "just left, one arrow is chalked,",
        "pointing the way to the next."
      ])
      expect(proposalAnchorLine(projection, saying(merged, arrow, true))).toEqual(Option.some(2))
    }))

  it.effect("a line broken inside a word still finds the sentence", () =>
    Effect.gen(function*() {
      const { build } = yield* onStage
      const merged = yield* Arr.findFirst(build.proposals, (record) => record.accepted)
      const projection = projectionOf([
        "Once a month the market sets",
        "up in whatever building. On the do",
        "or of the building the market has",
        "just left, one arrow is chalked,",
        "pointing the way to the next."
      ])
      expect(proposalAnchorLine(projection, saying(merged, arrow, true))).toEqual(Option.some(1))
    }))

  it.effect("a sentence that is not in the prose, or a declined proposal, has no line", () =>
    Effect.gen(function*() {
      const { build } = yield* onStage
      const merged = yield* Arr.findFirst(build.proposals, (record) => record.accepted)
      const projection = projectionOf(["Once a month the market sets up.", "On the door a bell hangs."])
      expect(proposalAnchorLine(projection, saying(merged, arrow, true))).toEqual(Option.none())
      expect(proposalAnchorLine(projection, saying(merged, "On the door a bell hangs.", false))).toEqual(Option.none())
    }))

  it.effect("on a real drawing the anchored line is where the merged sentence starts in the flowed prose", () =>
    Effect.gen(function*() {
      const { build, kept, trial } = yield* onStage
      const merged = yield* Arr.findFirst(build.proposals, (record) => record.accepted)
      const prose = description(build.artifact)
      // The prose is the lines joined; the sentence starts at one offset of it, whichever width flowed the lines.
      const start = prose.indexOf(merged.proposal.feature.description)
      expect(start).toBeGreaterThan(0)
      const lineStarting = (projection: PlaceProjection): number => {
        expect(Arr.join(Arr.map(projection.lines, (line) => line.text), " ")).toBe(prose)
        // Each line's text and the space after it: the sentence starts on the first line that ends past its offset.
        const ends = Arr.drop(
          Arr.scan(projection.lines, 0, (sum, line) => Num.sumAll([sum, line.text.length, 1])),
          1
        )
        return Arr.length(Arr.filter(ends, Num.lessThanOrEqualTo(start)))
      }
      expect(proposalAnchorLine(kept.projection, merged)).toEqual(Option.some(lineStarting(kept.projection)))
      expect(proposalAnchorLine(trial.projection, merged)).toEqual(Option.some(lineStarting(trial.projection)))
    }))
})
