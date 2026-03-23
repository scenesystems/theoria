/**
 * LinearAlgebra domain operations.
 *
 * @since 0.1.0
 * @category operations
 */
import { Chunk, Clock, Effect, Match, Number as N, Schema } from "effect"

import {
  BackendPolicyService,
  DiagnosticsPolicyService,
  PrecisionPolicyService
} from "../contracts/shared/RuntimePolicies.js"
import { LinearAlgebraDecodeError, LinearAlgebraDomainViolationError, ShapeMismatchError } from "./errors.js"
import * as Matrix from "./internal/matrix.js"
import * as Vector from "./internal/vector.js"
import { LinearAlgebraDomainModel } from "./model.js"
import { DotProductInput, MatvecInput, NormInput, TransposeInput } from "./schema.js"

/**
 * LinearAlgebra domain model loader.
 *
 * @since 0.1.0
 * @category operations
 */
export const loadLinearAlgebraDomain = Effect.succeed(LinearAlgebraDomainModel)

// ---------------------------------------------------------------------------
// Pure kernel re-exports — operate on Chunk<number>
// ---------------------------------------------------------------------------

/**
 * Dot product of two equal-length chunks.
 *
 * @since 0.1.0
 * @category operations
 */
export const dot: (a: Chunk.Chunk<number>, b: Chunk.Chunk<number>) => number = Vector.dot

/**
 * Euclidean (L2) norm.
 *
 * @since 0.1.0
 * @category operations
 */
export const normL2: (v: Chunk.Chunk<number>) => number = Vector.normL2

/**
 * L1 norm (sum of absolute values).
 *
 * @since 0.1.0
 * @category operations
 */
export const normL1: (v: Chunk.Chunk<number>) => number = Vector.normL1

/**
 * Infinity norm (maximum absolute value).
 *
 * @since 0.1.0
 * @category operations
 */
export const normLinf: (v: Chunk.Chunk<number>) => number = Vector.normLinf

/**
 * Elementwise vector addition.
 *
 * @since 0.1.0
 * @category operations
 */
export const vectorAdd: (
  a: Chunk.Chunk<number>,
  b: Chunk.Chunk<number>
) => Chunk.Chunk<number> = Vector.add

/**
 * Scalar-vector multiplication.
 *
 * @since 0.1.0
 * @category operations
 */
export const vectorScale: (
  alpha: number,
  v: Chunk.Chunk<number>
) => Chunk.Chunk<number> = Vector.scale

/**
 * Matrix-vector multiply: y = A * x. Row-major layout with contiguous stride.
 *
 * @since 0.1.0
 * @category operations
 */
export const matvec = (
  data: Chunk.Chunk<number>,
  rows: number,
  cols: number,
  x: Chunk.Chunk<number>
): Chunk.Chunk<number> => Matrix.matvec(data, rows, cols, cols, 0, x)

/**
 * Matrix transpose. Returns new chunk with transposed layout.
 *
 * @since 0.1.0
 * @category operations
 */
export const transpose = (
  data: Chunk.Chunk<number>,
  rows: number,
  cols: number
): Chunk.Chunk<number> => Matrix.transpose(data, rows, cols, cols, 0)

/**
 * Frobenius norm of a matrix.
 *
 * @since 0.1.0
 * @category operations
 */
export const frobeniusNorm = (
  data: Chunk.Chunk<number>,
  rows: number,
  cols: number
): number => Matrix.frobeniusNorm(data, rows, cols, cols, 0)

// ---------------------------------------------------------------------------
// Effect-wrapped operations with schema-validated input
// ---------------------------------------------------------------------------

/**
 * Effect-wrapped dot product with schema-validated input.
 *
 * @since 0.1.0
 * @category operations
 */
