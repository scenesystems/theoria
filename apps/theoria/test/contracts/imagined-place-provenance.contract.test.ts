import { describe, expect, it } from "@effect/vitest"
import { Effect, Option, String } from "effect"
import * as Arr from "effect/Array"

import {
  allCodeSites,
  codeSite,
  codeSiteOnLine,
  decodeMark,
  encodeMark,
  type PlaceMark
} from "../../app/contracts/demo/imagined-place-provenance.js"
import { placeStepDefinition } from "../../app/web/view/home/placeSteps.js"

/**
 * Every line of the samples that produced something on the page is a mark:
 * the line is found by its text, in its step's sample, and in no other.
 */
describe("the lines of code that made the place", () => {
  it.effect("each site stands on exactly one line of its own step's sample", () =>
    Effect.forEach(allCodeSites, (site) =>
      Effect.sync(() => {
        const lines = String.split(placeStepDefinition(site.step).code, "\n")
        const standing = Arr.filter(lines, (line) => Option.contains(codeSiteOnLine(site.step, line), site))
        expect([site.id, standing.length]).toEqual([site.id, 1])
        expect(codeSite(site.id)).toEqual(site)
      })))

  it.effect("a line naming no site is no mark, and a site's line is no mark in another step", () =>
    Effect.sync(() => {
      expect(codeSiteOnLine("arrange", "const width = 660")).toEqual(Option.none())
      expect(codeSiteOnLine("compose", "  yield* Study.tell(study, trial, loss)")).toEqual(Option.none())
      expect(Option.map(codeSiteOnLine("arrange", "  yield* Study.tell(study, trial, loss)"), (site) => site.id))
        .toEqual(Option.some("search"))
    }))

  it.effect("round-trips a canonical code-line mark", () =>
    Effect.sync(() => {
      const mark: PlaceMark = { _tag: "CodeLine", site: "layout" }
      expect(decodeMark(encodeMark(mark))).toEqual(Option.some(mark))
    }))
})
