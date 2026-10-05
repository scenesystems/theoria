/** DSPy maxErrors raises when the count reaches the limit. The study primitive
 * counts allowed failures instead, so its limit is one smaller. Zero still
 * permits successful execution but raises on the first failure, as DSPy does.
 * @internal
 */
import * as Numeric from "@scenesystems/effect-math/Numeric"
import { Option } from "effect"

export const maxFailures = (maxErrors: Option.Option<number>): Option.Option<number> =>
  Option.map(maxErrors, (limit) => Numeric.max(0, limit - 1))