export const dotEffect = (input: unknown) =>
  Effect.gen(function*() {
    const decoded = yield* Schema.decodeUnknown(DotProductInput)(input, {
      onExcessProperty: "error"
    }).pipe(
      Effect.mapError((error) =>
        new LinearAlgebraDecodeError({
          operation: "dot",
          message: error.message
        })
      )
    )

    yield* Effect.filterOrFail(
      Effect.succeed(decoded),
      (d) => N.Equivalence(d.a.length, d.b.length),
      (d) =>
        new ShapeMismatchError({
          operation: "dot",
          expected: `length ${d.a.length}`,
          actual: `length ${d.b.length}`,
          message: `Dot product requires vectors of equal length`
        })
    )

    return Vector.dot(Chunk.fromIterable(decoded.a), Chunk.fromIterable(decoded.b))
  })

/**
 * Effect-wrapped matrix-vector multiply with schema-validated input.
 *
 * @since 0.1.0
 * @category operations
 */
export const matvecEffect = (input: unknown) =>
  Effect.gen(function*() {
    const decoded = yield* Schema.decodeUnknown(MatvecInput)(input, {
      onExcessProperty: "error"
    }).pipe(
      Effect.mapError((error) =>
        new LinearAlgebraDecodeError({
          operation: "matvec",
          message: error.message
        })
      )
    )

    yield* Effect.filterOrFail(
      Effect.succeed(decoded),
      (d) => N.Equivalence(d.data.length, N.multiply(d.rows, d.cols)),
      (d) =>
        new ShapeMismatchError({
          operation: "matvec",
          expected: `data length ${N.multiply(d.rows, d.cols)}`,
          actual: `data length ${d.data.length}`,
          message: `Matrix data length must equal rows * cols`
        })
    )

    yield* Effect.filterOrFail(
      Effect.succeed(decoded),
      (d) => N.Equivalence(d.x.length, d.cols),
      (d) =>
        new ShapeMismatchError({
          operation: "matvec",
          expected: `vector length ${d.cols}`,
          actual: `vector length ${d.x.length}`,
          message: `Vector length must equal number of columns`
        })
    )

    return Chunk.toReadonlyArray(
      Matrix.matvec(
        Chunk.fromIterable(decoded.data),
        decoded.rows,
        decoded.cols,
        decoded.cols,
        0,
        Chunk.fromIterable(decoded.x)
      )
    )
  })

/**
 * Effect-wrapped vector norm with schema-validated input.
 *
 * @since 0.1.0
 * @category operations
 */
export const normEffect = (input: unknown) =>
  Effect.gen(function*() {
    const decoded = yield* Schema.decodeUnknown(NormInput)(input, {
      onExcessProperty: "error"
    }).pipe(
      Effect.mapError((error) =>
        new LinearAlgebraDecodeError({
          operation: "norm",
          message: error.message
        })
      )
    )

    const v = Chunk.fromIterable(decoded.values)

    return Match.value(decoded.kind).pipe(
      Match.when("L1", () => Vector.normL1(v)),
      Match.when("L2", () => Vector.normL2(v)),
      Match.when("Linf", () => Vector.normLinf(v)),
      Match.exhaustive
    )
  })

/**
 * Effect-wrapped matrix transpose with schema-validated input.
 *
 * @since 0.1.0
 * @category operations
 */
export const transposeEffect = (input: unknown) =>
  Effect.gen(function*() {
    const decoded = yield* Schema.decodeUnknown(TransposeInput)(input, {
      onExcessProperty: "error"
    }).pipe(
      Effect.mapError((error) =>
        new LinearAlgebraDecodeError({
          operation: "transpose",
          message: error.message
        })
      )
    )

    yield* Effect.filterOrFail(
      Effect.succeed(decoded),
      (d) => N.Equivalence(d.data.length, N.multiply(d.rows, d.cols)),
      (d) =>
        new ShapeMismatchError({
          operation: "transpose",
          expected: `data length ${N.multiply(d.rows, d.cols)}`,
          actual: `data length ${d.data.length}`,
          message: `Matrix data length must equal rows * cols`
        })
    )

    return Chunk.toReadonlyArray(
      Matrix.transpose(
        Chunk.fromIterable(decoded.data),
        decoded.rows,
        decoded.cols,
        decoded.cols,
        0
      )
    )
  })

