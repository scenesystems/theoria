/**
 * Compilation of engine-profile dimensions into Effect Search parameter spaces.
 *
 * @internal
 * @since 0.2.0
 */
import type { SearchSpace } from "@scenesystems/effect-search"
import { Array as Arr, Option } from "effect"

import type { EngineProfileType } from "../../../Text/schema.js"
import type {
  CalibrationBooleanDimensionType,
  CalibrationBooleansType,
  CalibrationDirectionDimensionType,
  CalibrationDirectionsType,
  CalibrationFloatDimensionType,
  CalibrationIntDimensionType,
  CalibrationObjectiveMetadataType,
  CalibrationProfileType,
  CalibrationSearchDescriptorType
} from "../schema.js"

const LTR_DIRECTION: EngineProfileType["defaultDirection"] = "ltr"
const RTL_DIRECTION: EngineProfileType["defaultDirection"] = "rtl"

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
 * Default dimensions for the experimental engine-profile search.
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
    values: Arr.make(LTR_DIRECTION, RTL_DIRECTION)
  },
  preferEarlySoftHyphenBreak: {
    values: Arr.make(false, true)
  },
  preferPrefixWidthsForBreakableRuns: {
    values: Arr.make(true, false)
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
export const floatOptions = (dimension: CalibrationFloatDimensionType): SearchSpace.FloatOptions =>
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
export const intOptions = (dimension: CalibrationIntDimensionType): SearchSpace.IntOptions =>
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
): CalibrationDirectionsType => dimension.values

/**
 * Unwrap a categorical boolean-dimension into the choices consumed by
 * `effect-search`.
 *
 * @since 0.2.0
 * @category internals
 */
export const booleanChoices = (
  dimension: CalibrationBooleanDimensionType
): CalibrationBooleansType => dimension.values
