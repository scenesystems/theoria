import { expm1Strict, log1pStrict, logStrict } from "@scenesystems/effect-math/Numeric"
import { Boolean, Equal, Match, Number as Num, Schema } from "effect"

export const PI = 3.141592653589793
export const E = 2.718281828459045
export const LN_2 = 0.6931471805599453
export const SQRT_2 = 1.4142135623730951
export const EPSILON = Number.EPSILON

const isNonNaN = Schema.is(Schema.NonNaN)

const negative = (value: number): boolean => Boolean.and(isNonNaN(value), Num.lessThan(value, 0))

export const abs = (value: number): number =>
  Match.value(negative(value)).pipe(
    Match.when(true, () => Num.negate(value)),
    Match.orElse(() => value)
  )

export const sqrt = (value: number): number =>
  Match.value(Boolean.or(Boolean.not(isNonNaN(value)), negative(value))).pipe(
    Match.when(true, () => Number.NaN),
    Match.orElse(() => value ** 0.5)
  )

export const exp = (value: number): number =>
  Match.value(value).pipe(
    Match.when((current) => Boolean.not(isNonNaN(current)), () => Number.NaN),
    Match.when((current) => Equal.equals(current, Number.POSITIVE_INFINITY), () => Number.POSITIVE_INFINITY),
    Match.when((current) => Equal.equals(current, Number.NEGATIVE_INFINITY), () => 0),
    Match.orElse((current) => E ** current)
  )

export const log: (value: number) => number = logStrict

export const log1p: (value: number) => number = log1pStrict

export const expm1: (value: number) => number = expm1Strict
