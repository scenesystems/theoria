/**
 * Exact dyadic arithmetic and binary64 rounding through Effect's public
 * Number, BigInt, BigDecimal, and collection APIs.
 *
 * @since 0.4.0
 * @category internal
 */
import {
  Array,
  BigDecimal,
  BigInt,
  Boolean,
  Chunk,
  Data,
  Match,
  MutableHashMap,
  Number,
  Option,
  Predicate,
  Tuple
} from "effect"

export const positiveInfinity = Number.unsafeDivide(1, 0)
export const negativeInfinity = Number.negate(positiveInfinity)
export const notANumber = Number.unsafeDivide(0, 0)
export const isNaN = (value: number): boolean => Boolean.not(Number.Equivalence(value, value))

export const isFinite = (value: number): boolean => Number.Equivalence(Number.subtract(value, value), 0)
const zero = (value: number): boolean => Number.Equivalence(value, 0)
const infinity = (value: number): boolean => Number.Equivalence(abs(value), positiveInfinity)
const maxSafeInteger = 9_007_199_254_740_991
const maxSafeBigInt = 9_007_199_254_740_991n
const significandScale = 4_503_599_627_370_496
const minimumNormal = 2.2250738585072014e-308

/** An exact value `coefficient × 2^exponent`. */
export class Dyadic extends Data.Class<{
  readonly coefficient: bigint
  readonly exponent: number
}> {}

/** A positive finite nonzero binary64 value represented as `mantissa × 2^exponent`. */
export class Normalized extends Data.Class<{
  readonly mantissa: number
  readonly exponent: number
}> {}

class BigIntLengthState extends Data.Class<{
  readonly remaining: bigint
  readonly length: number
}> {}

class HypotState extends Data.Class<{
  readonly coefficient: bigint
  readonly exponent: number
  readonly hasInfinity: boolean
  readonly hasNaN: boolean
}> {}

// Callers establish safe integral significands before conversion.
const decodeInteger = (value: number): bigint => Option.getOrThrow(BigInt.fromNumber(value))
const encodeInteger = (value: bigint): number => Option.getOrThrow(BigInt.toNumber(value))
const integerPowersOfTwo = Array.scan(Array.range(1, 1023), 1n, (power) => BigInt.multiply(power, 2n))

/** Non-negative integer powers without native exponentiation. */
export const integerPower = (base: bigint, exponent: number): bigint =>
  Boolean.match(Number.lessThanOrEqualTo(exponent, 0), {
    onTrue: () => 1n,
    onFalse: () =>
      Boolean.match(Boolean.and(BigInt.Equivalence(base, 2n), Number.lessThan(exponent, 1024)), {
        onTrue: () => Array.unsafeGet(integerPowersOfTwo, exponent),
        onFalse: () => {
          const roundedHalf = Number.round(Number.unsafeDivide(exponent, 2), 0)
          const half = Boolean.match(Number.greaterThan(Number.multiply(roundedHalf, 2), exponent), {
            onTrue: () => Number.decrement(roundedHalf),
            onFalse: () => roundedHalf
          })
          const partial = integerPower(base, half)
          const square = BigInt.multiply(partial, partial)
          return Boolean.match(Number.greaterThan(exponent, Number.multiply(half, 2)), {
            onTrue: () => BigInt.multiply(square, base),
            onFalse: () => square
          })
        }
      })
  })

/** Magnitude with positive zero, and NaN propagation. */
export const abs = (value: number): number =>
  Boolean.match(Number.lessThan(value, 0), {
    onTrue: () => Number.negate(value),
    onFalse: () => Number.sum(0, value)
  })

const power2_512 = 1.3407807929942597e154
// Private read-only lookup, built once with exact binary multiplications.
const powersOfTwo = Array.scan(Array.range(1, 1023), 1, (power) => Number.multiply(power, 2))
// Primitive keys in MutableHashMap avoid Hash.number's collisions for powers
// of two. This private table is never modified after construction.
const powerExponents = MutableHashMap.fromIterable(
  Array.map(powersOfTwo, (power, exponent) => Tuple.make(power, exponent))
)

