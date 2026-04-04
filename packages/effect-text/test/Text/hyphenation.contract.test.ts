import { describe, expect, it } from "@effect/vitest"
import { Chunk, Effect, Layer, Option, Ref, Stream } from "effect"

import { Contracts, Text } from "../../src/index.js"

const visualLine = (index: number, text: string, width: number): Text.LayoutLineType => ({
  baseDirection: "ltr",
  index,
  order: "visual",
  text,
  width
})

const dictionaries = {
  "en-us": { communication: [5, 8], hyphenation: [2, 6] },
  "en-gb": { colouration: [3, 6] },
  de: { silbentrennung: [6, 10] },
  es: { separacion: [3, 5, 7] },
  fr: { typographie: [4, 7] }
}

const measurerLayer = Layer.succeed(Contracts.TextMeasurer, {
  measure: (_font: Text.FontDescriptorType, text: string) => Effect.succeed(text.length * 5)
})

const customHyphenationLayer = Layer.mergeAll(
  Text.WordSegmenterLive,
  Text.EngineProfileLive,
  Text.HyphenationDictionaryLive({ dictionaries }),
  Text.MeasurementCacheLive.pipe(Layer.provide(measurerLayer))
)

const builtInHyphenationLayer = Layer.mergeAll(
  Text.WordSegmenterLive,
  Text.EngineProfileLive,
  Text.HyphenationDictionaryLive(),
  Text.MeasurementCacheLive.pipe(Layer.provide(measurerLayer))
)

const noHyphenationLayer = Layer.mergeAll(
  Text.WordSegmenterLive,
  Text.EngineProfileLive,
  Text.NoHyphenationDictionaryLive,
  Text.MeasurementCacheLive.pipe(Layer.provide(measurerLayer))
)

