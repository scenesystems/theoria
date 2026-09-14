import { describe, expect, it } from "@effect/vitest"
import { Effect, Either, Schema } from "effect"

import { HeaderGlyphSource } from "../../app/web/view/primitives/HeaderChrome.js"

describe("header chrome", () => {
  it.effect("refuse a glyph source the header cannot size", () =>
    Effect.sync(() => {
      expect(Either.isLeft(Schema.decodeUnknownEither(HeaderGlyphSource)("font-awesome"))).toBe(true)
      // A set is named with the grid it draws on, since that is what the header sizes by.
      expect(Either.isLeft(Schema.decodeUnknownEither(HeaderGlyphSource)("heroicon"))).toBe(true)
      expect(Schema.decodeUnknownEither(HeaderGlyphSource)("heroicon-20-solid")).toEqual(
        Either.right("heroicon-20-solid")
      )
      expect(Schema.decodeUnknownEither(HeaderGlyphSource)("brand-mark")).toEqual(Either.right("brand-mark"))
    }))
})
