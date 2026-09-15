/** Fixed-width decimal feedback for the collective-memory examples. */
import { Array as Arr, Number, Option, Schema, String } from "effect"

/**
 * Uses native Number.round and retains trailing zeros in reflective feedback.
 * Rounding follows Effect's decimal-place contract, not binary toFixed ties.
 */
export const formatScore = (value: number, places: number): string => {
  const parts = String.split(Schema.encodeSync(Schema.NumberFromString)(Number.round(value, places)), ".")
  return Arr.join(
    Arr.make(
      Arr.headNonEmpty(parts),
      String.padEnd(places, "0")(Option.getOrElse(Arr.get(parts, 1), () => ""))
    ),
    "."
  )
}
