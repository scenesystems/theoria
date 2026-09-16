/**
 * Complex arithmetic, polar conversion, trigonometry, and dense-vector operations.
 *
 * @since 0.1.0
 * @module
 */
import { Array, Chunk, Effect, Number, Schema, Tuple } from "effect"
import { dual } from "effect/Function"

import * as Arithmetic from "./internal/complex/arithmetic.js"
import * as Trigonometric from "./internal/complex/trigonometric.js"
import * as PolicyGuard from "./internal/policyGuard.js"
import * as Numeric from "./Numeric.js"

const encodeNumber = Schema.encodeSync(Schema.NumberFromString)

/**
 * A schema-backed Cartesian complex value. Components preserve the full IEEE
 * 754 number domain; validated operations use the finite refinements below.
 *
 * @since 0.1.0
 * @category models
 */
export class Complex extends Schema.Class<Complex>("Complex")(
  {
    /** Real component. */
    re: Schema.Number,
    /** Imaginary component. */
    im: Schema.Number
  },
  { identifier: "@scenesystems/effect-math/Complex/Complex" }
) {}

/**
 * Accepts a non-negative radius and an angle in radians.
 *
 * @since 0.4.0
 * @category schemas
 */
export const Polar = Schema.Tuple(
  Schema.Number.pipe(Schema.nonNegative()),
  Schema.Number
).annotations({ identifier: "@scenesystems/effect-math/Complex/Polar" })

/**
 * A polar `[radius, angle]` pair.
 *
 * @since 0.4.0
 * @category models
 */
export type Polar = typeof Polar.Type

/**
 * Accepts finite components derived from the canonical complex value fields.
 *
 * @since 0.1.0
 * @category schemas
 */
export const Input = Schema.Struct({
  re: Complex.fields.re.pipe(Schema.finite()),
  im: Complex.fields.im.pipe(Schema.finite())
}).annotations({ identifier: "@scenesystems/effect-math/Complex/Input" })

/**
 * Finite Cartesian input for validated unary operations.
 *
 * @since 0.1.0
 * @category models
 */
export type Input = typeof Input.Type

/**
 * Accepts two finite Cartesian operands using the canonical component fields.
 *
 * @since 0.1.0
 * @category schemas
 */
export const BinaryInput = Schema.Struct({
  aRe: Input.fields.re,
  aIm: Input.fields.im,
  bRe: Input.fields.re,
  bIm: Input.fields.im
}).annotations({ identifier: "@scenesystems/effect-math/Complex/BinaryInput" })

/**
 * A finite pair of Cartesian operands for validated binary operations.
 *
 * @since 0.1.0
 * @category models
 */
export type BinaryInput = typeof BinaryInput.Type

/**
 * Reports malformed input to a validated complex operation.
 *
 * @since 0.1.0
 * @category errors
 */
export class DecodeError extends Schema.TaggedError<DecodeError>()("ComplexDecodeError", {
  /** Operation whose input failed decoding. */
  operation: Schema.String,
  /** Effect Schema issue report. */
  message: Schema.String
}) {}

/**
 * Reports a non-finite result rejected by strict precision.
 *
 * @since 0.1.0
 * @category errors
 */
export class DomainViolationError extends Schema.TaggedError<DomainViolationError>()("ComplexDomainViolationError", {
  /** Policy-aware operation that produced the result. */
  operation: Schema.String,
  /** Diagnostic describing the rejected result. */
  message: Schema.String
}) {}

/**
 * Failures emitted by validated and policy-aware complex operations.
 *
 * @since 0.1.0
 * @category errors
 */
export type OperationError = DecodeError | DomainViolationError

const decode = <A, I, R>(schema: Schema.Schema<A, I, R>, operation: string, input: unknown) =>
  Schema.decodeUnknown(schema)(input, { onExcessProperty: "error" }).pipe(
    Effect.mapError((error) => new DecodeError({ operation, message: error.message }))
  )

const fromCartesian = (components: Arithmetic.Cartesian): Complex =>
  new Complex({ re: Tuple.getFirst(components), im: Tuple.getSecond(components) })

/**
 * Constructs a complex value without normalization or finiteness checks.
 *
 * @since 0.1.0
 * @category constructors
 */
export const make = (re: number, im: number): Complex => new Complex({ re, im })

/**
 * Constructs a value on the real axis.
 *
 * @since 0.1.0
 * @category constructors
 */
export const fromReal = (re: number): Complex => new Complex({ re, im: 0 })

