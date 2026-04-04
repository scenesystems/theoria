import { BunContext } from "@effect/platform-bun"
import { describe, expect, it } from "@effect/vitest"
import { Effect, Layer } from "effect"
import * as Arr from "effect/Array"
import * as Option from "effect/Option"
import * as ts from "typescript"

import { parseTypeScript, readProjectFile, variableInitializerTexts } from "@theoria/source-proof"
import { Browser, Contracts, Text } from "../../src/index.js"

const packageRootUrl = new URL("../../", import.meta.url)

const defaultEngineProfile: Text.EngineProfileType = {
  lineFitEpsilon: 0.005,
  tabWidth: 4,
  defaultDirection: "ltr",
  preferEarlySoftHyphenBreak: false,
  preferPrefixWidthsForBreakableRuns: true
}

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

const parseVariableInitializer = (source: string, variableName: string): ts.SourceFile => {
  const parsed = parseTypeScript(`${variableName}.ts`, source)
  const initializer = Arr.head(variableInitializerTexts(parsed, variableName)).pipe(Option.getOrElse(() => "undefined"))

  return parseTypeScript(`${variableName}.initializer.ts`, `const ${variableName} = ${initializer}`)
}

const callExpressionTexts = (sourceFile: ts.SourceFile): ReadonlyArray<string> => {
  const collect = (node: ts.Node): ReadonlyArray<string> =>
    Arr.reduce(
      Arr.fromIterable(node.getChildren(sourceFile)),
      ts.isCallExpression(node) ? Arr.make(node.expression.getText(sourceFile)) : Arr.empty<string>(),
      (texts, child) => Arr.appendAll(texts, collect(child))
    )

  return collect(sourceFile)
}

const readInitializerCallExpressions = (relativePath: string, variableName: string) =>
  readProjectFile(packageRootUrl, relativePath).pipe(
    Effect.map((source) => callExpressionTexts(parseVariableInitializer(source, variableName)))
  )

const containsString = (values: ReadonlyArray<string>, expected: string): boolean =>
  Arr.some(values, (value) => value === expected)

const prepareInput = (
  text: string,
  font: Text.FontDescriptorType,
  whiteSpace: Text.WhiteSpaceModeType
): Text.PrepareInputType => ({
  text,
  font,
  whiteSpace
})

class MonospaceCanvasContext {
  direction: "ltr" | "rtl" | "inherit" = "inherit"
  font = "10px monospace"
  textBaseline: "top" | "hanging" | "middle" | "alphabetic" | "ideographic" | "bottom" = "alphabetic"
  multiplier = 1
  measureCount = 0

  measureText(text: string): { readonly width: number } {
    const fontSize = Number.parseInt(this.font, 10)

    this.measureCount += 1
    return { width: text.length * fontSize * this.multiplier }
  }
}

class EmojiCanvasContext {
  direction: "ltr" | "rtl" | "inherit" = "inherit"
  font = "10px monospace"
  textBaseline: "top" | "hanging" | "middle" | "alphabetic" | "ideographic" | "bottom" = "alphabetic"

  measureText(text: string): { readonly width: number } {
    if (text === "🙂") {
      return { width: 4 }
    }

    if (text === "AB") {
      return { width: 20 }
    }

    if (text === "A🙂B") {
      return { width: 22 }
    }

    return { width: text.length * 10 }
  }
}

const browserLayer = (
  context: {
    direction: "ltr" | "rtl" | "inherit"
    font: string
    textBaseline: "top" | "hanging" | "middle" | "alphabetic" | "ideographic" | "bottom"
    measureText: (text: string) => { readonly width: number }
  },
  emojiCorrection?: boolean | { readonly minimumAdvanceMultiplier?: number; readonly probe?: string }
) =>
  Layer.mergeAll(
    Text.WordSegmenterLive,
    Text.EngineProfileLive,
    Text.MeasurementCacheLive.pipe(
      Layer.provide(
        Option.match(Option.fromNullable(emojiCorrection), {
          onNone: () => Browser.CanvasTextMeasurerLive({ context }),
          onSome: (resolvedEmojiCorrection) =>
            Browser.CanvasTextMeasurerLive({
              context,
              emojiCorrection: resolvedEmojiCorrection
            })
        })
      )
    )
  )

