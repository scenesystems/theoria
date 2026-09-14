import { describe, expect, it } from "@effect/vitest"
import { Effect, Either, Schema } from "effect"

import { HeaderGlyphSource } from "../../app/web/view/primitives/HeaderChrome.js"

describe("header chrome", () => {
  it.effect("refuse a glyph source the header cannot size", () =>
    Effect.sync(() => {
      expect(Either.isLeft(Schema.decodeUnknownEither(HeaderGlyphSource)("font-awesome"))).toBe(true)
      expect(Schema.decodeUnknownEither(HeaderGlyphSource)("brand-mark")).toEqual(Either.right("brand-mark"))
    }))
})
