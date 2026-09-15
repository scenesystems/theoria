import { describe, expect, it } from "@effect/vitest"
import { Effect, Number, String } from "effect"
import * as Arr from "effect/Array"

import { Contracts, Text } from "../../src/index.js"

const segment = (text: string, whiteSpace: Text.WhiteSpaceModeType) =>
  Effect.gen(function*() {
    const segmenter = yield* Contracts.WordSegmenter
    return yield* segmenter.segment(text, whiteSpace)
  }).pipe(Effect.provide(Text.WordSegmenterLive))

describe("Text segmentation contracts", () => {
  it.effect("preserves grouped whitespace, tabs, and hard breaks in pre-wrap mode", () =>
    Effect.gen(function*() {
      expect(yield* segment("alpha  beta\n\ngamma\tdelta", "pre-wrap")).toEqual(Arr.make(
        { kind: "text", text: "alpha" },
        { kind: "space", text: "  " },
        { kind: "text", text: "beta" },
        { kind: "hard-break", text: "\n" },
        { kind: "hard-break", text: "\n" },
        { kind: "text", text: "gamma" },
        { kind: "space", text: "\t" },
        { kind: "text", text: "delta" }
      ))
    }))

  it.effect("normalizes line breaks and collapses ordinary whitespace in normal mode", () =>
    Effect.gen(function*() {
      expect(yield* segment("  alpha\r\n\tbeta\r  ", "normal")).toEqual(Arr.make(
        { kind: "text", text: "alpha" },
        { kind: "space", text: " " },
        { kind: "text", text: "beta" }
      ))
    }))

  it.effect("uses explicit Unicode grapheme boundaries for no-space scripts and emoji", () =>
    Effect.gen(function*() {
      expect(yield* segment("ภาษา", "normal")).toEqual(Arr.make(
        { kind: "text", text: "ภ" },
        { kind: "text", text: "า" },
        { kind: "text", text: "ษ" },
        { kind: "text", text: "า" }
      ))
      expect(yield* segment("A👨‍👩‍👧‍👦B", "normal")).toEqual(Arr.make(
        { kind: "text", text: "A" },
        { kind: "text", text: "👨‍👩‍👧‍👦" },
        { kind: "text", text: "B" }
      ))
    }))

  it.effect("keeps punctuation and connectors attached to URL-like and numeric runs", () =>
    Effect.gen(function*() {
      expect(yield* segment("(hello) https://example.com/a-b?x=1,2", "normal")).toEqual(Arr.make(
        { kind: "text", text: "(hello)" },
        { kind: "space", text: " " },
        { kind: "text", text: "https://example.com/a-b?x=1,2" }
      ))
    }))

  it.effect("preserves glue, explicit-break, and soft-hyphen markers with their owners", () =>
    Effect.gen(function*() {
      expect(yield* segment("alpha\u00adbeta no\u00a0break word\u2060join a\u200bb", "normal")).toEqual(Arr.make(
        { kind: "text", text: "alpha\u00adbeta" },
        { kind: "space", text: " " },
        { kind: "text", text: "no" },
        { kind: "text", text: "\u00a0" },
        { kind: "text", text: "break" },
        { kind: "space", text: " " },
        { kind: "text", text: "word" },
        { kind: "text", text: "\u2060" },
        { kind: "text", text: "join" },
        { kind: "space", text: " " },
        { kind: "text", text: "a" },
        { kind: "text", text: "\u200b" },
        { kind: "text", text: "b" }
      ))
    }))

  it.effect("lays out long runs only at complete grapheme boundaries", () =>
    Effect.gen(function*() {
      const prepared = yield* Text.prepareWithSegments({
        text: "A👨‍👩‍👧‍👦B",
        font: { family: "Mono", size: 10 },
        whiteSpace: "normal"
      }).pipe(Effect.provide(Text.TextLayoutLive))
      const lines = Text.layoutLines(prepared, { maxWidth: 7, lineHeight: 12 })

      expect(Arr.map(lines, (line) => line.text)).toEqual(Arr.make("A", "👨‍👩‍👧‍👦", "B"))
      expect(Arr.reduce(lines, "", (text, line) => String.concat(line.text)(text))).toBe("A👨‍👩‍👧‍👦B")
      expect(Arr.every(lines, (line) => Number.greaterThan(String.length(line.text), 0))).toBe(true)
    }))
})