// ---------------------------------------------------------------------------
// Policy-aware operations
// ---------------------------------------------------------------------------

/**
 * Policy-aware dot product. Backend policy selects execution strategy.
 * Precision policy rejects non-finite results under `strict`.
 * Diagnostics policy emits `Effect.logDebug` when enabled.
 *
 * @since 0.1.0
 * @category operations
 */
export const dotWithPolicies = (a: Chunk.Chunk<number>, b: Chunk.Chunk<number>) =>
  Effect.gen(function*() {
    const backend = yield* BackendPolicyService
    const precision = yield* PrecisionPolicyService
    const diagnostics = yield* DiagnosticsPolicyService

    const startedAt = yield* Match.value(diagnostics.policy).pipe(
      Match.when("enabled", () => Clock.currentTimeMillis),
      Match.when("disabled", () => Effect.succeed(0)),
      Match.exhaustive
    )

    const result = yield* Match.value(backend.policy).pipe(
      Match.when("typed-array", () => Effect.sync(() => Vector.dot(a, b))),
      Match.when("scalar", () => Effect.sync(() => Vector.dot(a, b))),
      Match.exhaustive
    )

    yield* Match.value(precision.policy).pipe(
      Match.when("strict", () =>
        Effect.filterOrFail(
          Effect.succeed(result),
          Number.isFinite,
          () =>
            new LinearAlgebraDomainViolationError({
              operation: "dotWithPolicies",
              message: `Non-finite dot product result: ${result}`
            })
        ).pipe(Effect.asVoid)),
      Match.when("relaxed", () => Effect.void),
      Match.exhaustive
    )

    yield* Match.value(diagnostics.policy).pipe(
      Match.when("enabled", () =>
        Effect.gen(function*() {
          const elapsed = yield* Clock.currentTimeMillis
          yield* Effect.logDebug("LinearAlgebra.dotWithPolicies").pipe(
            Effect.annotateLogs({
              backend: backend.policy,
              precision: precision.policy,
              vectorLength: String(Chunk.size(a)),
              elapsedMs: String(N.subtract(elapsed, startedAt))
            })
          )
        })),
      Match.when("disabled", () => Effect.void),
      Match.exhaustive
    )

    return result
  })

/**
 * Policy-aware vector norm. Precision policy rejects non-finite results
 * under `strict`. Diagnostics policy emits `Effect.logDebug` when enabled.
 *
 * @since 0.1.0
 * @category operations
 */
export const normWithPolicies = (values: Chunk.Chunk<number>, kind: "L1" | "L2" | "Linf") =>
  Effect.gen(function*() {
    const precision = yield* PrecisionPolicyService
    const diagnostics = yield* DiagnosticsPolicyService

    const result = Match.value(kind).pipe(
      Match.when("L1", () => Vector.normL1(values)),
      Match.when("L2", () => Vector.normL2(values)),
      Match.when("Linf", () => Vector.normLinf(values)),
      Match.exhaustive
    )

    yield* Match.value(precision.policy).pipe(
      Match.when("strict", () =>
        Effect.filterOrFail(
          Effect.succeed(result),
          Number.isFinite,
          () =>
            new LinearAlgebraDomainViolationError({
              operation: "normWithPolicies",
              message: `Non-finite norm result: ${result}`
            })
        ).pipe(Effect.asVoid)),
      Match.when("relaxed", () => Effect.void),
      Match.exhaustive
    )

    yield* Match.value(diagnostics.policy).pipe(
      Match.when("enabled", () =>
        Effect.logDebug("LinearAlgebra.normWithPolicies").pipe(
          Effect.annotateLogs({
            kind,
            precision: precision.policy,
            vectorLength: String(Chunk.size(values))
          })
        )),
      Match.when("disabled", () => Effect.void),
      Match.exhaustive
    )

    return result
  })