const normalizeStep = (value: number, exponent: number, step: number): Normalized =>
  Boolean.match(Number.lessThan(value, 2), {
    onTrue: () => new Normalized({ mantissa: value, exponent }),
    onFalse: () => {
      const factor = Array.unsafeGet(powersOfTwo, step)
      return Boolean.match(Number.greaterThanOrEqualTo(value, factor), {
        onTrue: () =>
          normalizeStep(Number.unsafeDivide(value, factor), Number.sum(exponent, step), Number.multiply(step, 0.5)),
        onFalse: () => normalizeStep(value, exponent, Number.multiply(step, 0.5))
      })
    }
  })

const normalizeLarge = (value: number, exponent: number): Normalized => {
  // nextPow2 uses the host logarithm: treat it as an estimate, not a proof.
  // Capping prevents its overflow at the top binade; exact power-of-two
  // division and the final range check certify the representation.
  const factor = Number.min(Number.nextPow2(value), Array.unsafeGet(powersOfTwo, 1023))
  const factorExponent = Option.getOrThrow(MutableHashMap.get(powerExponents, factor))
  const ratio = Number.unsafeDivide(value, factor)
  const double = Number.lessThan(ratio, 1)
  const mantissa = Boolean.match(double, { onTrue: () => Number.multiply(ratio, 2), onFalse: () => ratio })
  return Boolean.match(Boolean.and(Number.greaterThanOrEqualTo(mantissa, 1), Number.lessThan(mantissa, 2)), {
    onTrue: () =>
      new Normalized({
        mantissa,
        exponent: Number.sum(
          exponent,
          Boolean.match(double, {
            onTrue: () => Number.decrement(factorExponent),
            onFalse: () => factorExponent
          })
        )
      }),
    onFalse: () => normalizeStep(value, exponent, 512)
  })
}

const normalizeSmall = (value: number, exponent: number): Normalized =>
  Boolean.match(Number.lessThan(value, 1), {
    onTrue: () => normalizeSmall(Number.multiply(value, power2_512), Number.subtract(exponent, 512)),
    onFalse: () => normalizeLarge(value, exponent)
  })

/**
 * Normalizes a positive finite nonzero binary64 value to `x = m × 2^e`,
 * where `1 <= m < 2`. Inputs outside that contract are not supported.
 */
export const normalize = (value: number): Normalized => normalizeSmall(value, 0)

/** Decomposes a finite nonzero number without inspecting its storage. */
export const decompose = (value: number): Dyadic => {
  const normalized = normalize(abs(value))
  return new Dyadic({
    coefficient: decodeInteger(Number.multiply(normalized.mantissa, significandScale)),
    exponent: Number.subtract(normalized.exponent, 52)
  })
}

const scaleNormal = (value: number, exponent: number): number =>
  Boolean.match(Number.lessThan(exponent, 0), {
    onTrue: () => Number.unsafeDivide(value, Array.unsafeGet(powersOfTwo, Number.negate(exponent))),
    onFalse: () => Number.multiply(value, Array.unsafeGet(powersOfTwo, exponent))
  })

const withSign = (magnitude: number, value: number): number =>
  Boolean.match(Number.lessThan(value, 0), {
    onTrue: () => Number.negate(magnitude),
    onFalse: () => magnitude
  })

const scalePow2Extreme = (value: number, exponent: number): number =>
  Boolean.match(Boolean.or(Boolean.not(isFinite(value)), zero(value)), {
    onTrue: () => value,
    onFalse: () => {
      const normalized = normalize(abs(value))
      const targetExponent = Number.sum(normalized.exponent, exponent)
      return Boolean.match(Number.greaterThanOrEqualTo(targetExponent, 1024), {
        onTrue: () => withSign(positiveInfinity, value),
        onFalse: () =>
          Boolean.match(Number.lessThan(targetExponent, -1075), {
            onTrue: () => Number.multiply(0, value),
            onFalse: () =>
              Boolean.match(Number.lessThan(targetExponent, -1022), {
                onTrue: () =>
                  withSign(
                    Number.multiply(
                      scaleNormal(normalized.mantissa, Number.sum(targetExponent, 1022)),
                      minimumNormal
                    ),
                    value
                  ),
                onFalse: () => withSign(scaleNormal(normalized.mantissa, targetExponent), value)
              })
          })
      })
    }
  })

