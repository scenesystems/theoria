/**
 * Schema-decoded calculus operation boundaries.
 *
 * @since 0.1.0
 * @category operations
 */
import { Chunk, Effect } from "effect"

import {
  AdaptiveSimpsonInput,
  DerivativeInput,
  DirectionalDerivativeInput,
  DivergenceInput,
  GradientInput,
  HessianInput,
  JacobianInput,
  LaplacianInput,
  SecondDerivativeInput,
  SimpsonInput,
  TrapezoidInput
} from "../schema.js"
import {
  adaptiveSimpson,
  derivativeLimit,
  directionalDerivative,
  divergence,
  gradient,
  hessian,
  jacobian,
  laplacian,
  secondDerivativeLimit,
  simpson,
  trapezoid
} from "./pure.js"
import { decodeOperationInput, ensureParameters, executeKernel, matrixToReadonly, ridderConfigFrom } from "./shared.js"

/**
 * Estimates `f′(x)` by Ridder extrapolation and reports value, error, and
 * convergence metadata. Boundary decoding accepts a finite point plus optional
 * controls; malformed input fails with `CalculusDecodeError`, while callback
 * or kernel exceptions become `KernelExecutionError`.
 *
 * @since 0.2.0
 * @category operations
 */
export const derivativeLimitValidated = (f: (x: number) => number, input: unknown) =>
  Effect.gen(function*() {
    const decoded = yield* decodeOperationInput(DerivativeInput, "derivativeLimit", input)
    return yield* executeKernel("derivativeLimit", () => derivativeLimit(f, decoded.x, ridderConfigFrom(decoded)))
  })

/**
 * Approximates `f″(x)` with second-order Ridder extrapolation, preserving the
 * selected estimate's uncertainty and convergence status. It rejects invalid
 * points or controls as `CalculusDecodeError` and captures failures raised while
 * evaluating the supplied function as `KernelExecutionError`.
 *
 * @since 0.2.0
 * @category operations
 */
export const secondDerivativeLimitValidated = (f: (x: number) => number, input: unknown) =>
  Effect.gen(function*() {
    const decoded = yield* decodeOperationInput(SecondDerivativeInput, "secondDerivativeLimit", input)
    return yield* executeKernel("secondDerivativeLimit", () =>
      secondDerivativeLimit(f, decoded.x, ridderConfigFrom(decoded)))
  })

/**
 * Returns only the first-derivative value from the validated Ridder estimate.
 * It retains the same strict decoding and typed decode/kernel failure boundary
 * as {@link derivativeLimitValidated}, but discards error and convergence metadata.
 *
 * @since 0.1.0
 * @category operations
 */
export const derivativeValidated = (f: (x: number) => number, input: unknown) =>
  Effect.map(derivativeLimitValidated(f, input), (estimate) => estimate.value)

/**
 * Returns only the second-derivative value from the validated Ridder estimate.
 * It retains the same strict decoding and typed decode/kernel failure boundary
 * as {@link secondDerivativeLimitValidated}, but discards estimate metadata.
 *
 * @since 0.2.0
 * @category operations
 */
export const secondDerivativeValidated = (f: (x: number) => number, input: unknown) =>
  Effect.map(secondDerivativeLimitValidated(f, input), (estimate) => estimate.value)

/**
 * Decodes at least two finite, equally spaced samples and a positive finite
 * spacing, then applies the composite trapezoidal rule. Malformed or excess
 * input fails with `CalculusDecodeError`; kernel exceptions are typed as
 * `KernelExecutionError`.
 *
 * @since 0.1.0
 * @category operations
 */
export const trapezoidValidated = (input: unknown) =>
  Effect.gen(function*() {
    const decoded = yield* decodeOperationInput(TrapezoidInput, "trapezoid", input)
    return yield* executeKernel("trapezoid", () => trapezoid(Chunk.fromIterable(decoded.values), decoded.dx))
  })

/**
 * Decodes at least two finite, equally spaced samples and a positive finite
 * spacing, then applies composite Simpson integration. An odd final interval
 * is integrated by trapezoid. Malformed input fails with `CalculusDecodeError`;
 * kernel exceptions fail with `KernelExecutionError`.
 *
 * @since 0.1.0
 * @category operations
 */
export const simpsonValidated = (input: unknown) =>
  Effect.gen(function*() {
    const decoded = yield* decodeOperationInput(SimpsonInput, "simpson", input)
    return yield* executeKernel("simpson", () => simpson(Chunk.fromIterable(decoded.values), decoded.dx))
  })

/**
 * Decodes finite interval endpoints, non-negative tolerances, and a positive
 * recursion budget, then returns the adaptive integral estimate. Exhausting
 * the depth budget returns the current estimate rather than a convergence
 * failure; decode and callback/kernel exceptions remain distinct typed failures.
 *
 * @since 0.2.0
 * @category operations
 */
