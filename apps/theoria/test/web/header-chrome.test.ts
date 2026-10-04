import { describe, expect, it } from "@effect/vitest"
import { Effect, Result, Schema } from "effect"

import { HeaderGlyphSource } from "../../app/web/view/primitives/HeaderChrome.js"

describe("header chrome", () => {
  it.effect("refuse a glyph source the header cannot size", () =>
    Effect.sync(() => {
      expect(Result.isFailure(Schema.decodeUnknownResult(HeaderGlyphSource)("font-awesome"))).toBe(true)
      // A set is named with the grid it draws on, since that is what the header sizes by.
      expect(Result.isFailure(Schema.decodeUnknownResult(HeaderGlyphSource)("heroicon"))).toBe(true)
      expect(Schema.decodeResult(HeaderGlyphSource)("heroicon-20-solid")).toEqual(
        Result.succeed("heroicon-20-solid")
      )
      expect(Schema.decodeResult(HeaderGlyphSource)("brand-mark")).toEqual(Result.succeed("brand-mark"))
    }))
})