const browserPreparationLayer = (context: {
  direction: "ltr" | "rtl" | "inherit"
  font: string
  textBaseline: "top" | "hanging" | "middle" | "alphabetic" | "ideographic" | "bottom"
  measureText: (text: string) => { readonly width: number }
}) =>
  Layer.mergeAll(
    Text.WordSegmenterLive,
    Text.MeasurementCacheLive.pipe(Layer.provide(Browser.CanvasTextMeasurerLive({ context })))
  )

describe("Text browser runtime contracts", () => {
  it.effect("CanvasTextMeasurerLive is concurrency-safe under repeated prepare calls", () =>
    Effect.gen(function*() {
      const initializerCalls = yield* readInitializerCallExpressions(
        "src/Browser/layers.ts",
        "makeCanvasTextMeasurer"
      ).pipe(Effect.provide(BunContext.layer))
      const context = new MonospaceCanvasContext()
      const inputs: ReadonlyArray<Text.PrepareInputType> = Arr.make(
        prepareInput("alpha beta", { family: "Mono", size: 10 }, "normal"),
        prepareInput("beta gamma", { family: "Mono", size: 10 }, "normal"),
        prepareInput("gamma delta", { family: "Mono", size: 12 }, "normal"),
        prepareInput("delta\tepsilon", { family: "Mono", size: 10 }, "pre-wrap"),
        prepareInput("zeta\u00adeta", { family: "Mono", size: 10 }, "normal"),
        prepareInput("theta\n iota", { family: "Mono", size: 10 }, "pre-wrap")
      )

      const summaries = yield* Effect.forEach(
        inputs,
        (input) =>
          Text.prepare(input).pipe(
            Effect.map((prepared) => Text.layout(prepared, { maxWidth: 100, lineHeight: 12 }))
          ),
        { concurrency: "unbounded" }
      ).pipe(Effect.provide(browserLayer(context)))

      expect(containsString(initializerCalls, "Effect.makeSemaphore")).toBe(true)
      expect(containsString(initializerCalls, "contextSemaphore.withPermits")).toBe(true)
      expect(context.measureCount).toBeGreaterThan(0)
      expect(context.font).toBe("10px monospace")
      expect(context.direction).toBe("inherit")
      expect(context.textBaseline).toBe("alphabetic")
      expect(Arr.every(summaries, (summary) => summary.lineCount >= 1 && summary.maxLineWidth > 0)).toBe(true)
    }))

  it.effect("emoji correction remains optional and additive", () =>
    Effect.gen(function*() {
      const correctedLayer = browserLayer(new EmojiCanvasContext(), true)
      const rawLayer = browserLayer(new EmojiCanvasContext(), false)
      const emojiInput: Text.PrepareInputType = {
        text: "A🙂B",
        font: { family: "Mono", size: 12 },
        whiteSpace: "normal"
      }
      const plainInput: Text.PrepareInputType = {
        text: "AB",
        font: { family: "Mono", size: 12 },
        whiteSpace: "normal"
      }

      const { correctedEmoji, correctedPlain, rawEmoji, rawPlain } = yield* Effect.all({
        correctedEmoji: Text.prepareWithSegments(emojiInput).pipe(
          Effect.provide(correctedLayer),
          Effect.map((prepared) => Text.layout(prepared, { maxWidth: 100, lineHeight: 12 }).maxLineWidth)
        ),
        correctedPlain: Text.prepareWithSegments(plainInput).pipe(
          Effect.provide(correctedLayer),
          Effect.map((prepared) => Text.layout(prepared, { maxWidth: 100, lineHeight: 12 }).maxLineWidth)
        ),
        rawEmoji: Text.prepareWithSegments(emojiInput).pipe(
          Effect.provide(rawLayer),
          Effect.map((prepared) => Text.layout(prepared, { maxWidth: 100, lineHeight: 12 }).maxLineWidth)
        ),
        rawPlain: Text.prepareWithSegments(plainInput).pipe(
          Effect.provide(rawLayer),
          Effect.map((prepared) => Text.layout(prepared, { maxWidth: 100, lineHeight: 12 }).maxLineWidth)
        )
      })

      expect(correctedEmoji).toBeGreaterThan(rawEmoji)
      expect(correctedEmoji).toBe(32)
      expect(rawEmoji).toBe(24)
      expect(correctedPlain).toBe(rawPlain)
      expect(correctedPlain).toBe(20)
    }))

  it.effect("prepared text can be invalidated or refreshed when font readiness changes", () =>
    Effect.gen(function*() {
      const context = new MonospaceCanvasContext()
      const input: Text.PrepareInputType = {
        text: "alpha beta",
        font: { family: "Mono", size: 10 },
        whiteSpace: "normal"
      }
      const request = { maxWidth: 200, lineHeight: 12 }

      const staleWidths = yield* Effect.gen(function*() {
        const before = yield* Text.prepare(input).pipe(
          Effect.map((prepared) => Text.layout(prepared, request).maxLineWidth)
        )

        context.multiplier = 2

        const stale = yield* Text.prepare(input).pipe(
          Effect.map((prepared) => Text.layout(prepared, request).maxLineWidth)
        )

        return { before, stale }
      }).pipe(Effect.provide(browserLayer(context)))

      const refreshed = yield* Text.prepare(input).pipe(
        Effect.provide(browserLayer(context)),
        Effect.map((prepared) => Text.layout(prepared, request).maxLineWidth)
      )

      expect(staleWidths.before).toBe(100)
      expect(staleWidths.stale).toBe(100)
      expect(refreshed).toBe(200)
    }))

  it.effect("measurement cache freshness policy is explicit after font or engine changes", () =>
    Effect.gen(function*() {
      const context = new MonospaceCanvasContext()
      const baseInput: Text.PrepareInputType = {
        text: "ab\u00adcd\u00adef",
        font: { family: "Mono", size: 10 },
        whiteSpace: "normal"
      }
      const largerFontInput: Text.PrepareInputType = {
        ...baseInput,
        font: { ...baseInput.font, size: 12 }
      }
      const request = { maxWidth: 50, lineHeight: 12 }
      const earlySoftHyphenProfile: Text.EngineProfileType = {
        ...defaultEngineProfile,
        preferEarlySoftHyphenBreak: true
      }

      const result = yield* Effect.gen(function*() {
        const earlyPrepared = yield* Text.prepareWithSegments(baseInput).pipe(
          Effect.provideService(Contracts.EngineProfile, earlySoftHyphenProfile)
        )
        const callsAfterEarly = context.measureCount
        const latePrepared = yield* Text.prepareWithSegments(baseInput).pipe(
          Effect.provideService(Contracts.EngineProfile, defaultEngineProfile)
        )
        const callsAfterEngineChange = context.measureCount
        const largePrepared = yield* Text.prepare(largerFontInput).pipe(
          Effect.provideService(Contracts.EngineProfile, defaultEngineProfile)
        )
        const callsAfterFontChange = context.measureCount

        return {
          callsAfterEarly,
          callsAfterEngineChange,
          callsAfterFontChange,
          earlyLines: Text.layoutLines(earlyPrepared, request),
          lateLines: Text.layoutLines(latePrepared, request),
          largerSummary: Text.layout(largePrepared, { maxWidth: 200, lineHeight: 12 })
        }
      }).pipe(Effect.provide(browserPreparationLayer(context)))

      expect(result.callsAfterEarly).toBeGreaterThan(0)
      expect(result.callsAfterEngineChange).toBe(result.callsAfterEarly)
      expect(result.callsAfterFontChange).toBeGreaterThan(result.callsAfterEngineChange)
      expect(result.earlyLines).toEqual([
        visualLine(0, "ab-", 30),
        visualLine(1, "cdef", 40)
      ])
      expect(result.lateLines).toEqual([
        visualLine(0, "abcd-", 50),
        visualLine(1, "ef", 20)
      ])
      expect(result.largerSummary.maxLineWidth).toBe(72)
    }))
})
