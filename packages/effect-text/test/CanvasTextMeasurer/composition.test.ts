import { describe, expect, it } from "@effect/vitest"
import { Effect, Exit, Option, Schema } from "effect"
import * as Arr from "effect/Array"

import * as CanvasRegression from "../../examples/live/canvasRegression.js"
import * as CanvasProfile from "../../src/CanvasProfile.js"
import * as CanvasTextMeasurer from "../../src/CanvasTextMeasurer.js"
import * as Text from "../../src/Text.js"

const profile = CanvasProfile.monospace
const font: Text.Font = { family: profile.defaultFontFamily, size: 10 }

const layout = (text: string, whiteSpace: Text.Whitespace, request: Text.Request) =>
  Text.prepareWithSegments({ text, font, whiteSpace }).pipe(
    Effect.provide(CanvasRegression.layer(profile)),
    Effect.map((prepared) => Text.layout(prepared, request))
  )

describe("canvas and Text composition", () => {
  it.effect("collapses normal whitespace and preserves pre-wrap whitespace", () =>
    Effect.gen(function*() {
      const request = Text.Request.make({ maxWidth: 200, lineHeight: 12 })
      const normal = yield* layout("alpha  beta", "normal", request)
      const preWrap = yield* layout("alpha  beta", "pre-wrap", request)

      expect(normal.lines).toEqual(Arr.of(
        { baseDirection: "ltr", index: 0, order: "visual", text: "alpha beta", width: 100 }
      ))
      expect(preWrap.lines).toEqual(Arr.of(
        { baseDirection: "ltr", index: 0, order: "visual", text: "alpha  beta", width: 110 }
      ))
    }))

  it.effect("expands profile tab columns and paints soft-hyphen breaks", () =>
    Effect.gen(function*() {
      const tab = yield* layout("a\tb", "pre-wrap", Text.Request.make({ maxWidth: 100, lineHeight: 12 }))
      const softHyphen = yield* layout("alpha\u00adbeta", "normal", Text.Request.make({ maxWidth: 60, lineHeight: 12 }))

      expect(tab.lines).toEqual(Arr.of(
        { baseDirection: "ltr", index: 0, order: "visual", text: "a\tb", width: 50 }
      ))
      expect(softHyphen.lines).toEqual(Arr.make(
        { baseDirection: "ltr", index: 0, order: "visual", text: "alpha-", width: 60 },
        { baseDirection: "ltr", index: 1, order: "visual", text: "beta", width: 40 }
      ))
    }))

  it.effect("fits shaped prefixes while painting additive grapheme advances", () =>
    Effect.gen(function*() {
      const result = yield* layout("ffi", "normal", Text.Request.make({ maxWidth: 24, lineHeight: 12 }))
      expect(result).toEqual({
        summary: { lineCount: 1, height: 12, maxLineWidth: 30 },
        lines: Arr.of({ baseDirection: "ltr", index: 0, order: "visual", text: "ffi", width: 30 })
      })
    }))

  it.effect("renders the checked-in scenario expectations through real composition", () =>
    Effect.gen(function*() {
      const artifact = yield* CanvasRegression.render(profile)
      const systemUiArtifact = yield* CanvasRegression.render(CanvasProfile.systemUi)
      expect(Arr.map(artifact.cases, (entry) => entry.summary)).toEqual(Arr.make(
        { lineCount: 2, height: 24, maxLineWidth: 100 },
        { lineCount: 1, height: 12, maxLineWidth: 110 },
        { lineCount: 2, height: 24, maxLineWidth: 70 },
        { lineCount: 1, height: 12, maxLineWidth: 50 },
        { lineCount: 2, height: 24, maxLineWidth: 60 },
        { lineCount: 1, height: 12, maxLineWidth: 120 },
        { lineCount: 1, height: 12, maxLineWidth: 30 }
      ))
      expect(Arr.last(systemUiArtifact.cases).pipe(Option.map((entry) => entry.lines))).toEqual(Option.some(Arr.make(
        { baseDirection: "ltr", index: 0, order: "visual", text: "ff", width: 20 },
        { baseDirection: "ltr", index: 1, order: "visual", text: "i", width: 10 }
      )))
    }))

  it.effect("rejects invalid correction and profile identifiers", () =>
    Effect.gen(function*() {
      const invalidCorrection = yield* Effect.exit(
        Schema.decodeUnknown(CanvasTextMeasurer.EmojiCorrection)({ minimumAdvanceMultiplier: 0 })
      )
      const invalidProfile = yield* Effect.exit(Schema.decodeUnknown(CanvasProfile.Id)("unknown-browser"))
      expect(Exit.isFailure(invalidCorrection)).toBe(true)
      expect(Exit.isFailure(invalidProfile)).toBe(true)
    }))
})
