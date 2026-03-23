import { Number as Num, Schema } from "effect"

const MANTISSA_SCALE = 4_503_599_627_370_496
const MANTISSA_HIGH_SCALE = 4_294_967_296
const SUBNORMAL_EXPONENT_OFFSET = 52
const LOG_SERIES_TERMS = 24
const LOG1P_SERIES_TERMS = 24
const EXPM1_SERIES_TERMS = 24
const SMALL_LOG1P_THRESHOLD = 1e-4
const SMALL_EXPM1_THRESHOLD = 1e-5

export const PI = 3.141592653589793
export const E = 2.718281828459045
export const LN_2 = 0.6931471805599453
export const SQRT_2 = 1.4142135623730951
export const EPSILON = Number.EPSILON

const FLOAT64_BUFFER = new ArrayBuffer(8)
const FLOAT64_VIEW = new DataView(FLOAT64_BUFFER)

class Decomposed extends Schema.Class<Decomposed>("effect-search/Float64Decomposed")({
  exponent: Schema.Number,
  mantissa: Schema.Number
}) {}

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

const mantissaFromBits = (high: number, low: number): number => Num.sum((high & 0x000f_ffff) * MANTISSA_HIGH_SCALE, low)

const decomposeNormalized = (value: number): Decomposed => {
  FLOAT64_VIEW.setFloat64(0, value, false)

  const high = FLOAT64_VIEW.getUint32(0, false)
  const low = FLOAT64_VIEW.getUint32(4, false)
  const exponentBits = (high >>> 20) & 0x7ff
  const exponent = exponentBits - 1023
  const mantissaBits = mantissaFromBits(high, low)
  const mantissa = 1 + Num.unsafeDivide(mantissaBits, MANTISSA_SCALE)

  return new Decomposed({
    exponent,
    mantissa
  })
}

const decompose = (value: number): Decomposed => {
  FLOAT64_VIEW.setFloat64(0, value, false)

  const high = FLOAT64_VIEW.getUint32(0, false)
  const exponentBits = (high >>> 20) & 0x7ff

  return exponentBits === 0
    ? (() => {
      const scaled = decomposeNormalized(value * MANTISSA_SCALE)

      return new Decomposed({
        exponent: scaled.exponent - SUBNORMAL_EXPONENT_OFFSET,
        mantissa: scaled.mantissa
      })
    })()
    : decomposeNormalized(value)
}

const lnMantissaSeries = (
  zSquared: number,
  term: number,
  denominator: number,
  remaining: number,
  total: number
): number =>
  remaining <= 0
    ? total
    : lnMantissaSeries(
      zSquared,
      term * zSquared,
      denominator + 2,
      remaining - 1,
      total + Num.unsafeDivide(term, denominator)
    )

const lnMantissa = (value: number): number => {
  if (value === 1) {
    return 0
  }

  const z = Num.unsafeDivide(value - 1, value + 1)
  const zSquared = z * z

  return 2 * lnMantissaSeries(zSquared, z, 1, LOG_SERIES_TERMS, 0)
}

export const log = (value: number): number => {
  if (Number.isNaN(value)) {
    return Number.NaN
  }

  if (value === Number.POSITIVE_INFINITY) {
    return Number.POSITIVE_INFINITY
  }

  if (value === 0) {
    return Number.NEGATIVE_INFINITY
  }

  if (value < 0) {
    return Number.NaN
  }

  const { mantissa, exponent } = decompose(value)

  return lnMantissa(mantissa) + exponent * LN_2
}

const log1pSeries = (
  x: number,
  power: number,
  index: number,
  remaining: number,
  total: number
): number =>
  remaining <= 0
    ? total
    : log1pSeries(
      x,
      power * x,
      index + 1,
      remaining - 1,
      total + (index % 2 === 1 ? 1 : -1) * Num.unsafeDivide(power, index)
    )

export const log1p = (value: number): number => {
  if (Number.isNaN(value)) {
    return Number.NaN
  }

  if (value === -1) {
    return Number.NEGATIVE_INFINITY
  }

  if (value < -1) {
    return Number.NaN
  }

  return abs(value) < SMALL_LOG1P_THRESHOLD
    ? log1pSeries(value, value, 1, LOG1P_SERIES_TERMS, 0)
    : log(1 + value)
}

const expm1Series = (
  x: number,
  term: number,
  index: number,
  remaining: number,
  total: number
): number =>
  remaining <= 0
    ? total
    : expm1Series(
      x,
      Num.unsafeDivide(term * x, index + 1),
      index + 1,
      remaining - 1,
      total + term
    )

export const expm1 = (value: number): number => {
  if (Number.isNaN(value)) {
    return Number.NaN
  }

  if (value === Number.POSITIVE_INFINITY) {
    return Number.POSITIVE_INFINITY
  }

  if (value === Number.NEGATIVE_INFINITY) {
    return -1
  }

  return abs(value) < SMALL_EXPM1_THRESHOLD
    ? expm1Series(value, value, 1, EXPM1_SERIES_TERMS, 0)
    : exp(value) - 1
}
