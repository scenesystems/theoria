/**
 * Decodes untrusted calculus inputs and captures synchronous kernel exceptions.
 *
 * @remarks
 * Every boundary rejects excess fields with {@link CalculusDecodeError} and
 * maps exceptions from caller functions to {@link KernelExecutionError}.
 *
 * @since 0.1.0
 * @category operations
 */
import { Chunk, Effect, Number } from "effect"

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
import { decodeOperationInput, ensureParameters, executeKernel } from "./shared.js"

/**
 * Decodes a finite point and Ridder controls before estimating a first derivative.
 *
 * @returns The selected estimate with error, iteration, and convergence metadata.
 * @throws {@link CalculusDecodeError} when the input contract is invalid.
 * @throws {@link KernelExecutionError} when `f` or the synchronous kernel throws.
 *
 * @since 0.2.0
 * @category operations
 */
export const derivativeLimitValidated = (f: (x: number) => number, input: unknown) =>
  Effect.gen(function*() {
    const decoded = yield* decodeOperationInput(DerivativeInput, "derivativeLimit", input)
    return yield* executeKernel("derivativeLimit", () => derivativeLimit(f, decoded.x, decoded))
  })

/**
 * Decodes a finite point and Ridder controls before estimating a second derivative.
 *
 * @returns The selected estimate with error, iteration, and convergence metadata.
 * @throws {@link CalculusDecodeError} when the input contract is invalid.
 * @throws {@link KernelExecutionError} when `f` or the synchronous kernel throws.
 *
 * @since 0.2.0
 * @category operations
 */
export const secondDerivativeLimitValidated = (f: (x: number) => number, input: unknown) =>
  Effect.gen(function*() {
    const decoded = yield* decodeOperationInput(SecondDerivativeInput, "secondDerivativeLimit", input)
    return yield* executeKernel("secondDerivativeLimit", () => secondDerivativeLimit(f, decoded.x, decoded))
  })

/**
 * Decodes first-derivative input and returns only the selected estimate value.
 *
 * @throws {@link CalculusDecodeError} when the input contract is invalid.
 * @throws {@link KernelExecutionError} when `f` or the synchronous kernel throws.
 *
 * @since 0.1.0
 * @category operations
 */
export const derivativeValidated = (f: (x: number) => number, input: unknown) =>
  Effect.map(derivativeLimitValidated(f, input), (estimate) => estimate.value)

/**
 * Decodes second-derivative input and returns only the selected estimate value.
 *
 * @throws {@link CalculusDecodeError} when the input contract is invalid.
 * @throws {@link KernelExecutionError} when `f` or the synchronous kernel throws.
 *
 * @since 0.2.0
 * @category operations
 */
export const secondDerivativeValidated = (f: (x: number) => number, input: unknown) =>
  Effect.map(secondDerivativeLimitValidated(f, input), (estimate) => estimate.value)

/**
 * Integrates decoded finite samples with the composite trapezoidal rule.
 *
 * @remarks
 * The boundary requires at least two samples and a positive finite spacing.
 *
 * @throws {@link CalculusDecodeError} when the input contract is invalid.
 * @throws {@link KernelExecutionError} when the synchronous kernel throws.
 *
 * @since 0.1.0
 * @category operations
 */
export const trapezoidValidated = (input: unknown) =>
  Effect.gen(function*() {
    const decoded = yield* decodeOperationInput(TrapezoidInput, "trapezoid", input)
    return yield* executeKernel("trapezoid", () => trapezoid(decoded.values, decoded.dx))
  })

/**
 * Integrates decoded finite samples with composite Simpson quadrature.
 *
 * @remarks
 * The boundary requires at least two samples and a positive finite spacing.
 * An odd final interval uses the trapezoidal rule.
 *
 * @throws {@link CalculusDecodeError} when the input contract is invalid.
 * @throws {@link KernelExecutionError} when the synchronous kernel throws.
 *
 * @since 0.1.0
 * @category operations
 */
export const simpsonValidated = (input: unknown) =>
  Effect.gen(function*() {
    const decoded = yield* decodeOperationInput(SimpsonInput, "simpson", input)
    return yield* executeKernel("simpson", () => simpson(decoded.values, decoded.dx))
  })

