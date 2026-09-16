import { describe, expect, it } from "@effect/vitest"
import { Effect, Exit, Schema } from "effect"
import * as Arr from "effect/Array"

import * as Browser from "../../src/Browser/index.js"
import { Text } from "../../src/index.js"

const profile = Browser.DefaultBrowserSupportProfile
const browserLayer = Browser.browserParityLayer(profile)
const font: Text.FontDescriptorType = { family: profile.defaultFontFamily, size: 10 }

const layoutLines = (
  text: string,
  whiteSpace: Text.WhiteSpaceModeType,
  request: Text.LayoutRequestType
) =>
  Text.prepareWithSegments({ text, font, whiteSpace }).pipe(
    Effect.provide(browserLayer),
    Effect.map((prepared) => Text.layoutLines(prepared, request))
  )

describe("Text browser-backed behavior contracts", () => {
  it.effect("collapses normal whitespace and preserves pre-wrap whitespace", () =>
    Effect.gen(function*() {
      const request: Text.LayoutRequestType = { maxWidth: 200, lineHeight: 12 }
      const normal = yield* layoutLines("alpha  beta", "normal", request)
      const preWrap = yield* layoutLines("alpha  beta", "pre-wrap", request)

      expect(normal).toEqual(Arr.of(
        { baseDirection: "ltr", index: 0, order: "visual", text: "alpha beta", width: 100 }
      ))
      expect(preWrap).toEqual(Arr.of(
        { baseDirection: "ltr", index: 0, order: "visual", text: "alpha  beta", width: 110 }
      ))
    }))

  it.effect("expands tabs by profile columns and paints soft-hyphen breaks", () =>
    Effect.gen(function*() {
      const tab = yield* layoutLines("a\tb", "pre-wrap", { maxWidth: 100, lineHeight: 12 })
      const softHyphen = yield* layoutLines("alpha\u00adbeta", "normal", { maxWidth: 60, lineHeight: 12 })

      expect(tab).toEqual(Arr.of(
        { baseDirection: "ltr", index: 0, order: "visual", text: "a\tb", width: 50 }
      ))
      expect(softHyphen).toEqual(Arr.make(
        { baseDirection: "ltr", index: 0, order: "visual", text: "alpha-", width: 60 },
        { baseDirection: "ltr", index: 1, order: "visual", text: "beta", width: 40 }
      ))
    }))

  it.effect("rejects invalid browser options and strict preparation input", () =>
    Effect.gen(function*() {
      const invalidCorrection = yield* Effect.exit(
        Schema.decodeUnknown(Browser.EmojiCorrection)({ minimumAdvanceMultiplier: 0 })
      )
      const invalidProfile = yield* Effect.exit(
        Schema.decodeUnknown(Browser.BrowserSupportProfileIdSchema)("unknown-browser")
      )
      const invalidPrepare = yield* Effect.exit(Text.prepareUnknown({
        text: "invalid",
        font: { family: "Mono", size: 0 },
        whiteSpace: "normal"
      }))

      expect(Exit.isFailure(invalidCorrection)).toBe(true)
      expect(Exit.isFailure(invalidProfile)).toBe(true)
      expect(Exit.isFailure(invalidPrepare)).toBe(true)
    }).pipe(Effect.provide(browserLayer)))
})
