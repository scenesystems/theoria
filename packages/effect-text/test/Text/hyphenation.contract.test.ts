import { describe, expect, it } from "@effect/vitest"
import { Effect, Layer, Match, Number, Option, Ref, Schema, Stream, String } from "effect"
import * as Arr from "effect/Array"
import * as Tuple from "effect/Tuple"

import { Contracts, Text } from "../../src/index.js"

const WordBreakDictionary = Schema.Record({ key: Schema.String, value: Contracts.HyphenationBreakPoints })
const LocaleWordBreakDictionaries = Schema.Record({ key: Schema.String, value: WordBreakDictionary })

class HyphenationCase extends Schema.Class<HyphenationCase>("HyphenationContractCase")({
  expected: Schema.Array(Text.LayoutLine),
  input: Text.PrepareInput,
  maxWidth: Schema.Number
}) {}
const HyphenationCases = Schema.Array(HyphenationCase)
const emptyWordBreakDictionary: typeof WordBreakDictionary.Type = {}

const visualLine = (index: number, text: string, width: number): Text.LayoutLineType => ({
  baseDirection: "ltr",
  index,
  order: "visual",
  text,
  width
})

const dictionaries: typeof LocaleWordBreakDictionaries.Type = {
  "en-us": { communication: Arr.make(5, 8), hyphenation: Arr.make(2, 6) },
  "en-gb": { colouration: Arr.make(3, 6) },
  de: { silbentrennung: Arr.make(6, 10) },
  es: { separacion: Arr.make(3, 5, 7) },
  fr: { typographie: Arr.make(4, 7) }
}

