/**
 * Private calibration-search helpers.
 *
 * @internal
 * @since 0.2.0
 */
import { Option } from "effect"

import type { EngineProfileType } from "../../../Text/schema.js"
import type {
  CalibrationBooleanDimensionType,
  CalibrationDirectionDimensionType,
  CalibrationFloatDimensionType,
  CalibrationIntDimensionType,
  CalibrationObjectiveMetadataType,
  CalibrationProfileType,
  CalibrationSearchDescriptorType
} from "../schema.js"

const choiceTuple = <Choice>(
  values: readonly [Choice, ...ReadonlyArray<Choice>]
): readonly [Choice, ...Array<Choice>] => {
  const [head, ...tail] = values
  return [head, ...tail]
}

/**
 * Explicit default score policy for experimental calibration studies.
 *
 * @since 0.2.0
 * @category internals
 */
export const defaultObjectiveMetadata: CalibrationObjectiveMetadataType = {
  name: "weighted-layout-fidelity",
  direction: "minimize",
  scorer: "weighted-sum",
  primaryMetric: "lineMismatchCount",
  secondaryMetric: "lineCountError",
  tertiaryMetric: "maxLineWidthError",
  scoreWeights: {
    lineMismatchCount: 10_000,
    lineCountError: 1_000,
    maxLineWidthError: 1
  }
}

/**
 * Default search-descriptor authority for the shipped experimental calibration knobs.
 *
 * @since 0.2.0
 * @category internals
 */
export const defaultSearchDescriptor: CalibrationSearchDescriptorType = {
  lineFitEpsilon: {
    low: 0,
    high: 0.05,
    step: 0.001
  },
  tabWidth: {
    low: 2,
    high: 8,
    step: 1
  },
  defaultDirection: {
    values: ["ltr", "rtl"]
  },
  preferEarlySoftHyphenBreak: {
    values: [false, true]
  },
  preferPrefixWidthsForBreakableRuns: {
    values: [true, false]
  }
}

/**
 * Wraps one engine profile in the experimental calibration profile shape.
 *
 * @since 0.1.0
 * @category internals
 */
export const calibrationProfile = (name: string, engineProfile: EngineProfileType): CalibrationProfileType => ({
  name,
  engineProfile
})

/**
 * Converts an optional float-dimension step into the search-space options object.
 *
 * @since 0.1.0
 * @category internals
 */
export const floatOptions = (dimension: CalibrationFloatDimensionType): { readonly step?: number } =>
  Option.fromNullable(dimension.step).pipe(
    Option.match({
      onNone: () => ({}),
      onSome: (resolvedStep) => ({ step: resolvedStep })
    })
  )

/**
 * Converts an optional int-dimension step into the search-space options object.
 *
 * @since 0.1.0
 * @category internals
 */
export const intOptions = (dimension: CalibrationIntDimensionType): { readonly step?: number } =>
  Option.fromNullable(dimension.step).pipe(
    Option.match({
      onNone: () => ({}),
      onSome: (resolvedStep) => ({ step: resolvedStep })
    })
  )

/**
 * Unwrap a categorical direction-dimension into the choices consumed by
 * `effect-search`.
 *
 * @since 0.2.0
 * @category internals
 */
export const directionChoices = (
  dimension: CalibrationDirectionDimensionType
): readonly [EngineProfileType["defaultDirection"], ...Array<EngineProfileType["defaultDirection"]>] =>
  choiceTuple(dimension.values)

/**
 * Unwrap a categorical boolean-dimension into the choices consumed by
 * `effect-search`.
 *
 * @since 0.2.0
 * @category internals
 */
export const booleanChoices = (
  dimension: CalibrationBooleanDimensionType
): readonly [boolean, ...Array<boolean>] => choiceTuple(dimension.values)
