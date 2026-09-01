/**
 * Defines the segmentation, measurement, caching, hyphenation, and engine
 * profile capabilities used to compile raw text into prepared handles.
 *
 * @remarks
 * `TextPreparationServices` is the required environment for preparation.
 * Provide `HyphenationDictionary` additionally when locale-aware dictionary
 * breaks should replace the deterministic no-dictionary path.
 *
 * @since 0.1.0
 */
import { Context } from "effect"
import type { Effect } from "effect"

import type { MeasurementFailed } from "../Errors/index.js"
import type { EngineProfileType, FontDescriptorType, TextSegmentType, WhiteSpaceModeType } from "../Text/schema.js"

/**
 * Declares preparation service contracts stable for compatibility guarantees.
 *
 * @since 0.1.0
 * @category stability
 */
export const ContractsStability = "stable"

/**
 * Splits source text into the logical segments consumed by preparation.
 *
 * @remarks
 * Implementations receive the whitespace mode and must preserve hard breaks.
 * Segmentation does not perform shaping or visual bidi reordering.
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
 * Measures the advance width of a string rendered with a font descriptor.
 *
 * @remarks
 * Preparation may measure complete runs, prefixes, graphemes, tabs, and
 * discretionary hyphens. Implementations report unavailable measurements as
 * `MeasurementFailed` rather than defects.
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
 * Memoizing measurement seam used by preparation.
 *
 * @remarks
 * `measure` has the same result and typed failure as `TextMeasurer.measure`;
 * cache identity must include every input that can change a width.
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
 * Optional hyphenation seam used while preparing locale-aware text.
 *
 * @remarks
 * The service stays effectful so dictionaries can be loaded, cached, or
 * refreshed behind `Layer` ownership while the layout walker remains pure.
 *
 * @since 0.2.0
 * @category services
 */
export class HyphenationDictionary extends Context.Tag("effect-text/HyphenationDictionary")<
  HyphenationDictionary,
  {
    readonly hyphenateWord: (locale: string, word: string) => Effect.Effect<ReadonlyArray<number>>
  }
>() {}

/**
 * Supplies fit tolerance, tab width, fallback direction, and break preferences
 * while compiling a prepared handle.
 *
 * @since 0.1.0
 * @category services
 */
export class EngineProfile extends Context.Tag("effect-text/EngineProfile")<
  EngineProfile,
  EngineProfileType
>() {}

/**
 * Required Effect environment for `Text.prepare` and
 * `Text.prepareWithSegments`.
 *
 * @remarks
 * Optional hyphenation dictionaries may also be provided through
 * `Contracts.HyphenationDictionary`; when absent, preparation falls back to
 * the deterministic non-dictionary break path.
 *
 * @since 0.1.0
 * @category models
 */
export type TextPreparationServices = WordSegmenter | MeasurementCache | EngineProfile
