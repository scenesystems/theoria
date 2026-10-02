import { Schema } from "effect"

export const nonNegativeInt = Schema.Int.check(Schema.isGreaterThanOrEqualTo(0))

export const lengthAtMost = (maximum: number) => nonNegativeInt.check(Schema.isLessThanOrEqualTo(maximum))