export const adaptiveSimpsonValidated = (f: (x: number) => number, input: unknown) =>
  Effect.gen(function*() {
    const decoded = yield* decodeOperationInput(AdaptiveSimpsonInput, "adaptiveSimpson", input)
    return yield* executeKernel("adaptiveSimpson", () =>
      adaptiveSimpson(
        f,
        decoded.a,
        decoded.b,
        decoded.absoluteTolerance,
        decoded.relativeTolerance,
        decoded.maxDepth
      ))
  })

/**
 * Decodes a non-empty finite point and optional Ridder controls, then returns
 * one partial derivative per coordinate. Schema rejection fails with
 * `CalculusDecodeError`; exceptions from `f` or differentiation fail with
 * `KernelExecutionError`.
 *
 * @since 0.2.0
 * @category operations
 */
export const gradientValidated = (f: (point: Chunk.Chunk<number>) => number, input: unknown) =>
  Effect.gen(function*() {
    const decoded = yield* decodeOperationInput(GradientInput, "gradient", input)
    return yield* executeKernel("gradient", () =>
      Chunk.toReadonlyArray(gradient(f, Chunk.fromIterable(decoded.point), ridderConfigFrom(decoded))))
  })

/**
 * Decodes a non-empty finite point and optional Ridder controls, then returns
 * the vector-valued function's Jacobian as rows by output component. Invalid
 * boundary input and callback/kernel exceptions use distinct typed failures.
 *
 * @since 0.2.0
 * @category operations
 */
export const jacobianValidated = (
  f: (point: Chunk.Chunk<number>) => Chunk.Chunk<number>,
  input: unknown
) =>
  Effect.gen(function*() {
    const decoded = yield* decodeOperationInput(JacobianInput, "jacobian", input)
    return yield* executeKernel("jacobian", () =>
      matrixToReadonly(jacobian(f, Chunk.fromIterable(decoded.point), ridderConfigFrom(decoded))))
  })

/**
 * Decodes a non-empty finite point and optional Ridder controls, then returns
 * the scalar function's square Hessian. Invalid boundary input fails with
 * `CalculusDecodeError`; callback or kernel exceptions fail with
 * `KernelExecutionError`.
 *
 * @since 0.2.0
 * @category operations
 */
export const hessianValidated = (f: (point: Chunk.Chunk<number>) => number, input: unknown) =>
  Effect.gen(function*() {
    const decoded = yield* decodeOperationInput(HessianInput, "hessian", input)
    return yield* executeKernel("hessian", () =>
      matrixToReadonly(hessian(f, Chunk.fromIterable(decoded.point), ridderConfigFrom(decoded))))
  })

/**
 * Decodes finite point and direction vectors plus optional Ridder controls,
 * requires equal dimensions, and evaluates the derivative along the supplied
 * direction. Decode, dimension, and callback/kernel failures remain
 * distinguishable as typed errors.
 *
 * @since 0.2.0
 * @category operations
 */
export const directionalDerivativeValidated = (
  f: (point: Chunk.Chunk<number>) => number,
  input: unknown
) =>
  Effect.gen(function*() {
    const decoded = yield* decodeOperationInput(
      DirectionalDerivativeInput,
      "directionalDerivative",
      input
    )
    const point = Chunk.fromIterable(decoded.point)
    const direction = Chunk.fromIterable(decoded.direction)

    yield* ensureParameters(
      "directionalDerivative",
      Chunk.size(point) === Chunk.size(direction),
      "Point and direction dimensions must match"
    )

    return yield* executeKernel("directionalDerivative", () =>
      directionalDerivative(f, point, direction, ridderConfigFrom(decoded)))
  })

/**
 * Decodes a non-empty finite point and optional Ridder controls, verifies that
 * the vector field returns one component per coordinate, then sums its diagonal
 * partial derivatives. Decode, dimension, and callback/kernel failures remain
 * distinguishable as typed errors.
 *
 * @since 0.2.0
 * @category operations
 */
export const divergenceValidated = (
  f: (point: Chunk.Chunk<number>) => Chunk.Chunk<number>,
  input: unknown
) =>
  Effect.gen(function*() {
    const decoded = yield* decodeOperationInput(DivergenceInput, "divergence", input)
    const point = Chunk.fromIterable(decoded.point)
    const baseline = yield* executeKernel("divergence", () => f(point))

    yield* ensureParameters(
      "divergence",
      Chunk.size(baseline) === Chunk.size(point),
      "Vector-field output dimensions must match point dimensions"
    )

    return yield* executeKernel("divergence", () => divergence(f, point, ridderConfigFrom(decoded)))
  })

/**
 * Decodes a non-empty finite point and optional Ridder controls, then sums the
 * scalar function's second partial derivatives. Schema rejection fails with
 * `CalculusDecodeError`; callback or kernel exceptions fail with
 * `KernelExecutionError`.
 *
 * @since 0.2.0
 * @category operations
 */
export const laplacianValidated = (f: (point: Chunk.Chunk<number>) => number, input: unknown) =>
  Effect.gen(function*() {
    const decoded = yield* decodeOperationInput(LaplacianInput, "laplacian", input)
    return yield* executeKernel(
      "laplacian",
      () => laplacian(f, Chunk.fromIterable(decoded.point), ridderConfigFrom(decoded))
    )
  })