describe("Text hyphenation contracts", () => {
  it.effect("applies custom dictionary hyphenation for each supported locale", () =>
    Effect.gen(function*() {
      const cases: ReadonlyArray<{
        expected: ReadonlyArray<Text.LayoutLineType>
        input: Text.PrepareInputType
        maxWidth: number
      }> = [
        {
          expected: [visualLine(0, "hy-", 15), visualLine(1, "phen-", 25), visualLine(2, "ation", 25)],
          input: {
            text: "hyphenation",
            font: { family: "Mono", size: 10 },
            hyphenationLocale: "en-US",
            whiteSpace: "normal"
          },
          maxWidth: 30
        },
        {
          expected: [visualLine(0, "colour-", 35), visualLine(1, "ation", 25)],
          input: {
            text: "colouration",
            font: { family: "Mono", size: 10 },
            hyphenationLocale: "en-gb",
            whiteSpace: "normal"
          },
          maxWidth: 35
        },
        {
          expected: [visualLine(0, "silben-", 35), visualLine(1, "tren-", 25), visualLine(2, "nung", 20)],
          input: {
            text: "silbentrennung",
            font: { family: "Mono", size: 10 },
            hyphenationLocale: "de",
            whiteSpace: "normal"
          },
          maxWidth: 35
        },
        {
          expected: [visualLine(0, "typo-", 25), visualLine(1, "gra-", 20), visualLine(2, "phie", 20)],
          input: {
            text: "typographie",
            font: { family: "Mono", size: 10 },
            hyphenationLocale: "fr",
            whiteSpace: "normal"
          },
          maxWidth: 25
        },
        {
          expected: [visualLine(0, "sep-", 20), visualLine(1, "arac-", 25), visualLine(2, "ion", 15)],
          input: {
            text: "separacion",
            font: { family: "Mono", size: 10 },
            hyphenationLocale: "es",
            whiteSpace: "normal"
          },
          maxWidth: 25
        }
      ]

      yield* Effect.forEach(
        cases,
        (testCase) =>
          Text.prepareWithSegments(testCase.input).pipe(
            Effect.provide(customHyphenationLayer),
            Effect.map((prepared) => Text.layoutLines(prepared, { maxWidth: testCase.maxWidth, lineHeight: 12 })),
            Effect.map((lines) => expect(lines).toEqual(testCase.expected))
          ),
        { discard: true }
      )
    }))

  it.effect("ships checked-in dictionaries for en-us, en-gb, de, fr, and es", () =>
    Effect.gen(function*() {
      const cases: ReadonlyArray<{
        expected: ReadonlyArray<Text.LayoutLineType>
        input: Text.PrepareInputType
        maxWidth: number
      }> = [
        {
          expected: [visualLine(0, "hy-", 15), visualLine(1, "phen-", 25), visualLine(2, "ation", 25)],
          input: {
            text: "hyphenation",
            font: { family: "Mono", size: 10 },
            hyphenationLocale: "en-us",
            whiteSpace: "normal"
          },
          maxWidth: 30
        },
        {
          expected: [visualLine(0, "colour-", 35), visualLine(1, "ation", 25)],
          input: {
            text: "colouration",
            font: { family: "Mono", size: 10 },
            hyphenationLocale: "en-gb",
            whiteSpace: "normal"
          },
          maxWidth: 35
        },
        {
          expected: [visualLine(0, "silben-", 35), visualLine(1, "tren-", 25), visualLine(2, "nung", 20)],
          input: {
            text: "silbentrennung",
            font: { family: "Mono", size: 10 },
            hyphenationLocale: "de",
            whiteSpace: "normal"
          },
          maxWidth: 35
        },
        {
          expected: [visualLine(0, "typo-", 25), visualLine(1, "gra-", 20), visualLine(2, "phie", 20)],
          input: {
            text: "typographie",
            font: { family: "Mono", size: 10 },
            hyphenationLocale: "fr",
            whiteSpace: "normal"
          },
          maxWidth: 25
        },
        {
          expected: [visualLine(0, "sepa-", 25), visualLine(1, "ra-", 15), visualLine(2, "cion", 20)],
          input: {
            text: "separacion",
            font: { family: "Mono", size: 10 },
            hyphenationLocale: "es",
            whiteSpace: "normal"
          },
          maxWidth: 25
        }
      ]

      yield* Effect.forEach(
        cases,
        (testCase) =>
          Text.prepareWithSegments(testCase.input).pipe(
            Effect.provide(builtInHyphenationLayer),
            Effect.map((prepared) => Text.layoutLines(prepared, { maxWidth: testCase.maxWidth, lineHeight: 12 })),
            Effect.map((lines) => expect(lines).toEqual(testCase.expected))
          ),
        { discard: true }
      )
    }))

  it.effect("treats explicit soft hyphens as authoritative while still allowing later dictionary breaks", () =>
    Effect.gen(function*() {
      const prepared = yield* Text.prepareWithSegments({
        text: "ultra\u00adcommunication",
        font: { family: "Mono", size: 10 },
        hyphenationLocale: "en-us",
        whiteSpace: "normal"
      }).pipe(Effect.provide(customHyphenationLayer))

      expect(Text.layoutLines(prepared, { maxWidth: 30, lineHeight: 12 })).toEqual([
        visualLine(0, "ultra-", 30),
        visualLine(1, "commu-", 30),
        visualLine(2, "nic-", 20),
        visualLine(3, "ation", 25)
      ])
    }))

  it.effect("composes dictionary hyphenation with punctuation-glued segments and mixed-direction projection", () =>
    Effect.gen(function*() {
      const request = { maxWidth: 40, lineHeight: 12 }
      const prepared = yield* Text.prepareWithSegments({
        text: "(colouration) שלום",
        font: { family: "Mono", size: 10 },
        hyphenationLocale: "en-gb",
        whiteSpace: "normal"
      }).pipe(Effect.provide(customHyphenationLayer))
      const lines = Text.layoutLines(prepared, request)
      const streamedLines = yield* Text.streamLines(prepared, request).pipe(
        Stream.runCollect,
        Effect.map(Chunk.toReadonlyArray)
      )

      expect(lines).toEqual(streamedLines)
      expect(Text.walkLineRanges(prepared, request)).toHaveLength(lines.length)
      expect(lines.some((line) => line.text.includes("-"))).toBe(true)
      expect(lines.every((line) => line.order === "visual")).toBe(true)
    }))

  it.effect("keeps dictionary hyphenation compatible with tabs and variable-width projection", () =>
    Effect.gen(function*() {
      const prepared = yield* Text.prepareWithSegments({
        text: "colouration\tbeta",
        font: { family: "Mono", size: 10 },
        hyphenationLocale: "en-gb",
        whiteSpace: "pre-wrap"
      }).pipe(Effect.provide(customHyphenationLayer))

      expect(
        Text.layoutLinesWith(prepared, { maxWidth: 60, lineHeight: 12 }, (lineIndex) => lineIndex === 0 ? 35 : 60)
      ).toEqual([
        visualLine(0, "colour-", 35),
        visualLine(1, "ation\tbeta", 60)
      ])
    }))

  it.effect("keeps dictionary hyphenation compatible with grapheme overflow fallback", () =>
    Effect.gen(function*() {
      const prepared = yield* Text.prepareWithSegments({
        text: "hyphenation",
        font: { family: "Mono", size: 10 },
        hyphenationLocale: "en-us",
        whiteSpace: "normal"
      }).pipe(Effect.provide(customHyphenationLayer))

      expect(Text.layoutLines(prepared, { maxWidth: 10, lineHeight: 12 })).toEqual([
        visualLine(0, "hy", 10),
        visualLine(1, "ph", 10),
        visualLine(2, "en", 10),
        visualLine(3, "at", 10),
        visualLine(4, "io", 10),
        visualLine(5, "n", 5)
      ])
    }))

  it.effect("falls back deterministically when a dictionary is unavailable", () =>
    Effect.gen(function*() {
      const input: Text.PrepareInputType = {
        text: "synchronization",
        font: { family: "Mono", size: 10 },
        hyphenationLocale: "it",
        whiteSpace: "normal"
      }
      const request = { maxWidth: 20, lineHeight: 12 }
      const dictionaryPrepared = yield* Text.prepareWithSegments(input).pipe(Effect.provide(customHyphenationLayer))
      const fallbackPrepared = yield* Text.prepareWithSegments(input).pipe(Effect.provide(noHyphenationLayer))

      expect(Text.layoutLines(dictionaryPrepared, request)).toEqual(Text.layoutLines(fallbackPrepared, request))
    }))

  it.effect("keeps cursor stepping stable when a word is broken by dictionary hyphenation", () =>
    Effect.gen(function*() {
      const request = { maxWidth: 35, lineHeight: 12 }
      const prepared = yield* Text.prepareWithSegments({
        text: "colouration",
        font: { family: "Mono", size: 10 },
        hyphenationLocale: "en-gb",
        whiteSpace: "normal"
      }).pipe(Effect.provide(customHyphenationLayer))
      const ranges = Text.walkLineRanges(prepared, request)
      const firstStep = Text.layoutNextLine(prepared, request, Text.initialCursor())
      const [firstLine, firstCursor] = Option.match(firstStep, {
        onNone: () => [visualLine(0, "", 0), Text.initialCursor()],
        onSome: (step) => step
      })
      const secondStep = Text.layoutNextLine(prepared, request, firstCursor)
      const [secondLine, secondCursor] = Option.match(secondStep, {
        onNone: () => [visualLine(1, "", 0), firstCursor],
        onSome: (step) => step
      })

      expect(Option.isSome(firstStep)).toBe(true)
      expect(Option.isSome(secondStep)).toBe(true)
      expect(firstLine).toEqual(visualLine(0, "colour-", 35))
      expect(firstCursor).toEqual(ranges[0]?.end)
      expect(secondLine).toEqual(visualLine(1, "ation", 25))
      expect(secondCursor).toEqual(ranges[1]?.end)
    }))

  it.effect("keeps hyphenation dictionary loading and cache refresh inside Layer-owned services", () =>
    Effect.gen(function*() {
      const loads = yield* Ref.make(0)
      const makeLayer = (revision: number) =>
        Layer.mergeAll(
          Text.WordSegmenterLive,
          Text.EngineProfileLive,
          Text.HyphenationDictionaryLive({
            loadDictionary: (locale) =>
              Ref.update(loads, (count) => count + 1).pipe(
                Effect.as(locale === "en-us" ? { hyphenation: [2, 6] } : {})
              ),
            revision
          }),
          Text.MeasurementCacheLive.pipe(Layer.provide(measurerLayer))
        )

      const prepareInput: Text.PrepareInputType = {
        text: "hyphenation hyphenation",
        font: { family: "Mono", size: 10 },
        hyphenationLocale: "en-us",
        whiteSpace: "normal"
      }
      const cachedLayerProgram = Effect.gen(function*() {
        yield* Text.prepareWithSegments(prepareInput)
        yield* Text.prepareWithSegments(prepareInput)
      })

      yield* cachedLayerProgram.pipe(Effect.provide(makeLayer(0)))
      expect(yield* Ref.get(loads)).toBe(1)

      yield* Text.prepareWithSegments(prepareInput).pipe(Effect.provide(makeLayer(1)))
      expect(yield* Ref.get(loads)).toBe(2)
    }))
})