/**
 * Constructs a value on the imaginary axis.
 *
 * @since 0.1.0
 * @category constructors
 */
export const fromImaginary = (im: number): Complex => new Complex({ re: 0, im })

/**
 * Constructs a value from a non-negative radius and angle in radians. The
 * trusted operation does not validate the radius at runtime.
 *
 * @since 0.1.0
 * @category constructors
 */
export const fromPolar = (radius: number, angle: number): Complex =>
  new Complex({
    re: Number.multiply(radius, Numeric.cos(angle)),
    im: Number.multiply(radius, Numeric.sin(angle))
  })

/**
 * The additive identity.
 *
 * @since 0.1.0
 * @category constants
 */
export const zero = new Complex({ re: 0, im: 0 })

/**
 * The multiplicative identity.
 *
 * @since 0.1.0
 * @category constants
 */
export const one = new Complex({ re: 1, im: 0 })

/**
 * The imaginary unit.
 *
 * @since 0.1.0
 * @category constants
 */
export const i = new Complex({ re: 0, im: 1 })

/**
 * Adds `that` to `self`, in data-first or data-last form.
 *
 * @since 0.1.0
 * @category operations
 */
export const add: {
  (that: Complex): (self: Complex) => Complex
  (self: Complex, that: Complex): Complex
} = dual(
  2,
  (self: Complex, that: Complex): Complex => fromCartesian(Arithmetic.add(self.re, self.im, that.re, that.im))
)

/**
 * Subtracts `that` from `self`, in data-first or data-last form.
 *
 * @since 0.1.0
 * @category operations
 */
export const subtract: {
  (that: Complex): (self: Complex) => Complex
  (self: Complex, that: Complex): Complex
} = dual(
  2,
  (self: Complex, that: Complex): Complex => fromCartesian(Arithmetic.subtract(self.re, self.im, that.re, that.im))
)

/**
 * Multiplies `self` by `that`, in data-first or data-last form.
 *
 * @since 0.1.0
 * @category operations
 */
export const multiply: {
  (that: Complex): (self: Complex) => Complex
  (self: Complex, that: Complex): Complex
} = dual(
  2,
  (self: Complex, that: Complex): Complex => fromCartesian(Arithmetic.multiply(self.re, self.im, that.re, that.im))
)

/**
 * Divides `self` by `that` with Smith's overflow-resistant method. A zero
 * divisor produces `NaN` components rather than a typed failure.
 *
 * @since 0.1.0
 * @category operations
 */
export const divide: {
  (that: Complex): (self: Complex) => Complex
  (self: Complex, that: Complex): Complex
} = dual(
  2,
  (self: Complex, that: Complex): Complex => fromCartesian(Arithmetic.divide(self.re, self.im, that.re, that.im))
)

/**
 * Reflects a value across the real axis.
 *
 * @since 0.1.0
 * @category operations
 */
export const conjugate = (value: Complex): Complex => fromCartesian(Arithmetic.conjugate(value.re, value.im))

/**
 * Computes the modulus with an overflow-resistant hypotenuse operation.
 *
 * @since 0.1.0
 * @category operations
 */
export const abs = (value: Complex): number => Arithmetic.abs(value.re, value.im)

/**
 * Computes the principal phase angle in `(-π, π]`.
 *
 * @since 0.1.0
 * @category operations
 */
export const arg = (value: Complex): number => Arithmetic.arg(value.re, value.im)

/**
 * Computes `exp(a + bi) = exp(a)(cos(b) + i sin(b))`.
 *
 * @since 0.1.0
 * @category operations
 */
export const exp = (value: Complex): Complex => fromCartesian(Arithmetic.exp(value.re, value.im))

/**
 * Computes the principal complex logarithm with argument in `(-π, π]`.
 * Zero maps to `-Infinity + 0i`.
 *
 * @since 0.1.0
 * @category operations
 */
export const log = (value: Complex): Complex => fromCartesian(Arithmetic.log(value.re, value.im))

/**
 * Raises `self` to a complex exponent in data-first or data-last form. The
 * operation defines `0^0` as one and `0^w` as zero for nonzero `w`.
 *
 * @since 0.1.0
 * @category operations
 */
export const pow: {
  (exponent: Complex): (self: Complex) => Complex
  (self: Complex, exponent: Complex): Complex
} = dual(
  2,
  (self: Complex, exponent: Complex): Complex =>
    fromCartesian(Arithmetic.pow(self.re, self.im, exponent.re, exponent.im))
)

/**
 * Computes the principal complex square root. Negative real values produce a
 * non-negative imaginary component.
 *
 * @since 0.1.0
 * @category operations
 */
