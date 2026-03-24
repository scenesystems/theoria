/**
 * TPE scoring — log-probability computation for categorical Parzen density models.
 *
 * @since 0.1.0
 */
import { Array as Arr, Equal, Match, Number as Num, Option } from "effect"

import type { PrimitiveChoice } from "../../contracts/Distribution.js"
import * as Float64 from "../../internal/float64.js"

/** @since 0.1.0 */
export const logProbability = (
  choices: ReadonlyArray<PrimitiveChoice>,
  probabilities: ReadonlyArray<number>,
  value: PrimitiveChoice
): number => {
  const index = Arr.findFirstIndex(choices, (choice) => Equal.equals(choice, value)).pipe(Option.getOrElse(() => -1))
  const probability = Arr.get(probabilities, index).pipe(Option.getOrElse(() => 0))

  return Match.value(Num.lessThanOrEqualTo(probability, 0)).pipe(
    Match.when(true, () => Number.NEGATIVE_INFINITY),
    Match.orElse(() => Float64.log(probability))
  )
}