/**
 * Scales a scalar by `2^exponent` for integer exponents in `[-1075, 1024]`.
 * One multiplication or division by a finite exact power of two rounds only
 * once, even for subnormal inputs/results. Beyond that factor range, retain
 * normalized staging so an intermediate cannot introduce double rounding.
 * Signed zero and IEEE exceptional values pass through unchanged.
 */
export const scalePow2 = (value: number, exponent: number): number =>
  Boolean.match(Boolean.and(Number.greaterThanOrEqualTo(exponent, -1023), Number.lessThanOrEqualTo(exponent, 1023)), {
    onTrue: () => scaleNormal(value, exponent),
    onFalse: () => scalePow2Extreme(value, exponent)
  })

/** Converts a dyadic value to an exact decimal, without decimal input rounding. */
export const toDecimal = (value: Dyadic): BigDecimal.BigDecimal =>
  Boolean.match(Number.greaterThanOrEqualTo(value.exponent, 0), {
    onTrue: () => BigDecimal.make(BigInt.multiply(value.coefficient, integerPower(2n, value.exponent)), 0),
    onFalse: () =>
      BigDecimal.make(
        BigInt.multiply(value.coefficient, integerPower(5n, Number.negate(value.exponent))),
        Number.negate(value.exponent)
      )
  })

/** Exact decimal value of a finite binary64 input. */
export const exactDecimal = (value: number): BigDecimal.BigDecimal =>
  Boolean.match(zero(value), {
    onTrue: () => BigDecimal.make(0n, 0),
    onFalse: () => {
      const magnitude = toDecimal(decompose(value))
      return Boolean.match(Number.lessThan(value, 0), {
        onTrue: () => BigDecimal.negate(magnitude),
        onFalse: () => magnitude
      })
    }
  })

/** Decimal conversion preserves the binary64 value, not its shortest spelling. */
export const toBigDecimal = (value: number): Option.Option<BigDecimal.BigDecimal> =>
  Option.map(Option.liftPredicate(isFinite)(value), exactDecimal)

const dyadicInteger = (value: number): bigint => {
  const dyadic = decompose(value)
  const magnitude = Boolean.match(Number.greaterThanOrEqualTo(dyadic.exponent, 0), {
    onTrue: () => BigInt.multiply(dyadic.coefficient, integerPower(2n, dyadic.exponent)),
    onFalse: () => BigInt.unsafeDivide(dyadic.coefficient, integerPower(2n, Number.negate(dyadic.exponent)))
  })
  return Boolean.match(Number.lessThan(value, 0), {
    onTrue: () => BigInt.subtract(0n, magnitude),
    onFalse: () => magnitude
  })
}

/** Exact integer conversion, including integral values beyond the safe range. */
export const toBigInt = (value: number): Option.Option<bigint> =>
  BigInt.fromNumber(value).pipe(
    Option.orElse(() =>
      Option.map(
        Option.liftPredicate(
          Predicate.and(isFinite, (value: number) => Number.greaterThan(abs(value), maxSafeInteger))
        )(
          value
        ),
        dyadicInteger
      )
    )
  )

const roundedInteger = (value: number): number => Number.round(value, 0)

export const floor = (value: number): number => {
  const rounded = roundedInteger(value)
  return Boolean.match(Number.greaterThan(rounded, value), {
    onTrue: () => Number.decrement(rounded),
    onFalse: () => rounded
  })
}

export const ceil = (value: number): number => {
  const rounded = roundedInteger(value)
  return Boolean.match(Number.lessThan(rounded, value), {
    onTrue: () => Number.increment(rounded),
    onFalse: () => rounded
  })
}

