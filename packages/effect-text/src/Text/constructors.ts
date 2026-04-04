/**
 * Effectful text constructors.
 *
 * @since 0.1.0
 */
import { Effect, Option, ParseResult, Schema } from "effect"
import * as Arr from "effect/Array"

import {
  EngineProfile,
  HyphenationDictionary,
  MeasurementCache,
  type TextPreparationServices,
  WordSegmenter
} from "../contracts/index.js"
import { type MeasurementFailed, type PrepareError, TextLayoutDecodeError } from "../Errors/index.js"
import { normalizeHyphenationLocale } from "./internal/hyphenation.js"
import { prepareSegments, resolvePreparedBaseDirection } from "./internal/preparation.js"
import type {
  PreparedText,
  PreparedTextCore,
  PreparedTextLogicalSurfaceType,
  PreparedTextWithSegments,
  PreparedTextWithSegmentsCore
} from "./model.js"
import { preparedTextFromCore, preparedTextWithSegmentsFromCore } from "./model.js"
import { PrepareInput, type PrepareInputType } from "./schema.js"

type PreparedTextCompilation = Readonly<{
  core: PreparedTextCore
  logicalSurface: PreparedTextLogicalSurfaceType
}>

type HyphenationDictionaryCapabilities = Readonly<{
  hyphenateWord: (locale: string, word: string) => Effect.Effect<ReadonlyArray<number>>
  supportsLocale?: (locale: string) => Effect.Effect<boolean>
}>

const hyphenationLocaleIsAvailable = (
  dictionary: HyphenationDictionaryCapabilities,
  locale: string
): Effect.Effect<boolean> =>
  typeof dictionary.supportsLocale === "function"
    ? dictionary.supportsLocale(locale)
    : Effect.succeed(true)

const prepareCore = (
  input: PrepareInputType
): Effect.Effect<PreparedTextCompilation, MeasurementFailed, TextPreparationServices> =>
  Effect.gen(function*() {
    const segmenter = yield* WordSegmenter
    const cache = yield* MeasurementCache
    const engineProfile = yield* EngineProfile
    const hyphenationDictionaryOption = yield* Effect.serviceOption(HyphenationDictionary)
    const normalizedFont = { ...input.font, weight: input.font.weight ?? 400 }
    const hyphenationLocaleOption = Option.fromNullable(input.hyphenationLocale).pipe(
      Option.map(normalizeHyphenationLocale)
    )
    const dictionaryHyphenationActive = yield* Option.match(hyphenationLocaleOption, {
      onNone: () => Effect.succeed(false),
      onSome: (hyphenationLocale) =>
        Option.match(hyphenationDictionaryOption, {
          onNone: () => Effect.succeed(false),
          onSome: (dictionary) => hyphenationLocaleIsAvailable(dictionary, hyphenationLocale)
        })
    })
    const segmentedText = yield* segmenter.segment(input.text, input.whiteSpace)
    const baseDirection = resolvePreparedBaseDirection(input.text, engineProfile)
    const prepared = yield* prepareSegments(
      segmentedText,
      input.whiteSpace,
      engineProfile,
      baseDirection,
      (text) => cache.measure(normalizedFont, text),
      (word) =>
        !dictionaryHyphenationActive
          ? Effect.succeed(Arr.empty<number>())
          : Option.match(hyphenationLocaleOption, {
            onNone: () => Effect.succeed(Arr.empty<number>()),
            onSome: (hyphenationLocale) =>
              Option.match(hyphenationDictionaryOption, {
                onNone: () => Effect.succeed(Arr.empty<number>()),
                onSome: (dictionary) => dictionary.hyphenateWord(hyphenationLocale, word)
              })
          }),
      dictionaryHyphenationActive
    )

    return {
      core: {
        kernel: {
          baseDirection,
          lineFitEpsilon: engineProfile.lineFitEpsilon,
          preferEarlySoftHyphenBreak: engineProfile.preferEarlySoftHyphenBreak,
          runtime: prepared.kernelRuntime,
          whiteSpace: input.whiteSpace
        },
        meta: {
          font: normalizedFont,
          hyphenationLocale: Option.match(hyphenationLocaleOption, {
            onNone: () => undefined,
            onSome: (hyphenationLocale) => hyphenationLocale
          }),
          text: input.text
        }
      },
      logicalSurface: prepared.logicalSurface
    }
  })

/**
 * Compiles text into a prepared handle that retains segment-level manual layout metadata.
 *
 * @since 0.1.0
 * @category constructors
 */
export const prepareWithSegments = (
  input: PrepareInputType
): Effect.Effect<PreparedTextWithSegments, MeasurementFailed, TextPreparationServices> =>
  prepareCore(input).pipe(
    Effect.map((compilation) => {
      const core: PreparedTextWithSegmentsCore = {
        ...compilation.core,
        logicalSurface: compilation.logicalSurface
      }

      return preparedTextWithSegmentsFromCore(core)
    })
  )

/**
 * Compiles text into an opaque prepared handle.
 *
 * @since 0.1.0
 * @category constructors
 */
export const prepare = (
  input: PrepareInputType
): Effect.Effect<PreparedText, MeasurementFailed, TextPreparationServices> =>
  prepareCore(input).pipe(Effect.map((compilation) => preparedTextFromCore(compilation.core)))

/**
 * Decodes unknown input, then compiles it into a prepared handle.
 *
 * @since 0.1.0
 * @category constructors
 */
export const prepareUnknown = (
  input: unknown
): Effect.Effect<PreparedText, PrepareError, TextPreparationServices> =>
  Schema.decodeUnknown(PrepareInput)(input, { onExcessProperty: "error" }).pipe(
    Effect.mapError(
      (error) =>
        new TextLayoutDecodeError({
          reason: ParseResult.TreeFormatter.formatIssueSync(error.issue)
        })
    ),
    Effect.flatMap(prepare)
  )
