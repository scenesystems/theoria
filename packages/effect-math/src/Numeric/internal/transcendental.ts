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
import { Array as Arr, Boolean, Data, Match, Number as N, Predicate, Schema, Tuple } from "effect"

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
const LN_2 = 0.6931471805599453
const E = 2.718281828459045
const isNaN = Predicate.not(Schema.is(Schema.NonNaN))

const Decomposition = Schema.Tuple(Schema.Number, Schema.Number)

class SeriesState extends Data.Class<{
  readonly term: number
  readonly total: number
}> {}

const FLOAT64_BUFFER = new ArrayBuffer(8)
const FLOAT64_VIEW = new DataView(FLOAT64_BUFFER)

const mantissaFromBits = (high: number, low: number): number =>
  N.sum(N.multiply(high & 0x000f_ffff, MANTISSA_HIGH_SCALE), low)

const decomposeNormalized = (value: number): typeof Decomposition.Type => {
  FLOAT64_VIEW.setFloat64(0, value, false)
  const high = FLOAT64_VIEW.getUint32(0, false)
  const low = FLOAT64_VIEW.getUint32(4, false)
  const exponentBits = (high >>> 20) & 0x7ff
  const exponent = N.subtract(exponentBits, 1023)
  const mantissaBits = mantissaFromBits(high, low)
  const mantissa = N.sum(1, N.unsafeDivide(mantissaBits, MANTISSA_SCALE))
  return Tuple.make(exponent, mantissa)
}

const decompose = (value: number): typeof Decomposition.Type => {
  FLOAT64_VIEW.setFloat64(0, value, false)
  const high = FLOAT64_VIEW.getUint32(0, false)
  const exponentBits = (high >>> 20) & 0x7ff

  return Boolean.match(N.Equivalence(exponentBits, 0), {
    onTrue: () => {
      const [scaledExp, scaledMant] = decomposeNormalized(N.multiply(value, MANTISSA_SCALE))
      return Tuple.make(N.subtract(scaledExp, SUBNORMAL_EXPONENT_OFFSET), scaledMant)
    },
    onFalse: () => decomposeNormalized(value)
  })
}

const lnMantissa = (value: number): number =>
  Boolean.match(N.Equivalence(value, 1), {
    onTrue: () => 0,
    onFalse: () => {
      const z = N.unsafeDivide(N.subtract(value, 1), N.sum(value, 1))
      const zSquared = N.multiply(z, z)
      const state = Arr.reduce(
        Arr.range(0, N.decrement(LOG_SERIES_TERMS)),
        new SeriesState({ term: z, total: 0 }),
        (current, index) =>
          new SeriesState({
            term: N.multiply(current.term, zSquared),
            total: N.sum(current.total, N.unsafeDivide(current.term, N.sum(N.multiply(index, 2), 1)))
          })
      )
      return N.multiply(2, state.total)
    }
  })

/**
 * Strict `log` kernel using DataView bit-decomposition + Taylor series.
 * Produces byte-identical results with effect-search's Float64.log.
 *
 * @since 0.1.0
 * @category internal
 */
export const logStrict = (value: number): number =>
  Match.value(value).pipe(
    Match.when(isNaN, () => NaN),
    Match.when(Infinity, () => Infinity),
    Match.when(0, () => N.negate(Infinity)),
    Match.when(N.lessThan(0), () => NaN),
    Match.orElse((positive) => {
      const [exponent, mantissa] = decompose(positive)
      return N.sum(lnMantissa(mantissa), N.multiply(exponent, LN_2))
    })
  )

// ---------------------------------------------------------------------------
// log1p
// ---------------------------------------------------------------------------

const log1pSeries = (value: number): number =>
  Arr.reduce(
    Arr.range(1, LOG1P_SERIES_TERMS),
    new SeriesState({ term: value, total: 0 }),
    (current, index) =>
      new SeriesState({
        term: N.multiply(current.term, value),
        total: N.sum(
          current.total,
          N.unsafeDivide(
            Boolean.match(N.Equivalence(N.remainder(index, 2), 1), {
              onTrue: () => current.term,
              onFalse: () => N.negate(current.term)
            }),
            index
          )
        )
      })
  ).total

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
export const log1pStrict = (value: number): number =>
  Match.value(value).pipe(
    Match.when(isNaN, () => NaN),
    Match.when(0, (zero) => zero),
    Match.when(-1, () => N.negate(Infinity)),
    Match.when(N.lessThan(-1), () => NaN),
    Match.when((input) => N.lessThan(N.max(input, N.negate(input)), SMALL_LOG1P_THRESHOLD), log1pSeries),
    Match.orElse((input) => logStrict(N.sum(1, input)))
  )

// ---------------------------------------------------------------------------
// expm1
// ---------------------------------------------------------------------------

const exp = (value: number): number =>
  Match.value(value).pipe(
    Match.when(isNaN, () => NaN),
    Match.when(Infinity, () => Infinity),
    Match.when(N.negate(Infinity), () => 0),
    Match.orElse((input) => E ** input)
  )

const expm1Series = (value: number): number =>
  Arr.reduce(
    Arr.range(1, EXPM1_SERIES_TERMS),
    new SeriesState({ term: value, total: 0 }),
    (current, index) =>
      new SeriesState({
        term: N.unsafeDivide(N.multiply(current.term, value), N.increment(index)),
        total: N.sum(current.total, current.term)
      })
  ).total

/**
 * Relaxed `expm1` — direct `Math.expm1` delegation.
 *
 * @since 0.1.0
 * @category internal
 */
export const expm1Relaxed: (value: number) => number = Math.expm1

/**
 * Strict `expm1` kernel. Uses Taylor series for `|x| < 1e-5` and
 * pure E**x - 1 for larger values.
 *
 * @since 0.1.0
 * @category internal
 */
export const expm1Strict = (value: number): number =>
  Match.value(value).pipe(
    Match.when(isNaN, () => NaN),
    Match.when(0, (zero) => zero),
    Match.when(Infinity, () => Infinity),
    Match.when(N.negate(Infinity), () => -1),
    Match.when((input) => N.lessThan(N.max(input, N.negate(input)), SMALL_EXPM1_THRESHOLD), expm1Series),
    Match.orElse((input) => N.subtract(exp(input), 1))
  )
