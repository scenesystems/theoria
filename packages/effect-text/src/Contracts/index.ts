/**
 * Stable service contracts for effect-text runtime seams.
 *
 * @since 0.1.0
 */
import { Context } from "effect"
import type { Effect } from "effect"

import type { MeasurementFailed } from "../Errors/index.js"
import type { EngineProfileType, FontDescriptorType, TextSegmentType, WhiteSpaceModeType } from "../Text/schema.js"

/**
 * Stability lane for the Contracts namespace.
 *
 * @since 0.1.0
 * @category stability
 */
export const ContractsStability = "stable"

/**
 * Segmentation service seam.
 *
 * @since 0.1.0
 * @category services
 */
export class WordSegmenter extends Context.Tag("effect-text/WordSegmenter")<
  WordSegmenter,
  {
    readonly segment: (
      text: string,
      whiteSpace: WhiteSpaceModeType
    ) => Effect.Effect<ReadonlyArray<TextSegmentType>>
  }
>() {}

/**
 * Raw text measurement service seam.
 *
 * @since 0.1.0
 * @category services
 */
export class TextMeasurer extends Context.Tag("effect-text/TextMeasurer")<
  TextMeasurer,
  {
    readonly measure: (
      font: FontDescriptorType,
      text: string
    ) => Effect.Effect<number, MeasurementFailed>
  }
>() {}

/**
 * Shared measurement cache seam.
 *
 * @since 0.1.0
 * @category services
 */
export class MeasurementCache extends Context.Tag("effect-text/MeasurementCache")<
  MeasurementCache,
  {
    readonly measure: (
      font: FontDescriptorType,
      text: string
    ) => Effect.Effect<number, MeasurementFailed>
  }
>() {}

/**
 * Runtime profile seam for layout quirks.
 *
 * @since 0.1.0
 * @category services
 */
export class EngineProfile extends Context.Tag("effect-text/EngineProfile")<
  EngineProfile,
  EngineProfileType
>() {}

/**
 * Environment required by `Text.prepare`.
 *
 * @since 0.1.0
 * @category models
 */
export type TextPreparationServices = WordSegmenter | MeasurementCache | EngineProfile
