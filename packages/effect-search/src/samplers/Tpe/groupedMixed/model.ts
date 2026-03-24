/**
 * Grouped mixed settings model — multivariate and group-dimensions feature flags.
 *
 * @since 0.1.0
 */
import { Data } from "effect"

/** @since 0.1.0 */
export class GroupedMixedSettings extends Data.Class<{
  readonly multivariate: boolean
  readonly groupDimensions: boolean
}> {}
