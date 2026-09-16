import { describe, expect, it } from "@effect/vitest"
import { Effect, Option } from "effect"

import {
  codeSiteOnLine,
  decodeMark,
  encodeMark,
  type PlaceMark
} from "../../app/contracts/demo/imagined-place-provenance.js"

describe("the lines of code that made the place", () => {
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