export const sqrt = (value: Complex): Complex => fromCartesian(Arithmetic.sqrt(value.re, value.im))

/**
 * Converts a Cartesian value to `[radius, principalAngle]`.
 *
 * @since 0.1.0
 * @category operations
 */
export const toPolar = (value: Complex): Polar =>
  Tuple.make(Arithmetic.abs(value.re, value.im), Arithmetic.arg(value.re, value.im))

/**
 * Computes complex sine from the analytic continuation of the real function.
 *
 * @since 0.1.0
 * @category operations
 */
export const sin = (value: Complex): Complex => fromCartesian(Trigonometric.sin(value.re, value.im))

/**
 * Computes complex cosine from the analytic continuation of the real function.
 *
 * @since 0.1.0
 * @category operations
 */
export const cos = (value: Complex): Complex => fromCartesian(Trigonometric.cos(value.re, value.im))

/**
 * Computes `sin(z) / cos(z)`; poles produce `NaN` components.
 *
 * @since 0.1.0
 * @category operations
 */
export const tan = (value: Complex): Complex => fromCartesian(Trigonometric.tan(value.re, value.im))

/**
 * Computes complex hyperbolic sine.
 *
 * @since 0.1.0
 * @category operations
 */
export const sinh = (value: Complex): Complex => fromCartesian(Trigonometric.sinh(value.re, value.im))

/**
 * Computes complex hyperbolic cosine.
 *
 * @since 0.1.0
 * @category operations
 */
export const cosh = (value: Complex): Complex => fromCartesian(Trigonometric.cosh(value.re, value.im))

/**
 * Computes `sinh(z) / cosh(z)`; poles produce `NaN` components.
 *
 * @since 0.1.0
 * @category operations
 */
export const tanh = (value: Complex): Complex => fromCartesian(Trigonometric.tanh(value.re, value.im))

/**
 * Computes the sesquilinear inner product `Σ conj(selfᵢ) * thatᵢ`. Inputs are
 * zipped, so unmatched trailing elements are ignored.
 *
 * @since 0.1.0
 * @category operations
 */
export const dot: {
  (that: Chunk.Chunk<Complex>): (self: Chunk.Chunk<Complex>) => Complex
  (self: Chunk.Chunk<Complex>, that: Chunk.Chunk<Complex>): Complex
} = dual(2, (self: Chunk.Chunk<Complex>, that: Chunk.Chunk<Complex>): Complex => {
  const initial: Arithmetic.Cartesian = Tuple.make(0, 0)
  const result = Chunk.zipWith(self, that, (left, right) => {
    const conjugated = Arithmetic.conjugate(left.re, left.im)
    return Arithmetic.multiply(Tuple.getFirst(conjugated), Tuple.getSecond(conjugated), right.re, right.im)
  }).pipe(
    Chunk.reduce(initial, (accumulator, value) =>
      Arithmetic.add(
        Tuple.getFirst(accumulator),
        Tuple.getSecond(accumulator),
        Tuple.getFirst(value),
        Tuple.getSecond(value)
      ))
  )
  return fromCartesian(result)
})

/**
 * Computes `sqrt(Σ |zᵢ|²)` for a complex vector.
 *
 * @since 0.1.0
 * @category operations
 */
export const norm = (values: Chunk.Chunk<Complex>): number =>
  Numeric.sqrt(
    Chunk.reduce(values, 0, (accumulator, value) =>
      Number.sum(
        accumulator,
        Number.sum(Number.multiply(value.re, value.re), Number.multiply(value.im, value.im))
      ))
  )

/**
 * Multiplies every vector element by a complex scalar.
 *
 * @since 0.1.0
 * @category operations
 */
export const scale: {
  (scalar: Complex): (self: Chunk.Chunk<Complex>) => Chunk.Chunk<Complex>
  (self: Chunk.Chunk<Complex>, scalar: Complex): Chunk.Chunk<Complex>
} = dual(
  2,
  (self: Chunk.Chunk<Complex>, scalar: Complex): Chunk.Chunk<Complex> =>
    Chunk.map(self, (value) => fromCartesian(Arithmetic.multiply(value.re, value.im, scalar.re, scalar.im)))
)

/**
 * Lifts real values onto the complex plane.
 *
 * @since 0.1.0
 * @category conversions
 */
export const fromRealChunk = (values: Chunk.Chunk<number>): Chunk.Chunk<Complex> => Chunk.map(values, fromReal)