export const truncate = (value: number): number =>
  Boolean.match(Number.lessThan(value, 0), {
    onTrue: () => ceil(value),
    onFalse: () => floor(value)
  })

const bitPower1 = 2n
const bitPower2 = BigInt.multiply(bitPower1, bitPower1)
const bitPower4 = BigInt.multiply(bitPower2, bitPower2)
const bitPower8 = BigInt.multiply(bitPower4, bitPower4)
const bitPower16 = BigInt.multiply(bitPower8, bitPower8)
const bitPower32 = BigInt.multiply(bitPower16, bitPower16)
const bitPower64 = BigInt.multiply(bitPower32, bitPower32)
const bitPower128 = BigInt.multiply(bitPower64, bitPower64)
const bitPower256 = BigInt.multiply(bitPower128, bitPower128)
const bitPower512 = BigInt.multiply(bitPower256, bitPower256)
const bitPower1024 = BigInt.multiply(bitPower512, bitPower512)
const bitPower2048 = BigInt.multiply(bitPower1024, bitPower1024)
const bitPower4096 = BigInt.multiply(bitPower2048, bitPower2048)

const bitLengthStep = (state: BigIntLengthState, factor: bigint, step: number): BigIntLengthState =>
  Boolean.match(BigInt.greaterThanOrEqualTo(state.remaining, factor), {
    onTrue: () =>
      new BigIntLengthState({
        remaining: BigInt.unsafeDivide(state.remaining, factor),
        length: Number.sum(state.length, step)
      }),
    onFalse: () => state
  })

const bitLength = (value: bigint): number => {
  const initial = new BigIntLengthState({ remaining: value, length: 0 })
  const step4096 = bitLengthStep(initial, bitPower4096, 4096)
  const step2048 = bitLengthStep(step4096, bitPower2048, 2048)
  const step1024 = bitLengthStep(step2048, bitPower1024, 1024)
  const step512 = bitLengthStep(step1024, bitPower512, 512)
  const step256 = bitLengthStep(step512, bitPower256, 256)
  const step128 = bitLengthStep(step256, bitPower128, 128)
  const step64 = bitLengthStep(step128, bitPower64, 64)
  const step32 = bitLengthStep(step64, bitPower32, 32)
  const step16 = bitLengthStep(step32, bitPower16, 16)
  const step8 = bitLengthStep(step16, bitPower8, 8)
  const step4 = bitLengthStep(step8, bitPower4, 4)
  const step2 = bitLengthStep(step4, bitPower2, 2)
  return Number.increment(bitLengthStep(step2, bitPower1, 1).length)
}

const squareRootStep = (value: bigint, estimate: bigint): bigint => {
  const next = BigInt.unsafeDivide(BigInt.sum(estimate, BigInt.unsafeDivide(value, estimate)), 2n)
  return Boolean.match(BigInt.greaterThanOrEqualTo(next, estimate), {
    onTrue: () => estimate,
    onFalse: () => squareRootStep(value, next)
  })
}

const integerSquareRoot = (value: bigint): bigint =>
  squareRootStep(value, integerPower(2n, Number.round(Number.unsafeDivide(bitLength(value), 2), 0)))

const roundedDyadicToNumber = (coefficient: bigint, exponent: number): number =>
  Boolean.match(BigInt.greaterThan(coefficient, maxSafeBigInt), {
    onTrue: () => scalePow2(encodeInteger(BigInt.unsafeDivide(coefficient, 2n)), Number.increment(exponent)),
    onFalse: () => scalePow2(encodeInteger(coefficient), exponent)
  })

