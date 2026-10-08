/** DSPy maxErrors raises when the count reaches the limit. The study primitive
 * counts allowed failures instead, so its limit is one smaller. Zero still
 * permits successful execution but raises on the first failure, as DSPy does.
 * @internal
 */
import * as Numeric from "@scenesystems/effect-math/Numeric"
import { Option } from "effect"

/** DSPy optimizers inherit settings.max_errors=10 when max_errors is absent/None. */
export const effectiveMaxErrors = (maxErrors: Option.Option<number>): Option.Option<number> =>
  Option.orElse(maxErrors, () => Option.some(10))

export const maxFailures = (maxErrors: Option.Option<number>): Option.Option<number> =>
  Option.map(maxErrors, (limit) => Numeric.max(0, limit - 1))