/**
 * Decodes finite bounds and positive recursion controls before adaptive Simpson integration.
 *
 * @remarks
 * Exhausting `maxDepth` succeeds with the current estimate and does not expose
 * convergence metadata.
 *
 * @throws {@link CalculusDecodeError} when the input contract is invalid.
 * @throws {@link KernelExecutionError} when `f` or the synchronous kernel throws.
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
 * Decodes a non-empty finite point before estimating one partial derivative per coordinate.
 *
 * @returns A new `Chunk` in input-coordinate order.
 * @throws {@link CalculusDecodeError} when the input contract is invalid.
 * @throws {@link KernelExecutionError} when `f` or the synchronous kernel throws.
 *
 * @since 0.2.0
 * @category operations
 */
export const gradientValidated = (f: (point: Chunk.Chunk<number>) => number, input: unknown) =>
  Effect.gen(function*() {
    const decoded = yield* decodeOperationInput(GradientInput, "gradient", input)
    return yield* executeKernel("gradient", () => gradient(f, decoded.point, decoded))
  })

/**
 * Decodes a non-empty finite point before estimating a vector field's Jacobian.
 *
 * @returns New `Chunk` rows in output-component order, with columns in
 * input-coordinate order.
 * @throws {@link CalculusDecodeError} when the input contract is invalid.
 * @throws {@link KernelExecutionError} when `f` or the synchronous kernel throws.
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
    return yield* executeKernel("jacobian", () => jacobian(f, decoded.point, decoded))
  })

/**
 * Decodes a non-empty finite point before estimating a scalar function's Hessian.
 *
 * @returns A new square matrix of `Chunk` rows in input-coordinate order.
 * @throws {@link CalculusDecodeError} when the input contract is invalid.
 * @throws {@link KernelExecutionError} when `f` or the synchronous kernel throws.
 *
 * @since 0.2.0
 * @category operations
 */
export const hessianValidated = (f: (point: Chunk.Chunk<number>) => number, input: unknown) =>
  Effect.gen(function*() {
    const decoded = yield* decodeOperationInput(HessianInput, "hessian", input)
    return yield* executeKernel("hessian", () => hessian(f, decoded.point, decoded))
  })

/**
 * Decodes equal-length point and direction vectors before estimating a directional derivative.
 *
 * @remarks
 * The direction is normalized. A zero vector passes decoding and returns `NaN`.
 *
 * @throws {@link CalculusDecodeError} when the input contract is invalid.
 * @throws {@link CalculusParameterError} when the vector lengths differ.
 * @throws {@link KernelExecutionError} when `f` or the synchronous kernel throws.
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
    const point = decoded.point
    const direction = decoded.direction

    yield* ensureParameters(
      "directionalDerivative",
      Number.Equivalence(Chunk.size(point), Chunk.size(direction)),
      "Point and direction dimensions must match"
    )

    return yield* executeKernel("directionalDerivative", () => directionalDerivative(f, point, direction, decoded))
  })

/**
 * Decodes a point and requires matching field dimensions before estimating divergence.
 *
 * @remarks
 * The field is evaluated at `point` for the dimension check, then evaluated
 * again by the differentiation kernel. Callers should supply a stable,
 * side-effect-free function.
 *
 * @throws {@link CalculusDecodeError} when the input contract is invalid.
 * @throws {@link CalculusParameterError} when the field output length differs from the point length.
 * @throws {@link KernelExecutionError} when `f` or the synchronous kernel throws.
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
    const point = decoded.point
    const baseline = yield* executeKernel("divergence", () => f(point))

    yield* ensureParameters(
      "divergence",
      Number.Equivalence(Chunk.size(baseline), Chunk.size(point)),
      "Vector-field output dimensions must match point dimensions"
    )

    return yield* executeKernel("divergence", () => divergence(f, point, decoded))
  })

/**
 * Decodes a non-empty finite point before estimating a scalar function's Laplacian.
 *
 * @throws {@link CalculusDecodeError} when the input contract is invalid.
 * @throws {@link KernelExecutionError} when `f` or the synchronous kernel throws.
 *
 * @since 0.2.0
 * @category operations
 */
export const laplacianValidated = (f: (point: Chunk.Chunk<number>) => number, input: unknown) =>
  Effect.gen(function*() {
    const decoded = yield* decodeOperationInput(LaplacianInput, "laplacian", input)
    return yield* executeKernel(
      "laplacian",
      () => laplacian(f, decoded.point, decoded)
    )
  })