/** Rounds an exact nonnegative dyadic square root to nearest, ties to even. */
const sqrtDyadic = (value: Dyadic): number =>
  Boolean.match(BigInt.Equivalence(value.coefficient, 0n), {
    onTrue: () => 0,
    onFalse: () => {
      const rootExponent = floor(
        Number.unsafeDivide(Number.sum(Number.decrement(bitLength(value.coefficient)), value.exponent), 2)
      )
      const quantum = Number.max(Number.subtract(rootExponent, 52), -1074)
      const shift = Number.subtract(value.exponent, Number.multiply(2, quantum))
      const numerator = BigInt.multiply(value.coefficient, integerPower(2n, Number.max(shift, 0)))
      const denominator = integerPower(2n, Number.max(Number.negate(shift), 0))
      const lower = integerSquareRoot(BigInt.unsafeDivide(numerator, denominator))
      const twiceMidpoint = BigInt.increment(BigInt.multiply(2n, lower))
      const midpointSquare = BigInt.multiply(BigInt.multiply(twiceMidpoint, twiceMidpoint), denominator)
      const fourNumerator = BigInt.multiply(4n, numerator)
      const halfLower = BigInt.unsafeDivide(lower, 2n)
      const lowerIsEven = BigInt.Equivalence(BigInt.multiply(halfLower, 2n), lower)
      const order = BigInt.Order(fourNumerator, midpointSquare)
      const rounded = Boolean.match(Number.lessThan(order, 0), {
        onTrue: () => lower,
        onFalse: () =>
          Boolean.match(Number.greaterThan(order, 0), {
            onTrue: () => BigInt.increment(lower),
            onFalse: () => Boolean.match(lowerIsEven, { onTrue: () => lower, onFalse: () => BigInt.increment(lower) })
          })
      })
      return roundedDyadicToNumber(rounded, quantum)
    }
  })

const newtonRoot = (value: number, estimate: number): number =>
  Number.multiply(0.5, Number.sum(estimate, Number.unsafeDivide(value, estimate)))

// Dekker TwoProduct specialized to a square. Callers exclude under/overflow
// of the split and its products. Do not reassociate these operations.
const squareError = (value: number, product: number): number => {
  const split = Number.multiply(134217729, value)
  const high = Number.subtract(split, Number.subtract(split, value))
  const low = Number.subtract(value, high)
  const error1 = Number.subtract(product, Number.multiply(high, high))
  const error2 = Number.subtract(error1, Number.multiply(low, high))
  const error3 = Number.subtract(error2, Number.multiply(high, low))
  return Number.subtract(Number.multiply(low, low), error3)
}

const sqrtFinitePositive = (value: number): number => {
  const normalized = normalize(value)
  const exponent = floor(Number.multiply(normalized.exponent, 0.5))
  const a = Boolean.match(Number.Equivalence(normalized.exponent, Number.multiply(2, exponent)), {
    onTrue: () => normalized.mantissa,
    onFalse: () => Number.multiply(2, normalized.mantissa)
  })
  const initial = Number.multiply(0.5, Number.sum(a, 1))
  const first = newtonRoot(a, initial)
  const second = newtonRoot(a, first)
  const third = newtonRoot(a, second)
  const fourth = newtonRoot(a, third)
  const fifth = newtonRoot(a, fourth)
  const root = newtonRoot(a, fifth)
  // Six steps put g within one spacing u of sqrt(a), 1 <= g <= 2.
  // Dekker TwoProduct: g² = product + error exactly. Do not reassociate.
  const product = Number.multiply(root, root)
  const error = squareError(root, product)
  const residual = Number.subtract(Number.subtract(a, product), error)
  const spacing = 2.220446049250313e-16
  const boundary = Number.multiply(root, spacing)
  const down = Number.sum(residual, boundary)
  const up = Number.subtract(residual, boundary)
  // Distance rounding plus the omitted midpoint term u²/4 is < 25*2^-106.
  // Guard 2^-100 also covers both binade endpoints; ambiguous cases retain
  // exact midpoint/ties-to-even rounding, rather than guessing from Newton.
  const guard = 7.888609052210118e-31
  return Boolean.match(
    Boolean.or(Number.lessThanOrEqualTo(abs(down), guard), Number.lessThanOrEqualTo(abs(up), guard)),
    {
      onTrue: () => sqrtDyadic(decompose(value)),
      onFalse: () => {
        const corrected = Boolean.match(Number.lessThan(down, Number.negate(guard)), {
          onTrue: () => Number.subtract(root, spacing),
          onFalse: () =>
            Boolean.match(Number.greaterThan(up, guard), {
              onTrue: () => Number.sum(root, spacing),
              onFalse: () => root
            })
        })
        return scaleNormal(corrected, exponent)
      }
    }
  )
}

