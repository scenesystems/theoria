/**
 * Effectful text constructors.
 *
 * @since 0.1.0
 */
import { Effect, ParseResult, Schema } from "effect"

import { EngineProfile, MeasurementCache, type TextPreparationServices, WordSegmenter } from "../contracts/index.js"
import { type MeasurementFailed, type PrepareError, TextLayoutDecodeError } from "../Errors/index.js"
import { prepareSegments, resolvePreparedBaseDirection } from "./internal/preparation.js"
import type { PreparedText, PreparedTextCore, PreparedTextWithSegments } from "./model.js"
import { preparedTextFromCore, preparedTextWithSegmentsFromCore } from "./model.js"
import { PrepareInput, type PrepareInputType } from "./schema.js"

const prepareCore = (
  input: PrepareInputType
): Effect.Effect<PreparedTextCore, MeasurementFailed, TextPreparationServices> =>
  Effect.gen(function*() {
    const segmenter = yield* WordSegmenter
    const cache = yield* MeasurementCache
    const engineProfile = yield* EngineProfile
    const normalizedFont = { ...input.font, weight: input.font.weight ?? 400 }
    const segmentedText = yield* segmenter.segment(input.text, input.whiteSpace)
    const baseDirection = resolvePreparedBaseDirection(input.text, engineProfile)
    const prepared = yield* prepareSegments(segmentedText, input.whiteSpace, engineProfile, baseDirection, (text) =>
      cache.measure(normalizedFont, text))

    return {
      text: input.text,
      font: normalizedFont,
      whiteSpace: input.whiteSpace,
      baseDirection,
      lineFitEpsilon: engineProfile.lineFitEpsilon,
      tabStopWidth: prepared.tabStopWidth,
      preferEarlySoftHyphenBreak: engineProfile.preferEarlySoftHyphenBreak,
      runtime: prepared.runtime,
      manualSurface: prepared.manualSurface
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
  prepareCore(input).pipe(Effect.map(preparedTextWithSegmentsFromCore))

/**
 * Compiles text into an opaque prepared handle.
 *
 * @since 0.1.0
 * @category constructors
 */
export const prepare = (
  input: PrepareInputType
): Effect.Effect<PreparedText, MeasurementFailed, TextPreparationServices> =>
  prepareCore(input).pipe(Effect.map(preparedTextFromCore))

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
