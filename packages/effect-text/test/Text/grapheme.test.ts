import { describe, expect, it } from "@effect/vitest"
import { Array as Arr, Effect, FastCheck, Schema, String } from "effect"

import { graphemeClusters } from "../../src/Text/internal/grapheme.js"
import { Graphemes } from "../../src/Text/internal/graphemeSchema.js"
import vectors from "../fixtures/graphemeBreak17.json" with { type: "json" }

const ConformanceCases = Schema.Array(Schema.Struct({ input: Schema.String, expected: Graphemes }))

describe("Unicode 17.0 extended grapheme boundaries", () => {
  it.effect("matches the Unicode UAX #29 conformance corpus", () =>
    Effect.gen(function*() {
      const cases = yield* Schema.decodeUnknown(ConformanceCases)(vectors)
      yield* Effect.forEach(cases, ({ input, expected }) =>
        Effect.sync(() => {
          expect(graphemeClusters(input), input).toEqual(expected)
        }))
    }))

  it.effect("handles empty text and retains isolated UTF-16 surrogates without replacement", () =>
    Effect.sync(() => {
      expect(graphemeClusters("")).toEqual(Arr.empty())
      expect(graphemeClusters("\ud800a\udc00\u0301")).toEqual(Arr.make("\ud800", "a", "\udc00\u0301"))
    }))

  it.effect("resets emoji, RI parity and Indic conjunct context at the correct boundaries", () =>
    Effect.sync(() => {
      expect(graphemeClusters("👨‍👩‍👧‍👦x‍👩")).toEqual(Arr.make("👨‍👩‍👧‍👦", "x‍", "👩"))
      expect(graphemeClusters("🇦🇧🇨🇩🇪\u0301🇫")).toEqual(Arr.make("🇦🇧", "🇨🇩", "🇪\u0301", "🇫"))
      expect(graphemeClusters("क्षक्क")).toEqual(Arr.make("क्ष", "क्क"))
      expect(graphemeClusters("क्aक")).toEqual(Arr.make("क्", "a", "क"))
    }))

  it.effect.prop("preserves arbitrary UTF-16 text and never emits empty clusters", {
    text: FastCheck.stringOf(FastCheck.char16bits())
  }, ({ text }) =>
    Effect.sync(() => {
      const clusters = graphemeClusters(text)
      expect(Arr.join(clusters, "")).toBe(text)
      expect(Arr.every(clusters, String.isNonEmpty)).toBe(true)
    }))
})
