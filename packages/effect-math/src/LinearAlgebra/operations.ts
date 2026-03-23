/**
 * LinearAlgebra operation surface — pure kernel re-exports over immutable
 * `Chunk` carriers, Effect-wrapped variants with Schema-validated boundary
 * input, and policy-aware operations that respect `PrecisionPolicyService`,
 * `BackendPolicyService`, and `DiagnosticsPolicyService`.
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
 * Lifts the static `LinearAlgebraDomainModel` into an Effect so it can be
 * composed in pipelines that discover available domains at startup.
 *
 * @since 0.1.0
 * @category operations
 */
export const loadLinearAlgebraDomain = Effect.succeed(LinearAlgebraDomainModel)

// ---------------------------------------------------------------------------
// Pure kernel re-exports — operate on Chunk<number>
// ---------------------------------------------------------------------------

/**
 * Allocation-free dot product over two immutable `Chunk` carriers. Both
 * chunks must have the same length — no runtime guard is applied (use
 * `dotEffect` for validated input).
 *
 * @example
 * ```ts
 * import { Chunk } from "effect"
 * import { dot } from "./operations.js"
 *
 * const result = dot(
 *   Chunk.fromIterable([1, 2, 3]),
 *   Chunk.fromIterable([4, 5, 6])
 * )
 * // result === 32  (1*4 + 2*5 + 3*6)
 * ```
 *
 * @since 0.1.0
 * @category operations
 */
export const dot: (a: Chunk.Chunk<number>, b: Chunk.Chunk<number>) => number = Vector.dot

/**
 * Euclidean (L2) norm — `√(Σ xᵢ²)`. Pure function over an immutable `Chunk`
 * carrier with no allocations beyond the result scalar.
 *
 * @example
 * ```ts
 * import { Chunk } from "effect"
 * import { normL2 } from "./operations.js"
 *
 * normL2(Chunk.fromIterable([3, 4])) // 5
 * ```
 *
 * @since 0.1.0
 * @category operations
 */
export const normL2: (v: Chunk.Chunk<number>) => number = Vector.normL2

/**
 * L1 (Manhattan) norm — `Σ |xᵢ|`. Pure function, allocation-free over an
 * immutable `Chunk` carrier.
 *
 * @since 0.1.0
 * @category operations
 */
export const normL1: (v: Chunk.Chunk<number>) => number = Vector.normL1

/**
 * L∞ (Chebyshev) norm — `max |xᵢ|`. Pure function, allocation-free over an
 * immutable `Chunk` carrier.
 *
 * @since 0.1.0
 * @category operations
 */
export const normLinf: (v: Chunk.Chunk<number>) => number = Vector.normLinf

/**
 * Elementwise vector addition via `Chunk.zipWith`. Returns a new `Chunk` —
 * the inputs are not mutated. Both chunks must have the same length.
 *
 * @since 0.1.0
 * @category operations
 */
export const vectorAdd: (
  a: Chunk.Chunk<number>,
  b: Chunk.Chunk<number>
) => Chunk.Chunk<number> = Vector.add

/**
 * Scalar-vector multiplication — scales every element of `v` by `alpha`.
 * Returns a new `Chunk`; the input is not mutated.
 *
 * @since 0.1.0
 * @category operations
 */
export const vectorScale: (
  alpha: number,
  v: Chunk.Chunk<number>
) => Chunk.Chunk<number> = Vector.scale

/**
 * Matrix-vector multiply: `y = A · x`. Assumes a contiguous row-major layout
 * (`stride = cols`, `offset = 0`). The vector `x` must have length equal to
 * `cols`.
 *
 * @example
 * ```ts
 * import { Chunk } from "effect"
 * import { matvec } from "./operations.js"
 *
 * // 2×2 identity matrix times [3, 7] → [3, 7]
 * const y = matvec(
 *   Chunk.fromIterable([1, 0, 0, 1]),
 *   2,
 *   2,
 *   Chunk.fromIterable([3, 7])
 * )
 * ```
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
 * Transposes a row-major matrix of shape `rows × cols` into a new `Chunk` of
 * shape `cols × rows`. Assumes contiguous layout (`stride = cols`, `offset = 0`).
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
 * Frobenius norm — `√(Σᵢⱼ aᵢⱼ²)`, the matrix analog of the vector L2 norm.
 * Assumes contiguous row-major layout. Useful for measuring matrix magnitude
 * or convergence distance between iterates.
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
 * Effect-wrapped dot product that decodes `input` through `DotProductInput`,
 * validates equal-length vectors, and computes the result. Fails with
 * `LinearAlgebraDecodeError` for malformed input or `ShapeMismatchError`
 * for mismatched vector lengths.
 *
 * @example
 * ```ts
 * import { Effect } from "effect"
 * import { dotEffect } from "./operations.js"
 *
 * const program = dotEffect({ a: [1, 2, 3], b: [4, 5, 6] }).pipe(
 *   Effect.catchTag("ShapeMismatchError", (e) =>
 *     Effect.succeed(`dimension error: ${e.message}`)
 *   )
 * )
 * ```
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
 * Effect-wrapped matrix-vector multiply. Decodes through `MatvecInput`,
 * validates that `data.length === rows * cols` and `x.length === cols`,
 * then computes `y = A · x`. Returns the result as a `ReadonlyArray<number>`.
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
 * Effect-wrapped vector norm. Decodes through `NormInput` and dispatches
 * to L1, L2, or Linf based on the `kind` discriminator. Fails with
 * `LinearAlgebraDecodeError` if the input is malformed.
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
 * Effect-wrapped matrix transpose. Decodes through `TransposeInput`,
 * validates that `data.length === rows * cols`, and returns the transposed
 * matrix as a `ReadonlyArray<number>` in row-major order with shape
 * `cols × rows`.
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
 * Policy-aware dot product that reads three runtime services from the
 * Effect context:
 *
 * - **BackendPolicyService** — selects the execution strategy (`typed-array` or `scalar`)
 * - **PrecisionPolicyService** — when `"strict"`, rejects non-finite results with `LinearAlgebraDomainViolationError`
 * - **DiagnosticsPolicyService** — when `"enabled"`, emits `Effect.logDebug` with timing and policy metadata
 *
 * @example
 * ```ts
 * import { Chunk, Effect, Layer } from "effect"
 * import { dotWithPolicies } from "./operations.js"
 * import {
 *   BackendPolicyService,
 *   DiagnosticsPolicyService,
 *   PrecisionPolicyService
 * } from "../contracts/shared/RuntimePolicies.js"
 *
 * const policies = Layer.mergeAll(
 *   Layer.succeed(BackendPolicyService, { policy: "scalar" }),
 *   Layer.succeed(PrecisionPolicyService, { policy: "strict" }),
 *   Layer.succeed(DiagnosticsPolicyService, { policy: "disabled" })
 * )
 *
 * const program = dotWithPolicies(
 *   Chunk.fromIterable([1, 2]),
 *   Chunk.fromIterable([3, 4])
 * ).pipe(Effect.provide(policies))
 * ```
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
 * Policy-aware vector norm that reads `PrecisionPolicyService` and
 * `DiagnosticsPolicyService` from the Effect context. Under `"strict"`
 * precision, a non-finite result (e.g. from overflow) fails with
 * `LinearAlgebraDomainViolationError`. Under `"enabled"` diagnostics,
 * emits `Effect.logDebug` with the norm kind and vector length.
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