const squareRoot = Match.type<number>().pipe(
  Match.when(isNaN, () => notANumber),
  Match.when(zero, (value) => value),
  Match.when((value) => Number.Equivalence(value, positiveInfinity), () => positiveInfinity),
  Match.when(Number.lessThan(0), () => notANumber),
  Match.orElse(sqrtFinitePositive)
)

/** Principal square root, preserving signed zero and IEEE special values. */
export const sqrt: (value: number) => number = squareRoot

const addHypotTerm = (state: HypotState, value: number): HypotState =>
  Boolean.match(infinity(value), {
    onTrue: () => new HypotState({ ...state, hasInfinity: true }),
    onFalse: () =>
      Boolean.match(isNaN(value), {
        onTrue: () => new HypotState({ ...state, hasNaN: true }),
        onFalse: () =>
          Boolean.match(zero(value), {
            onTrue: () => state,
            onFalse: () => {
              const term = decompose(value)
              const squaredExponent = Number.multiply(2, term.exponent)
              const exponent = Number.min(state.exponent, squaredExponent)
              return new HypotState({
                coefficient: BigInt.sum(
                  BigInt.multiply(state.coefficient, integerPower(2n, Number.subtract(state.exponent, exponent))),
                  BigInt.multiply(
                    BigInt.multiply(term.coefficient, term.coefficient),
                    integerPower(2n, Number.subtract(squaredExponent, exponent))
                  )
                ),
                exponent,
                hasInfinity: state.hasInfinity,
                hasNaN: state.hasNaN
              })
            }
          })
      })
  })

const hypotExact = (values: Chunk.Chunk<number>): number => {
  const state = Chunk.reduce(
    values,
    new HypotState({ coefficient: 0n, exponent: 0, hasInfinity: false, hasNaN: false }),
    addHypotTerm
  )
  return Boolean.match(state.hasInfinity, {
    onTrue: () => positiveInfinity,
    onFalse: () =>
      Boolean.match(state.hasNaN, {
        onTrue: () => notANumber,
        onFalse: () => sqrtDyadic(new Dyadic({ coefficient: state.coefficient, exponent: state.exponent }))
      })
  })
}

const normResidual = (sum: readonly [number, number], root: number): number => {
  const product = Number.multiply(root, root)
  return Number.sum(Number.subtract(Number.subtract(sum[0], product), squareError(root, product)), sum[1])
}

