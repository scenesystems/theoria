import { describe, expect, it } from "@effect/vitest"
import { Effect, Either, Option, Schema } from "effect"
import * as Arr from "effect/Array"

import { GutterLine, gutterNumber } from "../../app/web/view/primitives/code/HighlightedCode.js"
import {
  highlightCode,
  HighlightTokenKind,
  highlightTokenPaint,
  makeSyntaxHighlighter,
  tokenClassName,
  tokenKindFor
} from "../../app/web/view/primitives/code/highlighter.js"

describe("Theoria Code Highlighter", () => {
  it.effect("every kind of token has one paint, and the theme's colour for it reads back as the kind", () =>
    Effect.gen(function*() {
      // The theme colours a kind by its variable and the view classes it by its name, both from one table keyed by
      // the kind itself: a kind added to `HighlightTokenKind` is a paint owed before the app compiles.
      Arr.forEach(HighlightTokenKind.literals, (kind) => {
        expect(tokenClassName(kind)).toBe(highlightTokenPaint[kind].className)
        expect(tokenKindFor(Option.some(highlightTokenPaint[kind].variable))).toBe(kind)
      })
      expect(tokenClassName("plain")).toBe("text-ink-900")
      expect(tokenClassName("comment")).toBe("text-code-comment italic")
      // A colour the theme never paints, or none, is plain: the one open edge, named.
      expect(tokenKindFor(Option.some("#ff0000"))).toBe("plain")
      expect(tokenKindFor(Option.none())).toBe("plain")
    }))

  it.effect("classifies keywords, types, numbers, strings, and comments", () =>
    Effect.scoped(
      Effect.gen(function*() {
        const highlighter = yield* makeSyntaxHighlighter
        const lines = highlightCode(
          highlighter,
          "const value: NumberBox = 42; const label = \"answer\" // note",
          "typescript"
        )
        const firstLine = lines[0] ?? []

        expect(Arr.some(firstLine, (token) => token.kind === "keyword" && token.value === "const")).toBe(true)
        expect(Arr.some(firstLine, (token) => token.kind === "type" && token.value === "NumberBox")).toBe(true)
        expect(Arr.some(firstLine, (token) => token.kind === "number" && token.value === "42")).toBe(true)
        expect(Arr.some(firstLine, (token) => token.kind === "string" && token.value.includes("answer"))).toBe(true)
        expect(Arr.some(firstLine, (token) => token.kind === "comment" && token.value.startsWith("//"))).toBe(true)
      })
    ))

  it.effect("keeps source line count stable including blank lines", () =>
    Effect.scoped(
      Effect.gen(function*() {
        const highlighter = yield* makeSyntaxHighlighter
        const source = "const a = 1\n\nconst b = \"two\""
        const lines = highlightCode(highlighter, source, "typescript")

        expect(lines.length).toBe(3)
        expect(lines[1]?.length).toBeGreaterThan(0)
      })
    ))

  it.effect("a gutter line is numbered from one, by schema, and the gutter shows that number alone", () =>
    Effect.gen(function*() {
      const decode = Schema.decodeUnknown(GutterLine)
      const line = yield* decode({ number: 3, text: "const answer = 42" })
      expect(gutterNumber(line)).toBe(3)
      expect(line).toBeInstanceOf(GutterLine)
      // Lines count from one: a zeroth or fractional line is not a line the gutter has.
      expect(Either.isLeft(yield* Effect.either(decode({ number: 0, text: "" })))).toBe(true)
      expect(Either.isLeft(yield* Effect.either(decode({ number: 1.5, text: "" })))).toBe(true)
      // Constructing directly is the same contract.
      expect(() => new GutterLine({ number: -1, text: "" })).toThrow()
    }))
})
