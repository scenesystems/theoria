/**
 * Private calibration-search helpers.
 *
 * @internal
 * @since 0.1.0
 */
import { Option } from "effect"

import type { EngineProfileType } from "../../../Text/schema.js"
import type {
  CalibrationFloatDimensionType,
  CalibrationIntDimensionType,
  CalibrationProfileType,
  CalibrationReportType,
  CalibrationSearchSpaceSpecType
} from "../schema.js"

const DEFAULT_LINE_MISMATCH_WEIGHT = 10_000
const DEFAULT_LINE_COUNT_WEIGHT = 1_000

/**
 * Default search-space authority for the shipped experimental calibration knobs.
 *
 * @since 0.1.0
 * @category internals
 */
export const defaultSearchSpaceSpec: CalibrationSearchSpaceSpecType = {
  lineFitEpsilon: {
    low: 0,
    high: 0.05,
    step: 0.001
  },
  tabWidth: {
    low: 2,
    high: 8,
    step: 1
  }
}

/**
 * Collapses a calibration report into the scalar score minimized by search.
 *
 * @since 0.1.0
 * @category internals
 */
export const numericSearchScore = (report: CalibrationReportType): number =>
  (report.totalLineMismatchCount * DEFAULT_LINE_MISMATCH_WEIGHT) +
  (report.totalLineCountError * DEFAULT_LINE_COUNT_WEIGHT) +
  report.totalMaxLineWidthError

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
