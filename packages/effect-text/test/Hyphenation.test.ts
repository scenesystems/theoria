import { describe, expect, it } from "@effect/vitest"
import { Effect, Layer, Match, MutableRef, Number, Option, Ref, Schema, Stream, String } from "effect"
import * as Arr from "effect/Array"
import * as Tuple from "effect/Tuple"

import { Hyphenation, MeasurementCache, Text, TextMeasurer } from "../src/index.js"

class HyphenationCase extends Schema.Class<HyphenationCase>("HyphenationContractCase")({
  expected: Text.Lines,
  input: Text.Input,
  maxWidth: Schema.Number
}) {}
const HyphenationCases = Schema.Array(HyphenationCase)
const emptyWords: Hyphenation.Words = {}

const visualLine = (index: number, text: string, width: number): Text.Line => ({
  baseDirection: "ltr",
  index,
  order: "visual",
  text,
  width
})

const dictionaries = {
  "en-us": Hyphenation.Dictionary.Words({
    words: { communication: Arr.make(5, 8), hyphenation: Arr.make(2, 6) }
  }),
  "en-gb": Hyphenation.Dictionary.Words({ words: { colouration: Arr.make(3, 6) } }),
  de: Hyphenation.Dictionary.Words({ words: { silbentrennung: Arr.make(6, 10) } }),
  es: Hyphenation.Dictionary.Words({ words: { separacion: Arr.make(3, 5, 7) } }),
  fr: Hyphenation.Dictionary.Words({ words: { typographie: Arr.make(4, 7) } })
}

const measurerLayer = Layer.succeed(TextMeasurer.TextMeasurer, {
  measure: (_font: Text.Font, text: string) => Effect.succeed(Number.multiply(String.length(text), 5))
})

const customHyphenationLayer = Layer.mergeAll(
  Text.layerSegmenter,
  Text.layerProfile,
  Hyphenation.layer(new Hyphenation.Options({ dictionaries })),
  MeasurementCache.layer.pipe(Layer.provide(measurerLayer))
)

const builtInHyphenationLayer = Layer.mergeAll(
  Text.layerSegmenter,
  Text.layerProfile,
  Hyphenation.layer(),
  MeasurementCache.layer.pipe(Layer.provide(measurerLayer))
)

const precedenceLayer = Layer.mergeAll(
  Text.layerSegmenter,
  Text.layerProfile,
  Hyphenation.layer(
    new Hyphenation.Options({
      dictionaries: { "en-gb": Hyphenation.Dictionary.Words({ words: { colour: Arr.of(3) } }) }
    })
  ),
  MeasurementCache.layer.pipe(Layer.provide(measurerLayer))
)

const normalizationLayer = Layer.mergeAll(
  Text.layerSegmenter,
  Text.layerProfile,
  Hyphenation.layer(
    new Hyphenation.Options({
      dictionaries: { fr: Hyphenation.Dictionary.Words({ words: { éducation: Arr.make(2, 5) } }) }
    })
  ),
  MeasurementCache.layer.pipe(Layer.provide(measurerLayer))
)

const narrowHyphenMeasurerLayer = Layer.succeed(TextMeasurer.TextMeasurer, {
  measure: (_font: Text.Font, text: string) =>
    Effect.succeed(
      Match.value(text).pipe(
        Match.when("-", () => 1),
        Match.orElse((value) => Number.multiply(String.length(value), 5))
      )
    )
})

const caseMappingLayer = Layer.mergeAll(
  Text.layerSegmenter,
  Text.layerProfile,
  Hyphenation.layer(
    new Hyphenation.Options({
      dictionaries: { tr: Hyphenation.Dictionary.Words({ words: { "i\u0307dea": Arr.of(3) } }) }
    })
  ),
  MeasurementCache.layer.pipe(Layer.provide(narrowHyphenMeasurerLayer))
)

const exceptionPatternLayer = Layer.mergeAll(
  Text.layerSegmenter,
  Text.layerProfile,
  Hyphenation.layer(
    new Hyphenation.Options({
      dictionaries: {
        "en-x": Hyphenation.Dictionary.Patterns({
          patterns: {
            id: "en-x",
            leftmin: 1,
            rightmin: 1,
            patterns: { "6": "a1bcde" },
            exceptions: "ab-cde"
          }
        })
      }
    })
  ),
  MeasurementCache.layer.pipe(Layer.provide(narrowHyphenMeasurerLayer))
)