const hypotCompensated = (values: Chunk.Chunk<number>, exponent: number): number => {
  const scale = scaleNormal(1, Number.negate(exponent))
  const sum = Chunk.reduce(values, Tuple.make(0, 0), (state, value) =>
    Boolean.match(zero(value), {
      onTrue: () => state,
      onFalse: () => {
        const scaled = Number.multiply(value, scale)
        // Below 2^-450, a square's low-order product may underflow. Reject
        // the whole floating calculation; never discard small components.
        return Boolean.match(Number.lessThan(abs(scaled), 3.4395525670743494e-136), {
          onTrue: () => Tuple.make(state[0], notANumber),
          onFalse: () => {
            const product = Number.multiply(scaled, scaled)
            const high = Number.sum(state[0], product)
            // Knuth TwoSum: no input ordering assumption.
            const virtual = Number.subtract(high, state[0])
            const error = Number.sum(
              Number.subtract(state[0], Number.subtract(high, virtual)),
              Number.subtract(product, virtual)
            )
            return Tuple.make(high, Number.sum(Number.sum(state[1], squareError(scaled, product)), error))
          }
        })
      }
    }))
  return Boolean.match(isFinite(sum[1]), {
    onFalse: () => hypotExact(values),
    onTrue: () => {
      const initial = sqrt(Number.sum(sum[0], sum[1]))
      const root = Number.sum(initial, Number.unsafeDivide(normResidual(sum, initial), Number.multiply(2, initial)))
      const normalized = normalize(root)
      const gap = scaleNormal(1, Number.subtract(normalized.exponent, 52))
      const gapDown = Boolean.match(Number.Equivalence(normalized.mantissa, 1), {
        onTrue: () => Number.multiply(gap, 0.5),
        onFalse: () => gap
      })
      const residual = normResidual(sum, root)
      const down = Number.sum(residual, Number.multiply(root, gapDown))
      const up = Number.subtract(Number.multiply(root, gap), residual)
      // Error-free products/sums follow Ogita–Rump–Oishi (2005), §5.
      // For n <= 2^16, u = 2^-53, H = sum[0], the absolute sum of
      // corrections is <= 6*n*u*H; rounding their 2*n additions costs
      // <= 24*n²*u²*H. The residual's two roundings, midpoint gap²/4,
      // and boundary comparisons fit within 256*(n+1)²*u²*H, including
      // rounding this bound. Subtraction H-root² is exact by Sterbenz;
      // check that premise below rather than trusting the root estimate.
      const count = Number.increment(Chunk.size(values))
      const guard = Number.multiply(Number.multiply(Number.multiply(count, count), 3.1554436208840472e-30), sum[0])
      const product = Number.multiply(root, root)
      const result = scaleNormal(root, exponent)
      return Boolean.match(
        Boolean.every(Array.make(
          Number.greaterThanOrEqualTo(product, Number.multiply(sum[0], 0.5)),
          Number.lessThanOrEqualTo(product, Number.multiply(sum[0], 2)),
          Number.greaterThan(down, guard),
          Number.greaterThan(up, guard),
          Number.greaterThanOrEqualTo(result, minimumNormal),
          isFinite(result)
        )),
        {
          onTrue: () => result,
          onFalse: () => hypotExact(values)
        }
      )
    }
  })
}

/** Correctly rounded norm; uncertain floating results retain exact dyadic rounding. */
export const hypot = (values: Chunk.Chunk<number>): number => {
  const largest = Chunk.reduce(values, Tuple.make(0, 0), (state, value) =>
    Boolean.match(isFinite(value), {
      onTrue: () => {
        const magnitude = abs(value)
        return Boolean.match(Number.greaterThan(magnitude, state[0]), {
          onTrue: () => Tuple.make(magnitude, state[0]),
          onFalse: () => Tuple.make(state[0], Number.max(state[1], magnitude))
        })
      },
      onFalse: () => Tuple.make(positiveInfinity, positiveInfinity)
    }))
  const maximum = largest[0]
  return Boolean.match(isFinite(maximum), {
    onFalse: () => hypotExact(values),
    onTrue: () =>
      Boolean.match(zero(maximum), {
        onTrue: () => 0,
        onFalse: () => {
          const count = Chunk.size(values)
          // If every remaining magnitude <= maximum * 2^-27 / n, their
          // squares move the root by < maximum * 2^-54, below half the
          // upward spacing. The margin covers rounding the ratio/threshold;
          // an underflowed ratio is smaller still. Includes singleton norms.
          const threshold = Number.unsafeDivide(7.450580596923828e-9, count)
          return Boolean.match(Number.lessThanOrEqualTo(Number.unsafeDivide(largest[1], maximum), threshold), {
            onTrue: () => maximum,
            onFalse: () =>
              Boolean.match(
                Boolean.and(
                  Number.lessThanOrEqualTo(count, 65_536),
                  Number.greaterThanOrEqualTo(maximum, minimumNormal)
                ),
                {
                  onTrue: () => hypotCompensated(values, normalize(maximum).exponent),
                  onFalse: () => hypotExact(values)
                }
              )
          })
        }
      })
  })
}
