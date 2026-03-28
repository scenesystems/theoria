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
import { decodeOperationInput, ensureParameters, matrixToReadonly, ridderConfigFrom } from "./shared.js"

export const derivativeLimitValidated = (f: (x: number) => number, input: unknown) =>
  Effect.gen(function*() {
    const decoded = yield* decodeOperationInput(DerivativeInput, "derivativeLimit", input)
    return derivativeLimit(f, decoded.x, ridderConfigFrom(decoded))
  })

export const secondDerivativeLimitValidated = (f: (x: number) => number, input: unknown) =>
  Effect.gen(function*() {
    const decoded = yield* decodeOperationInput(SecondDerivativeInput, "secondDerivativeLimit", input)
    return secondDerivativeLimit(f, decoded.x, ridderConfigFrom(decoded))
  })

export const derivativeValidated = (f: (x: number) => number, input: unknown) =>
  Effect.map(derivativeLimitValidated(f, input), (estimate) => estimate.value)

export const secondDerivativeValidated = (f: (x: number) => number, input: unknown) =>
  Effect.map(secondDerivativeLimitValidated(f, input), (estimate) => estimate.value)

export const trapezoidValidated = (input: unknown) =>
  Effect.gen(function*() {
    const decoded = yield* decodeOperationInput(TrapezoidInput, "trapezoid", input)
    return trapezoid(Chunk.fromIterable(decoded.values), decoded.dx)
  })

export const simpsonValidated = (input: unknown) =>
  Effect.gen(function*() {
    const decoded = yield* decodeOperationInput(SimpsonInput, "simpson", input)
    return simpson(Chunk.fromIterable(decoded.values), decoded.dx)
  })

export const adaptiveSimpsonValidated = (f: (x: number) => number, input: unknown) =>
  Effect.gen(function*() {
    const decoded = yield* decodeOperationInput(AdaptiveSimpsonInput, "adaptiveSimpson", input)
    return adaptiveSimpson(
      f,
      decoded.a,
      decoded.b,
      decoded.absoluteTolerance,
      decoded.relativeTolerance,
      decoded.maxDepth
    )
  })

export const gradientValidated = (f: (point: Chunk.Chunk<number>) => number, input: unknown) =>
  Effect.gen(function*() {
    const decoded = yield* decodeOperationInput(GradientInput, "gradient", input)
    return Chunk.toReadonlyArray(gradient(f, Chunk.fromIterable(decoded.point), ridderConfigFrom(decoded)))
  })

export const jacobianValidated = (
  f: (point: Chunk.Chunk<number>) => Chunk.Chunk<number>,
  input: unknown
) =>
  Effect.gen(function*() {
    const decoded = yield* decodeOperationInput(JacobianInput, "jacobian", input)
    return matrixToReadonly(jacobian(f, Chunk.fromIterable(decoded.point), ridderConfigFrom(decoded)))
  })

export const hessianValidated = (f: (point: Chunk.Chunk<number>) => number, input: unknown) =>
  Effect.gen(function*() {
    const decoded = yield* decodeOperationInput(HessianInput, "hessian", input)
    return matrixToReadonly(hessian(f, Chunk.fromIterable(decoded.point), ridderConfigFrom(decoded)))
  })

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

    return directionalDerivative(f, point, direction, ridderConfigFrom(decoded))
  })

export const divergenceValidated = (
  f: (point: Chunk.Chunk<number>) => Chunk.Chunk<number>,
  input: unknown
) =>
  Effect.gen(function*() {
    const decoded = yield* decodeOperationInput(DivergenceInput, "divergence", input)
    const point = Chunk.fromIterable(decoded.point)
    const baseline = f(point)

    yield* ensureParameters(
      "divergence",
      Chunk.size(baseline) === Chunk.size(point),
      "Vector-field output dimensions must match point dimensions"
    )

    return divergence(f, point, ridderConfigFrom(decoded))
  })

export const laplacianValidated = (f: (point: Chunk.Chunk<number>) => number, input: unknown) =>
  Effect.gen(function*() {
    const decoded = yield* decodeOperationInput(LaplacianInput, "laplacian", input)
    return laplacian(f, Chunk.fromIterable(decoded.point), ridderConfigFrom(decoded))
  })