const noHyphenationLayer = Layer.mergeAll(
  Text.layerSegmenter,
  Text.layerProfile,
  Hyphenation.layerNone,
  MeasurementCache.layer.pipe(Layer.provide(measurerLayer))
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
            Effect.map((prepared) => Text.lines(prepared, { maxWidth: testCase.maxWidth, lineHeight: 12 })),
            Effect.map((lines) => expect(lines).toEqual(testCase.expected))
          ),
        { discard: true }
      )
    }))

  it.effect("hyphenates words with the bundled English, German, French, and Spanish dictionaries", () =>
    Effect.gen(function*() {
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
            Effect.map((prepared) => Text.lines(prepared, { maxWidth: testCase.maxWidth, lineHeight: 12 })),
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

      expect(Text.lines(normalizedEnUs, { maxWidth: 30, lineHeight: 12 })).toEqual(Arr.make(
        visualLine(0, "hy-", 15),
        visualLine(1, "phen-", 25),
        visualLine(2, "ation", 25)
      ))
      expect(Text.lines(fallbackFrCa, { maxWidth: 25, lineHeight: 12 })).toEqual(Arr.make(
        visualLine(0, "typo-", 25),
        visualLine(1, "gra-", 20),
        visualLine(2, "phie", 20)
      ))
      expect(Text.lines(decomposedPrepared, { maxWidth: 25, lineHeight: 12 })).toEqual(Arr.make(
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

      expect(Text.lines(prepared, { maxWidth: 11, lineHeight: 12 })).toEqual(
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

      expect(Text.lines(prepared, { maxWidth: 30, lineHeight: 12 })).toEqual(Arr.make(
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

      expect(Text.lines(prepared, { maxWidth: 11, lineHeight: 12 })).toEqual(
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
      const lines = Text.lines(prepared, request)
      const streamedLines = yield* Text.stream(prepared, request).pipe(
        Stream.runCollect,
        Effect.map(Arr.fromIterable)
      )

      expect(lines).toEqual(streamedLines)
      expect(Text.ranges(prepared, request)).toHaveLength(Arr.length(lines))
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
        Text.linesWith(
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

      expect(Text.lines(prepared, { maxWidth: 10, lineHeight: 12 })).toEqual(Arr.make(
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
      const input: Text.Input = {
        text: "synchronization",
        font: { family: "Mono", size: 10 },
        hyphenationLocale: "it",
        whiteSpace: "normal"
      }
      const request = { maxWidth: 20, lineHeight: 12 }
      const dictionaryPrepared = yield* Text.prepareWithSegments(input).pipe(Effect.provide(customHyphenationLayer))
      const fallbackPrepared = yield* Text.prepareWithSegments(input).pipe(Effect.provide(noHyphenationLayer))

      expect(Text.lines(dictionaryPrepared, request)).toEqual(Text.lines(fallbackPrepared, request))
    }))

  it.effect("treats an explicit dictionary map as complete and declines omitted bundled locales", () =>
    Effect.gen(function*() {
      const explicitLayer = Layer.mergeAll(
        Text.layerSegmenter,
        Text.layerProfile,
        Hyphenation.layer(
          new Hyphenation.Options({
            dictionaries: {
              "en-x": Hyphenation.Dictionary.Words({ words: { hyphenation: Arr.make(2, 6) } })
            }
          })
        ),
        MeasurementCache.layer.pipe(Layer.provide(measurerLayer))
      )
      const prepared = yield* Text.prepareWithSegments({
        text: "hyphenation",
        font: { family: "Mono", size: 10 },
        hyphenationLocale: "en-us",
        whiteSpace: "normal"
      }).pipe(Effect.provide(explicitLayer))

      expect(Text.lines(prepared, { maxWidth: 30, lineHeight: 12 })).toEqual(
        Arr.make(visualLine(0, "hyphen", 30), visualLine(1, "ation", 25))
      )
    }))

  it.effect("prefers soft hyphens before dictionary and explicit break opportunities on overfull lines", () =>
    Effect.gen(function*() {
      const prepared = yield* Text.prepareWithSegments({
        text: "ultra\u00adcolour\u200bation",
        font: { family: "Mono", size: 10 },
        hyphenationLocale: "en-gb",
        whiteSpace: "normal"
      }).pipe(Effect.provide(precedenceLayer))
      const lines = Text.lines(prepared, { maxWidth: 60, lineHeight: 12 })

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
      const ranges = Text.ranges(prepared, request)
      const firstStep = Text.nextLine(prepared, request, Text.start)
      const firstResult = Option.match(firstStep, {
        onNone: () => Tuple.make(visualLine(0, "", 0), Text.start),
        onSome: (step) => step
      })
      const firstLine = Tuple.getFirst(firstResult)
      const firstCursor = Tuple.getSecond(firstResult)
      const secondStep = Text.nextLine(prepared, request, firstCursor)
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
          Option.getOrElse(() => Text.start)
        )
      )
      expect(secondLine).toEqual(visualLine(1, "ation", 25))
      expect(secondCursor).toEqual(
        Arr.get(ranges, 1).pipe(
          Option.map((range) => range.end),
          Option.getOrElse(() => Text.start)
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
        Text.layerSegmenter,
        Text.layerProfile,
        Layer.succeed(Hyphenation.Hyphenation, unavailableDictionary),
        MeasurementCache.layer.pipe(Layer.provide(measurerLayer))
      )
      const input: Text.Input = {
        text: "colouration",
        font: { family: "Mono", size: 10 },
        hyphenationLocale: "fr-ca",
        whiteSpace: "normal"
      }
      const unavailablePrepared = yield* Text.prepareWithSegments(input).pipe(Effect.provide(unavailableLayer))
      const fallbackPrepared = yield* Text.prepareWithSegments(input).pipe(Effect.provide(noHyphenationLayer))

      expect(yield* Ref.get(unsupportedLookups)).toBe(0)
      expect(Text.lines(unavailablePrepared, { maxWidth: 35, lineHeight: 12 })).toEqual(
        Text.lines(fallbackPrepared, { maxWidth: 35, lineHeight: 12 })
      )
    }))

  it.effect("keeps providers without supportsLocale compatible and requests their dictionary lazily", () =>
    Effect.gen(function*() {
      const lookups = yield* Ref.make(0)
      const compatibleDictionary = {
        hyphenateWord: (_locale: string, _word: string) =>
          Ref.update(lookups, Number.increment).pipe(Effect.as(Arr.make(3, 6)))
      }
      const compatibleLayer = Layer.mergeAll(
        Text.layerSegmenter,
        Text.layerProfile,
        Layer.succeed(Hyphenation.Hyphenation, compatibleDictionary),
        MeasurementCache.layer.pipe(Layer.provide(measurerLayer))
      )
      const prepared = yield* Text.prepareWithSegments({
        text: "colouration",
        font: { family: "Mono", size: 10 },
        hyphenationLocale: "en-gb",
        whiteSpace: "normal"
      }).pipe(Effect.provide(compatibleLayer))

      expect(yield* Ref.get(lookups)).toBe(1)
      expect(Text.lines(prepared, { maxWidth: 35, lineHeight: 12 })).toEqual(
        Arr.make(visualLine(0, "colour-", 35), visualLine(1, "ation", 25))
      )
    }))

  it.effect("keeps hyphenation dictionary loading and cache refresh inside Layer-owned services", () =>
    Effect.gen(function*() {
      const loads = yield* Ref.make(0)
      const makeLayer = (revision: number) =>
        Layer.mergeAll(
          Text.layerSegmenter,
          Text.layerProfile,
          Hyphenation.layer(
            new Hyphenation.Options({
              loadDictionary: (locale) =>
                Ref.update(loads, Number.increment).pipe(
                  Effect.as(
                    Match.value(locale).pipe(
                      Match.when("en-us", () =>
                        Hyphenation.Dictionary.Words({
                          words: { colouration: Arr.make(3, 6), hyphenation: Arr.make(2, 6) }
                        })),
                      Match.orElse(() => Hyphenation.Dictionary.Words({ words: emptyWords }))
                    )
                  )
                ),
              revision
            })
          ),
          MeasurementCache.layer.pipe(Layer.provide(measurerLayer))
        )

      const prepareInput: Text.Input = {
        text: "hyphenation colouration",
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

  it.effect("compiles static dictionary sources only when requested and reuses them across words", () =>
    Effect.gen(function*() {
      const sourceReads = MutableRef.make(0)
      const unusedReads = MutableRef.make(0)
      const layer = Layer.mergeAll(
        Text.layerSegmenter,
        Text.layerProfile,
        Hyphenation.layer(
          new Hyphenation.Options({
            dictionaries: {
              "EN_X": Hyphenation.Dictionary.Words({
                words: {
                  get hyphenation() {
                    MutableRef.incrementAndGet(sourceReads)
                    return Arr.make(2, 6)
                  },
                  colouration: Arr.make(3, 6)
                }
              }),
              fr: Hyphenation.Dictionary.Words({
                words: {
                  get typographie() {
                    MutableRef.incrementAndGet(unusedReads)
                    return Arr.make(4, 7)
                  }
                }
              })
            }
          })
        ),
        MeasurementCache.layer.pipe(Layer.provide(measurerLayer))
      )
      yield* Effect.gen(function*() {
        const plain = yield* Text.prepareWithSegments({
          text: "hyphenation",
          font: { family: "Mono", size: 10 },
          whiteSpace: "normal"
        })
        expect(Text.lines(plain, { maxWidth: 30, lineHeight: 12 })).toEqual(
          Arr.make(visualLine(0, "hyphen", 30), visualLine(1, "ation", 25))
        )
        expect(MutableRef.get(sourceReads)).toBe(0)
        expect(MutableRef.get(unusedReads)).toBe(0)

        const first = yield* Text.prepareWithSegments({
          text: "hyphenation",
          font: { family: "Mono", size: 10 },
          hyphenationLocale: "en-x",
          whiteSpace: "normal"
        })
        expect(Text.lines(first, { maxWidth: 30, lineHeight: 12 })).toEqual(
          Arr.make(visualLine(0, "hy-", 15), visualLine(1, "phen-", 25), visualLine(2, "ation", 25))
        )
        const readsAfterCompilation = MutableRef.get(sourceReads)
        expect(readsAfterCompilation).toBeGreaterThan(0)

        const second = yield* Text.prepareWithSegments({
          text: "colouration",
          font: { family: "Mono", size: 10 },
          hyphenationLocale: "EN_X",
          whiteSpace: "normal"
        })
        expect(Text.lines(second, { maxWidth: 35, lineHeight: 12 })).toEqual(
          Arr.make(visualLine(0, "colour-", 35), visualLine(1, "ation", 25))
        )
        expect(MutableRef.get(sourceReads)).toBe(readsAfterCompilation)
        expect(MutableRef.get(unusedReads)).toBe(0)
      }).pipe(Effect.provide(layer))
    }))

  it.effect("uses precompiled dictionaries from static options and effectful loaders", () =>
    Effect.gen(function*() {
      const compiled = Hyphenation.Dictionary.Compiled({
        hyphenateWord: (word: string) =>
          Match.value(word).pipe(
            Match.when("hyphenation", () => Arr.make(2, 6)),
            Match.orElse(() => Arr.empty<number>())
          )
      })
      yield* Effect.forEach(
        Arr.make(
          Hyphenation.layer(new Hyphenation.Options({ dictionaries: { "en-x": compiled } })),
          Hyphenation.layer(new Hyphenation.Options({ loadDictionary: () => Effect.succeed(compiled) }))
        ),
        (dictionary) =>
          Effect.gen(function*() {
            const prepared = yield* Text.prepareWithSegments({
              text: "hyphenation",
              font: { family: "Mono", size: 10 },
              hyphenationLocale: "en-x",
              whiteSpace: "normal"
            }).pipe(Effect.provide(Layer.mergeAll(
              Text.layerSegmenter,
              Text.layerProfile,
              dictionary,
              MeasurementCache.layer.pipe(Layer.provide(measurerLayer))
            )))
            expect(Text.lines(prepared, { maxWidth: 30, lineHeight: 12 })).toEqual(
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
      const lines = Text.lines(prepared, { maxWidth: 30, lineHeight: 12 })

      expect(Arr.length(lines)).toBeGreaterThan(20)
      expect(Arr.every(lines, (line) => Number.lessThanOrEqualTo(line.width, 30))).toBe(true)
    }))
})
