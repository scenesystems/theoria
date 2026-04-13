/**
 * Numeric transcendental kernels.
 *
 * The strict kernels use DataView bit-decomposition + Taylor series
 * for high-precision log/log1p/expm1. Ported from effect-search's
 * float64.ts for SOT unification.
 *
 * @since 0.1.0
 * @category internal
 */

// ---------------------------------------------------------------------------
// DataView bit-decomposition infrastructure
// ---------------------------------------------------------------------------

const MANTISSA_SCALE = 4_503_599_627_370_496
const MANTISSA_HIGH_SCALE = 4_294_967_296
const SUBNORMAL_EXPONENT_OFFSET = 52
const LOG_SERIES_TERMS = 24
const LOG1P_SERIES_TERMS = 24
const EXPM1_SERIES_TERMS = 24
const SMALL_LOG1P_THRESHOLD = 1e-4
const SMALL_EXPM1_THRESHOLD = 1e-5
export const LN_2 = 0.6931471805599453
export const E = 2.718281828459045

const FLOAT64_BUFFER = new ArrayBuffer(8)
const FLOAT64_VIEW = new DataView(FLOAT64_BUFFER)

const mantissaFromBits = (high: number, low: number): number => (high & 0x000f_ffff) * MANTISSA_HIGH_SCALE + low

const decomposeNormalized = (value: number): readonly [exponent: number, mantissa: number] => {
  FLOAT64_VIEW.setFloat64(0, value, false)
  const high = FLOAT64_VIEW.getUint32(0, false)
  const low = FLOAT64_VIEW.getUint32(4, false)
  const exponentBits = (high >>> 20) & 0x7ff
  const exponent = exponentBits - 1023
  const mantissaBits = mantissaFromBits(high, low)
  const mantissa = 1 + mantissaBits / MANTISSA_SCALE
  return [exponent, mantissa]
}

const decompose = (value: number): readonly [exponent: number, mantissa: number] => {
  FLOAT64_VIEW.setFloat64(0, value, false)
  const high = FLOAT64_VIEW.getUint32(0, false)
  const exponentBits = (high >>> 20) & 0x7ff

  if (exponentBits === 0) {
    const [scaledExp, scaledMant] = decomposeNormalized(value * MANTISSA_SCALE)
    return [scaledExp - SUBNORMAL_EXPONENT_OFFSET, scaledMant]
  }
  return decomposeNormalized(value)
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
      total + term / denominator
    )

const lnMantissa = (value: number): number => {
  if (value === 1) return 0
  const z = (value - 1) / (value + 1)
  const zSquared = z * z
  return 2 * lnMantissaSeries(zSquared, z, 1, LOG_SERIES_TERMS, 0)
}

/**
 * Strict `log` kernel using DataView bit-decomposition + Taylor series.
 * Produces byte-identical results with effect-search's Float64.log.
 *
 * @since 0.1.0
 * @category internal
 */
export const logStrict = (value: number): number => {
  if (Number.isNaN(value)) return NaN
  if (value === Infinity) return Infinity
  if (value === 0) return -Infinity
  if (value < 0) return NaN
  const [exponent, mantissa] = decompose(value)
  return lnMantissa(mantissa) + exponent * LN_2
}

// ---------------------------------------------------------------------------
// log1p
// ---------------------------------------------------------------------------

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
      total + (index % 2 === 1 ? 1 : -1) * power / index
    )

/**
 * Relaxed `log1p` — direct `Math.log1p` delegation.
 *
 * @since 0.1.0
 * @category internal
 */
export const log1pRelaxed: (value: number) => number = Math.log1p

/**
 * Strict `log1p` kernel. Uses Taylor series for `|x| < 1e-4` and
 * DataView bit-decomposition log for larger values.
 *
 * @since 0.1.0
 * @category internal
 */
export const log1pStrict = (value: number): number => {
  if (Number.isNaN(value)) return NaN
  if (value === -1) return -Infinity
  if (value < -1) return NaN
  return Math.abs(value) < SMALL_LOG1P_THRESHOLD
    ? log1pSeries(value, value, 1, LOG1P_SERIES_TERMS, 0)
    : logStrict(1 + value)
}

// ---------------------------------------------------------------------------
// expm1
// ---------------------------------------------------------------------------

export const abs: (value: number) => number = Math.abs

export const exp: (value: number) => number = Math.exp

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
      (term * x) / (index + 1),
      index + 1,
      remaining - 1,
      total + term
    )

/**
 * Relaxed `expm1` — direct `Math.expm1` delegation.
 *
 * @since 0.1.0
 * @category internal
 */
export const expm1Relaxed: (value: number) => number = Math.expm1

/**
 * Strict `expm1` kernel. Uses Taylor series for `|x| < 1e-5` and
 * native `exp(x) - 1` for larger values.
 *
 * @since 0.1.0
 * @category internal
 */
export const expm1Strict = (value: number): number => {
  if (Number.isNaN(value)) return NaN
  if (value === Infinity) return Infinity
  if (value === -Infinity) return -1
  return abs(value) < SMALL_EXPM1_THRESHOLD
    ? expm1Series(value, value, 1, EXPM1_SERIES_TERMS, 0)
    : exp(value) - 1
}
