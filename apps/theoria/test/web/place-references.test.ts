import { describe, expect, it } from "@effect/vitest"
import { Effect, Option } from "effect"
import * as Arr from "effect/Array"

import { placeLiveValues } from "../../app/web/view/home/placeLiveValues.js"
import { placeReferences, referenceLinks, sourceUrl } from "../../app/web/view/home/placeReferences.js"
import { placeStepDefinition, placeSteps } from "../../app/web/view/home/placeSteps.js"
import { segmentLine } from "../../app/web/view/primitives/code/codeLinks.js"
import { highlightCode, makeSyntaxHighlighter } from "../../app/web/view/primitives/code/highlighter.js"

describe("How it's built references", () => {
  it.effect("every reference is linked at least once in its step's highlighted code", () =>
    Effect.scoped(
      Effect.gen(function*() {
        const highlighter = yield* makeSyntaxHighlighter
        Arr.forEach(placeSteps, (step) => {
          const lines = highlightCode(highlighter, placeStepDefinition(step).code, "typescript")
          const linked = Arr.flatMap(lines, (line) =>
            Arr.filterMap(
              segmentLine(line, referenceLinks(step)),
              (segment) => segment._tag === "Link" ? Option.some(segment.link.text) : Option.none()
            ))
          Arr.forEach(placeReferences(step), (reference) => {
            expect(linked, `${step}: ${reference.text}`).toContain(reference.text)
          })
        })
      })
    ))

  it("pins source links to the build commit and falls back to HEAD for a local server", () => {
    expect(sourceUrl("0123456789abcdef", "apps/theoria/app/server/imagined-place/run.ts")).toBe(
      "https://github.com/scenesystems/theoria/blob/0123456789abcdef/apps/theoria/app/server/imagined-place/run.ts"
    )
    expect(sourceUrl("dev-local", "x.ts")).toBe("https://github.com/scenesystems/theoria/blob/HEAD/x.ts")
  })

  it("shows no values before anything has been built", () => {
    Arr.forEach(placeSteps, (step) => {
      expect(placeLiveValues(step, Option.none(), Option.none())).toEqual([])
    })
  })
})