/**
 * Extracts real components from a complex vector.
 *
 * @since 0.1.0
 * @category conversions
 */
export const toRealChunk = (values: Chunk.Chunk<Complex>): Chunk.Chunk<number> => Chunk.map(values, (value) => value.re)

/**
 * Extracts imaginary components from a complex vector.
 *
 * @since 0.1.0
 * @category conversions
 */
export const toImaginaryChunk = (values: Chunk.Chunk<Complex>): Chunk.Chunk<number> =>
  Chunk.map(values, (value) => value.im)

/**
 * Computes each vector element's modulus.
 *
 * @since 0.1.0
 * @category conversions
 */
export const toMagnitudeChunk = (values: Chunk.Chunk<Complex>): Chunk.Chunk<number> => Chunk.map(values, abs)

/**
 * Computes each vector element's principal phase.
 *
 * @since 0.1.0
 * @category conversions
 */
export const toPhaseChunk = (values: Chunk.Chunk<Complex>): Chunk.Chunk<number> => Chunk.map(values, arg)

/**
 * Adds finite Cartesian operands after decoding with excess properties rejected.
 *
 * @since 0.1.0
 * @category validated operations
 */
export const addValidated = (input: unknown) =>
  Effect.map(
    decode(BinaryInput, "add", input),
    (value) => fromCartesian(Arithmetic.add(value.aRe, value.aIm, value.bRe, value.bIm))
  )

/**
 * Subtracts the second decoded finite operand from the first.
 *
 * @since 0.1.0
 * @category validated operations
 */
export const subtractValidated = (input: unknown) =>
  Effect.map(
    decode(BinaryInput, "subtract", input),
    (value) => fromCartesian(Arithmetic.subtract(value.aRe, value.aIm, value.bRe, value.bIm))
  )

/**
 * Multiplies finite Cartesian operands after strict boundary decoding.
 *
 * @since 0.1.0
 * @category validated operations
 */
export const multiplyValidated = (input: unknown) =>
  Effect.map(
    decode(BinaryInput, "multiply", input),
    (value) => fromCartesian(Arithmetic.multiply(value.aRe, value.aIm, value.bRe, value.bIm))
  )

/**
 * Divides decoded finite operands. A zero divisor still produces `NaN`
 * components, matching the trusted operation.
 *
 * @since 0.1.0
 * @category validated operations
 */
export const divideValidated = (input: unknown) =>
  Effect.map(
    decode(BinaryInput, "divide", input),
    (value) => fromCartesian(Arithmetic.divide(value.aRe, value.aIm, value.bRe, value.bIm))
  )

/**
 * Computes an exponential after decoding finite Cartesian components.
 *
 * @since 0.1.0
 * @category validated operations
 */
export const expValidated = (input: unknown) =>
  Effect.map(decode(Input, "exp", input), (value) => fromCartesian(Arithmetic.exp(value.re, value.im)))

/**
 * Computes the principal logarithm after decoding finite components. Zero is
 * accepted and maps to `-Infinity + 0i`.
 *
 * @since 0.1.0
 * @category validated operations
 */
export const logValidated = (input: unknown) =>
  Effect.map(decode(Input, "log", input), (value) => fromCartesian(Arithmetic.log(value.re, value.im)))

/**
 * Computes a modulus under runtime precision and diagnostic policies. Strict
 * precision rejects a non-finite result; diagnostics include input and result.
 *
 * @since 0.1.0
 * @category policy-aware operations
 */
export const absWithPolicies = (value: Complex) =>
  PolicyGuard.scalar({
    operation: "Complex.absWithPolicies",
    compute: () => abs(value),
    makeError: (message) => new DomainViolationError({ operation: "absWithPolicies", message }),
    annotations: (result) => ({
      input: Array.join(Array.make(encodeNumber(value.re), "+", encodeNumber(value.im), "i"), ""),
      result: encodeNumber(result)
    })
  })

/**
 * Computes a principal phase under runtime precision and diagnostic policies.
 * Strict precision rejects a non-finite result.
 *
 * @since 0.1.0
 * @category policy-aware operations
 */
export const argWithPolicies = (value: Complex) =>
  PolicyGuard.scalar({
    operation: "Complex.argWithPolicies",
    compute: () => arg(value),
    makeError: (message) => new DomainViolationError({ operation: "argWithPolicies", message }),
    annotations: (result) => ({
      input: Array.join(Array.make(encodeNumber(value.re), "+", encodeNumber(value.im), "i"), ""),
      result: encodeNumber(result)
    })
  })
