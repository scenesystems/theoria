/**
 * Effectful text constructors.
 *
 * @since 0.1.0
 */
import { Data, Effect, Option, ParseResult, Schema } from "effect"
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

class PreparedTextCompilation extends Data.Class<{
  core: PreparedTextCore
  logicalSurface: PreparedTextLogicalSurfaceType
}> {}

class HyphenationDictionaryCapabilities extends Data.Class<{
  hyphenateWord: (locale: string, word: string) => Effect.Effect<ReadonlyArray<number>>
  supportsLocale?: (locale: string) => Effect.Effect<boolean>
}> {}

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
          ...Option.match(hyphenationLocaleOption, {
            onNone: () => ({}),
            onSome: (hyphenationLocale) => ({ hyphenationLocale })
          }),
          text: input.text
        }
      },
      logicalSurface: prepared.logicalSurface
    }
  })

/**
 * Segments and measures text once, retaining the logical surface required for
 * visually ordered lines, ranges, cursors, and streams.
 *
 * @remarks
 * Requires `WordSegmenter`, `MeasurementCache`, and `EngineProfile`. An
 * available `HyphenationDictionary` is used only with `hyphenationLocale`;
 * otherwise preparation uses the non-dictionary break path.
 *
 * @example
 * ```ts
 * import { Array, Effect, Option } from "effect"
 * import { Text } from "@scenesystems/effect-text"
 *
 * export const program = Effect.gen(function*() {
 *   const prepared = yield* Text.prepareWithSegments({
 *     text: "alpha beta",
 *     font: { family: "Mono", size: 16 },
 *     whiteSpace: "normal"
 *   })
 *   const lines = Text.layoutLines(prepared, { maxWidth: 160, lineHeight: 20 })
 *   const first = yield* Option.match(Array.head(lines), {
 *     onNone: () => Effect.fail("MissingLayoutLine"),
 *     onSome: Effect.succeed
 *   })
 *
 *   return yield* Effect.succeed(first).pipe(
 *     Effect.filterOrFail(
 *       ({ text }) => text === "alpha beta",
 *       () => "UnexpectedLayoutText"
 *     )
 *   )
 * }).pipe(Effect.provide(Text.TextLayoutLive))
 * ```
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
 * Segments and measures text into an opaque summary-only handle.
 *
 * @remarks
 * The result supports `layout` and `measureNaturalWidth`; use
 * `prepareWithSegments` when line text or cursor bounds are needed.
 *
 * @since 0.1.0
 * @category constructors
 */
export const prepare = (
  input: PrepareInputType
): Effect.Effect<PreparedText, MeasurementFailed, TextPreparationServices> =>
  prepareCore(input).pipe(Effect.map((compilation) => preparedTextFromCore(compilation.core)))

/**
 * Strictly decodes unknown input, then performs the same compilation as
 * `prepare`.
 *
 * @remarks
 * Invalid or excess fields fail with `TextLayoutDecodeError`; successful
 * decoding can still fail with `MeasurementFailed`.
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
