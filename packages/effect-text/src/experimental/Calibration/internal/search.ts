/**
 * Private calibration-search helpers.
 *
 * @internal
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

export const numericSearchScore = (report: CalibrationReportType): number =>
  (report.totalLineMismatchCount * DEFAULT_LINE_MISMATCH_WEIGHT) +
  (report.totalLineCountError * DEFAULT_LINE_COUNT_WEIGHT) +
  report.totalMaxLineWidthError

export const calibrationProfile = (name: string, engineProfile: EngineProfileType): CalibrationProfileType => ({
  name,
  engineProfile
})

export const floatOptions = (dimension: CalibrationFloatDimensionType): { readonly step?: number } =>
  Option.fromNullable(dimension.step).pipe(
    Option.match({
      onNone: () => ({}),
      onSome: (resolvedStep) => ({ step: resolvedStep })
    })
  )

export const intOptions = (dimension: CalibrationIntDimensionType): { readonly step?: number } =>
  Option.fromNullable(dimension.step).pipe(
    Option.match({
      onNone: () => ({}),
      onSome: (resolvedStep) => ({ step: resolvedStep })
    })
  )