const measurerLayer = Layer.succeed(Contracts.TextMeasurer, {
  measure: (_font: Text.FontDescriptorType, text: string) => Effect.succeed(Number.multiply(String.length(text), 5))
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

const precedenceLayer = Layer.mergeAll(
  Text.WordSegmenterLive,
  Text.EngineProfileLive,
  Text.HyphenationDictionaryLive({ dictionaries: { "en-gb": { colour: Arr.of(3) } } }),
  Text.MeasurementCacheLive.pipe(Layer.provide(measurerLayer))
)

const normalizationLayer = Layer.mergeAll(
  Text.WordSegmenterLive,
  Text.EngineProfileLive,
  Text.HyphenationDictionaryLive({ dictionaries: { fr: { éducation: Arr.make(2, 5) } } }),
  Text.MeasurementCacheLive.pipe(Layer.provide(measurerLayer))
)

const narrowHyphenMeasurerLayer = Layer.succeed(Contracts.TextMeasurer, {
  measure: (_font: Text.FontDescriptorType, text: string) =>
    Effect.succeed(
      Match.value(text).pipe(
        Match.when("-", () => 1),
        Match.orElse((value) => Number.multiply(String.length(value), 5))
      )
    )
})

const caseMappingLayer = Layer.mergeAll(
  Text.WordSegmenterLive,
  Text.EngineProfileLive,
  Text.HyphenationDictionaryLive({ dictionaries: { tr: { "i\u0307dea": Arr.of(3) } } }),
  Text.MeasurementCacheLive.pipe(Layer.provide(narrowHyphenMeasurerLayer))
)

const exceptionPatternLayer = Layer.mergeAll(
  Text.WordSegmenterLive,
  Text.EngineProfileLive,
  Text.HyphenationDictionaryLive({
    dictionaries: {
      "en-x": {
        id: "en-x",
        leftmin: 1,
        rightmin: 1,
        patterns: { "6": "a1bcde" },
        exceptions: "ab-cde"
      }
    }
  }),
  Text.MeasurementCacheLive.pipe(Layer.provide(narrowHyphenMeasurerLayer))
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
      const cases: typeof HyphenationCases.Type = Arr.make(
        new HyphenationCase({
          expected: Arr.make(visualLine(0, "hy-", 15), visualLine(1, "phen-", 25), visualLine(2, "ation", 25)),
          input: {
            text: "hyphenation",
            font: { family: "Mono", size: 10 },
            hyphenationLocale: "en-US",
            whiteSpace: "normal"
          },
          maxWidth: 30
        }),
        new HyphenationCase({
          expected: Arr.make(visualLine(0, "colour-", 35), visualLine(1, "ation", 25)),
          input: {
            text: "colouration",
            font: { family: "Mono", size: 10 },
            hyphenationLocale: "en-gb",
            whiteSpace: "normal"
          },
          maxWidth: 35
        }),
        new HyphenationCase({
          expected: Arr.make(visualLine(0, "silben-", 35), visualLine(1, "tren-", 25), visualLine(2, "nung", 20)),
          input: {
            text: "silbentrennung",
            font: { family: "Mono", size: 10 },
            hyphenationLocale: "de",
            whiteSpace: "normal"
          },
          maxWidth: 35
        }),
        new HyphenationCase({
          expected: Arr.make(visualLine(0, "typo-", 25), visualLine(1, "gra-", 20), visualLine(2, "phie", 20)),
          input: {
            text: "typographie",
            font: { family: "Mono", size: 10 },
            hyphenationLocale: "fr",
            whiteSpace: "normal"
          },
          maxWidth: 25
        }),
        new HyphenationCase({
          expected: Arr.make(visualLine(0, "sep-", 20), visualLine(1, "arac-", 25), visualLine(2, "ion", 15)),
          input: {
            text: "separacion",
            font: { family: "Mono", size: 10 },
            hyphenationLocale: "es",
            whiteSpace: "normal"
          },
          maxWidth: 25
        })
      )

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
      expect(Text.HyphenationSupport).toEqual({
        localeFallback: "exact-or-base-language",
        locales: Arr.make("en-us", "en-gb", "de", "fr", "es")
      })

      const cases: typeof HyphenationCases.Type = Arr.make(
        new HyphenationCase({
          expected: Arr.make(visualLine(0, "hy-", 15), visualLine(1, "phen-", 25), visualLine(2, "ation", 25)),
          input: {
            text: "hyphenation",
            font: { family: "Mono", size: 10 },
            hyphenationLocale: "en-us",
            whiteSpace: "normal"
          },
          maxWidth: 30
        }),
        new HyphenationCase({
          expected: Arr.make(visualLine(0, "colour-", 35), visualLine(1, "ation", 25)),
          input: {
            text: "colouration",
            font: { family: "Mono", size: 10 },
            hyphenationLocale: "en-gb",
            whiteSpace: "normal"
          },
          maxWidth: 35
        }),
        new HyphenationCase({
          expected: Arr.make(visualLine(0, "silben-", 35), visualLine(1, "tren-", 25), visualLine(2, "nung", 20)),
          input: {
            text: "silbentrennung",
            font: { family: "Mono", size: 10 },
            hyphenationLocale: "de",
            whiteSpace: "normal"
          },
          maxWidth: 35
        }),
        new HyphenationCase({
          expected: Arr.make(visualLine(0, "typo-", 25), visualLine(1, "gra-", 20), visualLine(2, "phie", 20)),
          input: {
            text: "typographie",
            font: { family: "Mono", size: 10 },
            hyphenationLocale: "fr",
            whiteSpace: "normal"
          },
          maxWidth: 25
        }),
        new HyphenationCase({
          expected: Arr.make(visualLine(0, "sepa-", 25), visualLine(1, "ra-", 15), visualLine(2, "cion", 20)),
          input: {
            text: "separacion",
            font: { family: "Mono", size: 10 },
            hyphenationLocale: "es",
            whiteSpace: "normal"
          },
          maxWidth: 25
        })
      )

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

  it.effect("normalizes locale spellings, falls back from tagged variants, and preserves decomposed source text", () =>
    Effect.gen(function*() {
      const normalizedEnUs = yield* Text.prepareWithSegments({
        text: "hyphenation",
        font: { family: "Mono", size: 10 },
        hyphenationLocale: "EN_US",
        whiteSpace: "normal"
      }).pipe(Effect.provide(builtInHyphenationLayer))
      const fallbackFrCa = yield* Text.prepareWithSegments({
        text: "typographie",
        font: { family: "Mono", size: 10 },
        hyphenationLocale: "fr-CA",
        whiteSpace: "normal"
      }).pipe(Effect.provide(builtInHyphenationLayer))
      const decomposedPrepared = yield* Text.prepareWithSegments({
        text: "e\u0301ducation",
        font: { family: "Mono", size: 10 },
        hyphenationLocale: "fr_CA",
        whiteSpace: "normal"
      }).pipe(Effect.provide(normalizationLayer))

      expect(Text.layoutLines(normalizedEnUs, { maxWidth: 30, lineHeight: 12 })).toEqual(Arr.make(
        visualLine(0, "hy-", 15),
        visualLine(1, "phen-", 25),
        visualLine(2, "ation", 25)
      ))
      expect(Text.layoutLines(fallbackFrCa, { maxWidth: 25, lineHeight: 12 })).toEqual(Arr.make(
        visualLine(0, "typo-", 25),
        visualLine(1, "gra-", 20),
        visualLine(2, "phie", 20)
      ))
      expect(Text.layoutLines(decomposedPrepared, { maxWidth: 25, lineHeight: 12 })).toEqual(Arr.make(
        visualLine(0, "e\u0301d-", 20),
        visualLine(1, "uca-", 20),
        visualLine(2, "tion", 20)
      ))
    }))

  it.effect("maps lowercase expansion breakpoints back to original UTF-16 spelling", () =>
    Effect.gen(function*() {
      const prepared = yield* Text.prepareWithSegments({
        text: "İdea",
        font: { family: "Mono", size: 10 },
        hyphenationLocale: "tr",
        whiteSpace: "normal"
      }).pipe(Effect.provide(caseMappingLayer))

      expect(Text.layoutLines(prepared, { maxWidth: 11, lineHeight: 12 })).toEqual(
        Arr.make(visualLine(0, "İd-", 11), visualLine(1, "ea", 10))
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

      expect(Text.layoutLines(prepared, { maxWidth: 30, lineHeight: 12 })).toEqual(Arr.make(
        visualLine(0, "ultra-", 30),
        visualLine(1, "commu-", 30),
        visualLine(2, "nic-", 20),
        visualLine(3, "ation", 25)
      ))
    }))

  it.effect("uses explicit pattern exceptions before matching Liang pattern points", () =>
    Effect.gen(function*() {
      const prepared = yield* Text.prepareWithSegments({
        text: "abcde",
        font: { family: "Mono", size: 10 },
        hyphenationLocale: "en-x",
        whiteSpace: "normal"
      }).pipe(Effect.provide(exceptionPatternLayer))

      expect(Text.layoutLines(prepared, { maxWidth: 11, lineHeight: 12 })).toEqual(
        Arr.make(visualLine(0, "ab-", 11), visualLine(1, "cd", 10), visualLine(2, "e", 5))
      )
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
        Effect.map(Arr.fromIterable)
      )

      expect(lines).toEqual(streamedLines)
      expect(Text.walkLineRanges(prepared, request)).toHaveLength(Arr.length(lines))
      expect(Arr.some(lines, (line) => String.includes("-")(line.text))).toBe(true)
      expect(Arr.every(lines, (line) => String.Equivalence(line.order, "visual"))).toBe(true)
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
        Text.layoutLinesWith(
          prepared,
          { maxWidth: 60, lineHeight: 12 },
          (lineIndex) =>
            Match.value(lineIndex).pipe(
              Match.when(0, () => 35),
              Match.orElse(() => 60)
            )
        )
      ).toEqual(Arr.make(
        visualLine(0, "colour-", 35),
        visualLine(1, "ation\tbeta", 60)
      ))
    }))

  it.effect("keeps dictionary hyphenation compatible with grapheme overflow fallback", () =>
    Effect.gen(function*() {
      const prepared = yield* Text.prepareWithSegments({
        text: "hyphenation",
        font: { family: "Mono", size: 10 },
        hyphenationLocale: "en-us",
        whiteSpace: "normal"
      }).pipe(Effect.provide(customHyphenationLayer))

      expect(Text.layoutLines(prepared, { maxWidth: 10, lineHeight: 12 })).toEqual(Arr.make(
        visualLine(0, "hy", 10),
        visualLine(1, "ph", 10),
        visualLine(2, "en", 10),
        visualLine(3, "at", 10),
        visualLine(4, "io", 10),
        visualLine(5, "n", 5)
      ))
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

  it.effect("prefers soft hyphens before dictionary and explicit break opportunities on overfull lines", () =>
    Effect.gen(function*() {
      const prepared = yield* Text.prepareWithSegments({
        text: "ultra\u00adcolour\u200bation",
        font: { family: "Mono", size: 10 },
        hyphenationLocale: "en-gb",
        whiteSpace: "normal"
      }).pipe(Effect.provide(precedenceLayer))
      const lines = Text.layoutLines(prepared, { maxWidth: 60, lineHeight: 12 })

      expect(Arr.head(lines).pipe(Option.getOrElse(() => visualLine(0, "", 0)))).toEqual(
        visualLine(0, "ultra-", 30)
      )
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
      const firstResult = Option.match(firstStep, {
        onNone: () => Tuple.make(visualLine(0, "", 0), Text.initialCursor()),
        onSome: (step) => step
      })
      const firstLine = Tuple.getFirst(firstResult)
      const firstCursor = Tuple.getSecond(firstResult)
      const secondStep = Text.layoutNextLine(prepared, request, firstCursor)
      const secondResult = Option.match(secondStep, {
        onNone: () => Tuple.make(visualLine(1, "", 0), firstCursor),
        onSome: (step) => step
      })
      const secondLine = Tuple.getFirst(secondResult)
      const secondCursor = Tuple.getSecond(secondResult)

      expect(Option.isSome(firstStep)).toBe(true)
      expect(Option.isSome(secondStep)).toBe(true)
      expect(firstLine).toEqual(visualLine(0, "colour-", 35))
      expect(firstCursor).toEqual(
        Arr.get(ranges, 0).pipe(
          Option.map((range) => range.end),
          Option.getOrElse(Text.initialCursor)
        )
      )
      expect(secondLine).toEqual(visualLine(1, "ation", 25))
      expect(secondCursor).toEqual(
        Arr.get(ranges, 1).pipe(
          Option.map((range) => range.end),
          Option.getOrElse(Text.initialCursor)
        )
      )
    }))

  it.effect("separates requested hyphenation from available locale capability", () =>
    Effect.gen(function*() {
      const unsupportedLookups = yield* Ref.make(0)
      const unavailableDictionary = {
        hyphenateWord: (_locale: string, _word: string) =>
          Ref.update(unsupportedLookups, Number.increment).pipe(Effect.as(Arr.of(3))),
        supportsLocale: () => Effect.succeed(false)
      }
      const unavailableLayer = Layer.mergeAll(
        Text.WordSegmenterLive,
        Text.EngineProfileLive,
        Layer.succeed(Contracts.HyphenationDictionary, unavailableDictionary),
        Text.MeasurementCacheLive.pipe(Layer.provide(measurerLayer))
      )
      const input: Text.PrepareInputType = {
        text: "colouration",
        font: { family: "Mono", size: 10 },
        hyphenationLocale: "fr-ca",
        whiteSpace: "normal"
      }
      const unavailablePrepared = yield* Text.prepareWithSegments(input).pipe(Effect.provide(unavailableLayer))
      const fallbackPrepared = yield* Text.prepareWithSegments(input).pipe(Effect.provide(noHyphenationLayer))

      expect(yield* Ref.get(unsupportedLookups)).toBe(0)
      expect(Text.layoutLines(unavailablePrepared, { maxWidth: 35, lineHeight: 12 })).toEqual(
        Text.layoutLines(fallbackPrepared, { maxWidth: 35, lineHeight: 12 })
      )
    }))

  it.effect("keeps providers without supportsLocale compatible and requests their dictionary lazily", () =>
    Effect.gen(function*() {
      const lookups = yield* Ref.make(0)
      const compatibleDictionary: Contracts.HyphenationDictionaryApi = {
        hyphenateWord: (_locale, _word) => Ref.update(lookups, Number.increment).pipe(Effect.as(Arr.make(3, 6)))
      }
      const compatibleLayer = Layer.mergeAll(
        Text.WordSegmenterLive,
        Text.EngineProfileLive,
        Layer.succeed(Contracts.HyphenationDictionary, compatibleDictionary),
        Text.MeasurementCacheLive.pipe(Layer.provide(measurerLayer))
      )
      const prepared = yield* Text.prepareWithSegments({
        text: "colouration",
        font: { family: "Mono", size: 10 },
        hyphenationLocale: "en-gb",
        whiteSpace: "normal"
      }).pipe(Effect.provide(compatibleLayer))

      expect(yield* Ref.get(lookups)).toBe(1)
      expect(Text.layoutLines(prepared, { maxWidth: 35, lineHeight: 12 })).toEqual(
        Arr.make(visualLine(0, "colour-", 35), visualLine(1, "ation", 25))
      )
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
              Ref.update(loads, Number.increment).pipe(
                Effect.as(
                  Match.value(locale).pipe(
                    Match.when("en-us", () => ({ hyphenation: Arr.make(2, 6) })),
                    Match.orElse(() => emptyWordBreakDictionary)
                  )
                )
              ),
            revision
          }),
          Text.MeasurementCacheLive.pipe(Layer.provide(measurerLayer))
        )

      const prepareInput: Text.PrepareInputType = {
        text: "hyphenation hyphenation",
        font: { family: "Mono", size: 10 },
        hyphenationLocale: "EN_US",
        whiteSpace: "normal"
      }
      const cachedLayerProgram = Effect.gen(function*() {
        yield* Text.prepareWithSegments(prepareInput)
        yield* Text.prepareWithSegments(prepareInput)
      })

      yield* Text.prepareWithSegments({
        text: "hyphenation",
        font: { family: "Mono", size: 10 },
        whiteSpace: "normal"
      }).pipe(Effect.provide(makeLayer(0)))
      expect(yield* Ref.get(loads)).toBe(0)

      yield* cachedLayerProgram.pipe(Effect.provide(makeLayer(0)))
      expect(yield* Ref.get(loads)).toBe(1)

      yield* Text.prepareWithSegments(prepareInput).pipe(Effect.provide(makeLayer(1)))
      expect(yield* Ref.get(loads)).toBe(2)
    }))

  it.effect("uses precompiled dictionaries from static options and effectful loaders", () =>
    Effect.gen(function*() {
      const compiled = {
        hyphenateWord: (word: string) =>
          Match.value(word).pipe(
            Match.when("hyphenation", () => Arr.make(2, 6)),
            Match.orElse(() => Arr.empty<number>())
          )
      }
      yield* Effect.forEach(
        Arr.make(
          Text.HyphenationDictionaryLive({ dictionaries: { "en-x": compiled } }),
          Text.HyphenationDictionaryLive({ loadDictionary: () => Effect.succeed(compiled) })
        ),
        (dictionary) =>
          Effect.gen(function*() {
            const prepared = yield* Text.prepareWithSegments({
              text: "hyphenation",
              font: { family: "Mono", size: 10 },
              hyphenationLocale: "en-x",
              whiteSpace: "normal"
            }).pipe(Effect.provide(Layer.mergeAll(
              Text.WordSegmenterLive,
              Text.EngineProfileLive,
              dictionary,
              Text.MeasurementCacheLive.pipe(Layer.provide(measurerLayer))
            )))
            expect(Text.layoutLines(prepared, { maxWidth: 30, lineHeight: 12 })).toEqual(
              Arr.make(visualLine(0, "hy-", 15), visualLine(1, "phen-", 25), visualLine(2, "ation", 25))
            )
          })
      )
    }))

  it.effect("keeps cold-word hyphenation stack-safe on long supported words", () =>
    Effect.gen(function*() {
      const prepared = yield* Text.prepareWithSegments({
        text: String.repeat(96)("communication"),
        font: { family: "Mono", size: 10 },
        hyphenationLocale: "en-us",
        whiteSpace: "normal"
      }).pipe(Effect.provide(builtInHyphenationLayer))
      const lines = Text.layoutLines(prepared, { maxWidth: 30, lineHeight: 12 })

      expect(Arr.length(lines)).toBeGreaterThan(20)
      expect(Arr.every(lines, (line) => Number.lessThanOrEqualTo(line.width, 30))).toBe(true)
    }))
})
