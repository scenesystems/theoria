/**
 * Shared helpers for extracting values from Option types with fallback defaults.
 *
 * @since 0.1.0
 */
import { Option } from "effect"

/**
 * Extracts a numeric option value, falling back to the provided default.
 *
 * @since 0.1.0
 * @category utils
 */
export const numberOptionOr = (value: Option.Option<number>, fallback: number): number =>
  Option.getOrElse(value, () => fallback)

/**
 * Extracts a boolean option value, falling back to the provided default.
 *
 * @since 0.1.0
 * @category utils
 */
export const booleanOptionOr = (value: Option.Option<boolean>, fallback: boolean): boolean =>
  Option.getOrElse(value, () => fallback)
