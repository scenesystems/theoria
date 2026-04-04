import { describe, expect, it } from "@effect/vitest"
import { Effect, Layer, Schema } from "effect"

import * as Contracts from "../../src/contracts/index.js"
import * as EffectText from "../../src/index.js"
import * as Text from "../../src/Text/index.js"

const visualLine = (index: number, text: string, width: number): Text.LayoutLineType => ({
  baseDirection: "ltr",
  index,
  order: "visual",
  text,
  width
})

const prepareInput: Text.PrepareInputType = {
  text: "colouration",
  font: { family: "Mono", size: 10 },
  hyphenationLocale: "en-gb",
  whiteSpace: "normal"
}

const request: Text.LayoutRequestType = { maxWidth: 35, lineHeight: 12 }
const measurerLayer = Text.TextMeasurerLive
const baseServices = Layer.mergeAll(
  Text.WordSegmenterLive,
  Text.EngineProfileLive,
  measurerLayer,
  Text.MeasurementCacheLive.pipe(Layer.provide(measurerLayer))
)

const contractDictionaryServices = Layer.mergeAll(
  baseServices,
  Layer.succeed(Contracts.HyphenationDictionary, {
    hyphenateWord: (locale: string, word: string) =>
      locale === "en-gb" && word === "colouration"
        ? Effect.succeed([3, 6])
        : Effect.succeed([])
  })
)

const liveDictionaryServices = Layer.mergeAll(
  baseServices,
  Text.HyphenationDictionaryLive({ dictionaries: { "en-gb": { colouration: [3, 6] } } })
)

const noDictionaryServices = Layer.mergeAll(baseServices, Text.NoHyphenationDictionaryLive)

describe("package hyphenation surface contracts", () => {
  it.effect("keeps the hyphenation surface explicit on the public Text and Contracts lanes", () =>
    Effect.gen(function*() {
      expect(EffectText.Text.HyphenationDictionaryLive).toBe(Text.HyphenationDictionaryLive)
      expect(EffectText.Text.HyphenationSupport).toBe(Text.HyphenationSupport)
      expect(EffectText.Text.NoHyphenationDictionaryLive).toBe(Text.NoHyphenationDictionaryLive)
      expect(EffectText.Text.HyphenationLocale).toBe(Text.HyphenationLocale)
      expect(EffectText.Contracts.HyphenationDictionary).toBe(Contracts.HyphenationDictionary)
      expect(Schema.is(Text.HyphenationLocale)(prepareInput.hyphenationLocale)).toBe(true)
      expect(Text.HyphenationSupport).toEqual({
        localeFallback: "exact-or-base-language",
        locales: ["en-us", "en-gb", "de", "fr", "es"]
      })

      const contractLines = yield* Text.prepareWithSegments(prepareInput).pipe(
        Effect.provide(contractDictionaryServices),
        Effect.map((prepared) => Text.layoutLines(prepared, request))
      )
      const liveLayerLines = yield* Text.prepareWithSegments(prepareInput).pipe(
        Effect.provide(liveDictionaryServices),
        Effect.map((prepared) => Text.layoutLines(prepared, request))
      )
      const fallbackLines = yield* Text.prepareWithSegments(prepareInput).pipe(
        Effect.provide(noDictionaryServices),
        Effect.map((prepared) => Text.layoutLines(prepared, request))
      )

      expect(contractLines).toEqual(liveLayerLines)
      expect(liveLayerLines).toEqual([
        visualLine(0, "col-", 23.2),
        visualLine(1, "our-", 23.2),
        visualLine(2, "ation", 29)
      ])
      expect(fallbackLines).toEqual([visualLine(0, "colour", 34.8), visualLine(1, "ation", 29)])
    }))
})
