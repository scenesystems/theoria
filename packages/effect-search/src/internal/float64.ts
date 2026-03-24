import { expm1Strict, log1pStrict, logStrict } from "effect-math/Numeric"

export const PI = 3.141592653589793
export const E = 2.718281828459045
export const LN_2 = 0.6931471805599453
export const SQRT_2 = 1.4142135623730951
export const EPSILON = Number.EPSILON

export const abs = (value: number): number => (value < 0 ? -value : value)

export const sqrt = (value: number): number =>
  Number.isNaN(value) || value < 0
    ? Number.NaN
    : value ** 0.5

export const exp = (value: number): number =>
  Number.isNaN(value)
    ? Number.NaN
    : value === Number.POSITIVE_INFINITY
    ? Number.POSITIVE_INFINITY
    : value === Number.NEGATIVE_INFINITY
    ? 0
    : E ** value

export const log: (value: number) => number = logStrict

export const log1p: (value: number) => number = log1pStrict

export const expm1: (value: number) => number = expm1Strict
