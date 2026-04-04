/**
 * Canvas Measurement — official browser layer composition.
 *
 * What this shows: `CanvasTextMeasurerLive` and
 * `BrowserMeasurementCacheLive` wire into the same prepare/layout split, and
 * emoji correction stays optional and additive.
 *
 * Feature Type Links:
 * - {@link Browser.CanvasTextMeasurerLive}
 * - {@link Contracts.TextMeasurer}
 * - {@link Text.TextLayoutLive}
 *
 * Run: bun run packages/effect-text/examples/04-canvas-measurement.ts
 */
import { BunRuntime } from "@effect/platform-bun"
import { BunContext } from "@effect/platform-bun"
import { Effect, Layer, Match } from "effect"

import { Browser, Contracts, Text } from "effect-text"

class DemoCanvasContext {
  direction: "inherit" = "inherit"
  font = "12px Mono"
  textBaseline: "alphabetic" = "alphabetic"

  measureText(text: string): { readonly width: number } {
    return {
      width: Match.value(text).pipe(
        Match.when("🙂", () => 4),
        Match.when("AB", () => 20),
        Match.when("A🙂B", () => 22),
        Match.orElse((value) => value.length * 10)
      )
    }
  }
}

const browserProfile = Browser.browserSupportProfile("canvas-system-ui")
const fontReadinessRevision = Browser.initialFontReadinessRevision()

const servicesWithEmojiCorrection = (
  emojiCorrection: boolean | { readonly minimumAdvanceMultiplier?: number; readonly probe?: string }
) =>
  Layer.mergeAll(
    Text.WordSegmenterLive,
    Layer.succeed(Contracts.EngineProfile, browserProfile.engineProfile),
    Browser.BrowserMeasurementCacheLive({ fontReadinessRevision, profileId: browserProfile.id }).pipe(
      Layer.provide(
        Browser.CanvasTextMeasurerLive({
          context: new DemoCanvasContext(),
          emojiCorrection,
          textBaseline: "alphabetic"
        })
      )
    )
  )

const maxLineWidthFor = (text: string, emojiCorrection: boolean) =>
  Text.prepareWithSegments({
    text,
    font: { family: browserProfile.defaultFontFamily, size: 12 },
    whiteSpace: browserProfile.defaultWhiteSpaceMode
  }).pipe(
    Effect.provide(servicesWithEmojiCorrection(emojiCorrection)),
    Effect.map((prepared) => Text.layout(prepared, { maxWidth: 100, lineHeight: 16 }).maxLineWidth)
  )

const program = Effect.gen(function*() {
  const correctedServices = servicesWithEmojiCorrection(true)
  const correctedPrepared = yield* Text.prepareWithSegments({
    text: "A🙂B keeps browser measurement additive.",
    font: { family: browserProfile.defaultFontFamily, size: 12 },
    whiteSpace: browserProfile.defaultWhiteSpaceMode
  }).pipe(Effect.provide(correctedServices))

  const emojiWidths = yield* Effect.all({
    correctedEmoji: maxLineWidthFor("A🙂B", true),
    correctedPlain: maxLineWidthFor("AB", true),
    rawEmoji: maxLineWidthFor("A🙂B", false),
    rawPlain: maxLineWidthFor("AB", false)
  })

  yield* Effect.log("canvas-backed measurement", {
    browserEngineProfile: browserProfile.engineProfile,
    browserFontSelection: browserProfile.fontSelection,
    browserParityTolerancePx: browserProfile.parityTolerancePx,
    browserProfile: browserProfile.id,
    browserSupportCaveats: browserProfile.caveats,
    browserWhiteSpaceModes: browserProfile.whiteSpaceModes,
    browserParityCases: browserProfile.parityCases,
    browserTabPolicy: browserProfile.tabPolicy,
    fontReadinessRevision,
    emojiCorrection: {
      additiveOnEmoji: emojiWidths.correctedEmoji > emojiWidths.rawEmoji,
      correctedEmoji: emojiWidths.correctedEmoji,
      correctedPlain: emojiWidths.correctedPlain,
      rawEmoji: emojiWidths.rawEmoji,
      rawPlain: emojiWidths.rawPlain,
      unchangedPlainText: emojiWidths.correctedPlain === emojiWidths.rawPlain
    },
    summary: Text.layout(correctedPrepared, { maxWidth: 100, lineHeight: 16 }),
    lines: Text.layoutLines(correctedPrepared, { maxWidth: 100, lineHeight: 16 })
  })
})

BunRuntime.runMain(program.pipe(Effect.provide(BunContext.layer)))
