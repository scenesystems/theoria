import { expm1Strict, log1pStrict, logStrict, pow } from "@scenesystems/effect-math/Numeric"
import { Boolean as Bool, Match, Number as Num } from "effect"

export const pi = 3.141592653589793
export const e = 2.718281828459045
export const ln2 = 0.6931471805599453
export const sqrt2 = 1.4142135623730951
export const epsilon = Number.EPSILON

export const abs = (value: number): number =>
  Match.value(Num.lessThan(value, 0)).pipe(
    Match.when(true, () => Num.negate(value)),
    Match.orElse(() => value)
  )

export const sqrt = (value: number): number =>
  Match.value(Bool.or(Number.isNaN(value), Num.lessThan(value, 0))).pipe(
    Match.when(true, () => Number.NaN),
    Match.orElse(() => pow(value, 0.5))
  )

export const exp = (value: number): number =>
  Match.value(value).pipe(
    Match.when(Number.isNaN, () => Number.NaN),
    Match.when((current) => Num.Equivalence(current, Number.POSITIVE_INFINITY), () => Number.POSITIVE_INFINITY),
    Match.when((current) => Num.Equivalence(current, Number.NEGATIVE_INFINITY), () => 0),
    Match.orElse((finite) => pow(e, finite))
  )

export const log: (value: number) => number = logStrict

export const log1p: (value: number) => number = log1pStrict

export const expm1: (value: number) => number = expm1Strict
