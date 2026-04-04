import { describe, expect, it } from "@effect/vitest"
import { Effect, Layer } from "effect"
import * as Arr from "effect/Array"

import { Browser, Contracts, Text } from "../../src/index.js"

const browserProfiles = Browser.BrowserSupportManifest.profiles
const fontReadinessRevision = Browser.initialFontReadinessRevision()

const visualLine = (
  index: number,
  text: string,
  width: number,
  baseDirection: Text.BaseTextDirectionType = "ltr"
): Text.LayoutLineType => ({
  baseDirection,
  index,
  order: "visual",
  text,
  width
})

class BrowserParityCanvasContext {
  direction: "ltr" | "rtl" | "inherit" = "inherit"
  font = "10px monospace"
  textBaseline: "top" | "hanging" | "middle" | "alphabetic" | "ideographic" | "bottom" = "alphabetic"

  measureText(text: string): { readonly width: number } {
    return { width: text.length * 10 }
  }
}

const browserLayer = (profile: Browser.BrowserSupportProfileType) =>
  Layer.mergeAll(
    Text.WordSegmenterLive,
    Layer.succeed(Contracts.EngineProfile, profile.engineProfile),
    Browser.BrowserMeasurementCacheLive({ fontReadinessRevision, profileId: profile.id }).pipe(
      Layer.provide(
        Browser.CanvasTextMeasurerLive({
          context: new BrowserParityCanvasContext()
        })
      )
    )
  )

const widestLineWidth = (lines: ReadonlyArray<Text.LayoutLineType>): number =>
  Arr.reduce(lines, 0, (widest, line) => (line.width > widest ? line.width : widest))

const expectSummaryToMatchLines = (
  summary: Text.LayoutSummaryType,
  lines: ReadonlyArray<Text.LayoutLineType>,
  lineHeight: number
) => {
  expect(summary.lineCount).toBe(lines.length)
  expect(summary.height).toBe(lines.length * lineHeight)
  expect(summary.maxLineWidth).toBe(widestLineWidth(lines))
}

const expectProfileLayout = (
  profile: Browser.BrowserSupportProfileType,
  input: {
    readonly text: string
    readonly whiteSpace: Text.WhiteSpaceModeType
  },
  request: Text.LayoutRequestType,
  expectedLines: ReadonlyArray<Text.LayoutLineType>
) =>
  Effect.gen(function*() {
    const prepared = yield* Text.prepareWithSegments({
      text: input.text,
      font: { family: profile.defaultFontFamily, size: 10 },
      whiteSpace: input.whiteSpace
    }).pipe(Effect.provide(browserLayer(profile)))
    const lines = Text.layoutLines(prepared, request)

    expect(lines).toEqual(expectedLines)
    expectSummaryToMatchLines(Text.layout(prepared, request), lines, request.lineHeight)
  })

describe("Text browser parity contracts", () => {
  it.effect("matches browser layout for white-space normal", () =>
    Effect.gen(function*() {
      const request = { maxWidth: 100, lineHeight: 12 }
      yield* Effect.forEach(browserProfiles, (profile) =>
        Effect.sync(() =>
          expect(profile.whiteSpaceModes).toContain("normal")
        ).pipe(
          Effect.zipRight(
            expectProfileLayout(profile, { text: "alpha beta gamma", whiteSpace: "normal" }, request, [
              visualLine(0, "alpha beta", 100),
              visualLine(1, "gamma", 50)
            ])
          )
        ), { discard: true })
    }))

  it.effect("matches browser layout for white-space pre-wrap", () =>
    Effect.gen(function*() {
      const request = { maxWidth: 200, lineHeight: 12 }
      yield* Effect.forEach(browserProfiles, (profile) =>
        Effect.sync(() =>
          expect(profile.whiteSpaceModes).toContain("pre-wrap")
        ).pipe(
          Effect.zipRight(
            expectProfileLayout(profile, { text: "alpha  beta", whiteSpace: "pre-wrap" }, request, [
              visualLine(0, "alpha  beta", 110)
            ])
          )
        ), { discard: true })
    }))

  it.effect("matches browser behavior for trailing whitespace and hard breaks", () =>
    Effect.gen(function*() {
      const request = { maxWidth: 200, lineHeight: 12 }
      yield* Effect.forEach(browserProfiles, (profile) =>
        expectProfileLayout(profile, { text: "alpha  \nbeta", whiteSpace: "pre-wrap" }, request, [
          visualLine(0, "alpha  ", 70),
          visualLine(1, "beta", 40)
        ]), { discard: true })
    }))

  it.effect("matches browser tab advances", () =>
    Effect.gen(function*() {
      const request = { maxWidth: 100, lineHeight: 12 }
      yield* Effect.forEach(browserProfiles, (profile) =>
        expectProfileLayout(profile, { text: "a\tb", whiteSpace: "pre-wrap" }, request, [
          visualLine(0, "a\tb", 50)
        ]), { discard: true })
    }))

  it.effect("matches browser soft-hyphen behavior", () =>
    Effect.gen(function*() {
      const request = { maxWidth: 60, lineHeight: 12 }
      yield* Effect.forEach(browserProfiles, (profile) =>
        expectProfileLayout(profile, { text: "alpha\u00adbeta", whiteSpace: "normal" }, request, [
          visualLine(0, "alpha-", 60),
          visualLine(1, "beta", 40)
        ]), { discard: true })
    }))

  it.effect("matches browser punctuation and mixed inline cases for every shipped browser profile", () =>
    Effect.gen(function*() {
      const request = { maxWidth: 200, lineHeight: 12 }
      yield* Effect.forEach(
        browserProfiles,
        (profile) =>
          Effect.sync(() => expect(profile.parityCases).toContain("mixed-inline-punctuation")).pipe(
            Effect.zipRight(
              expectProfileLayout(profile, { text: "(שלום) hello", whiteSpace: "normal" }, request, [
                visualLine(0, "hello (םולש)", 120, "rtl")
              ])
            )
          ),
        { discard: true }
      )
    }))
})
