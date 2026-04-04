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
 * Schema-decoded boundary for `derivativeLimit`.
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
 * Schema-decoded boundary for `secondDerivativeLimit`.
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
 * Schema-decoded boundary for first derivative values.
 *
 * @since 0.1.0
 * @category operations
 */
export const derivativeValidated = (f: (x: number) => number, input: unknown) =>
  Effect.map(derivativeLimitValidated(f, input), (estimate) => estimate.value)

/**
 * Schema-decoded boundary for second derivative values.
 *
 * @since 0.2.0
 * @category operations
 */
export const secondDerivativeValidated = (f: (x: number) => number, input: unknown) =>
  Effect.map(secondDerivativeLimitValidated(f, input), (estimate) => estimate.value)

/**
 * Schema-decoded boundary for trapezoidal integration.
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
 * Schema-decoded boundary for Simpson integration.
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
 * Schema-decoded boundary for adaptive Simpson integration.
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
 * Schema-decoded boundary for gradient evaluation.
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
 * Schema-decoded boundary for Jacobian evaluation.
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
 * Schema-decoded boundary for Hessian evaluation.
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
 * Schema-decoded boundary for directional derivative evaluation.
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
 * Schema-decoded boundary for divergence evaluation.
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
 * Schema-decoded boundary for Laplacian evaluation.
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
