import {
  abs as numericAbs,
  expm1Strict,
  log1pStrict,
  logStrict,
  pow,
  sqrt as numericSqrt
} from "@scenesystems/effect-math/Numeric"

export const PI = 3.141592653589793
export const E = 2.718281828459045
export const LN_2 = 0.6931471805599453
export const SQRT_2 = 1.4142135623730951
export const EPSILON = pow(2, -52)

export const abs: typeof numericAbs = numericAbs

export const sqrt: typeof numericSqrt = numericSqrt

export const exp = (value: number): number => pow(E, value)

export const log: (value: number) => number = logStrict

export const log1p: (value: number) => number = log1pStrict

export const expm1: (value: number) => number = expm1Strict
