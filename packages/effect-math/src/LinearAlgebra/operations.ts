/**
 * LinearAlgebra operation surface — pure kernel re-exports over immutable
 * `Chunk` carriers, Schema-validated variants with boundary input checking,
 * and policy-aware operations that respect `PrecisionPolicyService`,
 * `BackendPolicyService`, and `DiagnosticsPolicyService`.
 *
 * @since 0.1.0
 * @category operations
 */
import { Chunk, Effect, Match, Number as N, Schema } from "effect"

import { withScalarPolicyGuards } from "../contracts/shared/PolicyGuards.js"
import { BackendPolicyService } from "../contracts/shared/RuntimePolicies.js"
import { LinearAlgebraDecodeError, LinearAlgebraDomainViolationError, ShapeMismatchError } from "./errors.js"
import * as Matrix from "./internal/matrix.js"
import * as Solver from "./internal/solver.js"
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
 * Inner product `Σ aᵢ·bᵢ` — allocation-free over two immutable `Chunk`
 * carriers. Both chunks must have the same length; no runtime guard is
 * applied.
 *
 * @example
 * ```ts
 * import { Chunk } from "effect"
 * import { LinearAlgebra } from "effect-math"
 *
 * const result = LinearAlgebra.dot(
 *   Chunk.fromIterable([1, 2, 3]),
 *   Chunk.fromIterable([4, 5, 6])
 * )
 * // result === 32  (1·4 + 2·5 + 3·6)
 * ```
 *
 * @see {@link dotValidated} for Schema-validated boundary input with shape checking
 * @see {@link dotWithPolicies} for policy-aware variant with precision and diagnostics
 * @since 0.1.0
 * @category operations
 */
export const dot: (a: Chunk.Chunk<number>, b: Chunk.Chunk<number>) => number = Vector.dot

/**
 * Euclidean (L2) norm — `√(Σ xᵢ²)`. Pure function, allocation-free over an
 * immutable `Chunk` carrier.
 *
 * @example
 * ```ts
 * import { Chunk } from "effect"
 * import { LinearAlgebra } from "effect-math"
 *
 * LinearAlgebra.normL2(Chunk.fromIterable([3, 4])) // 5
 * ```
 *
 * @see {@link normValidated} for Schema-validated boundary input with norm-kind dispatch
 * @see {@link normWithPolicies} for policy-aware variant with precision and diagnostics
 * @since 0.1.0
 * @category operations
 */
export const normL2: (v: Chunk.Chunk<number>) => number = Vector.normL2

/**
 * L1 (Manhattan / taxicab) norm — `Σ |xᵢ|`. Useful for sparsity-aware
 * regularization (LASSO). Pure function, allocation-free.
 *
 * @see {@link normValidated} for Schema-validated boundary input with norm-kind dispatch
 * @see {@link normWithPolicies} for policy-aware variant with precision and diagnostics
 * @since 0.1.0
 * @category operations
 */
export const normL1: (v: Chunk.Chunk<number>) => number = Vector.normL1

/**
 * L∞ (Chebyshev) norm — `max |xᵢ|`. Returns the largest absolute component,
 * useful for worst-case error bounds.
 *
 * @see {@link normValidated} for Schema-validated boundary input with norm-kind dispatch
 * @see {@link normWithPolicies} for policy-aware variant with precision and diagnostics
 * @since 0.1.0
 * @category operations
 */
export const normLinf: (v: Chunk.Chunk<number>) => number = Vector.normLinf

/**
 * Elementwise vector addition `cᵢ = aᵢ + bᵢ` via `Chunk.zipWith`. Returns a
 * new `Chunk` — the inputs are not mutated. Both chunks must have the same
 * length.
 *
 * @see {@link vectorScale} for scalar multiplication
 * @since 0.1.0
 * @category operations
 */
export const vectorAdd: (
  a: Chunk.Chunk<number>,
  b: Chunk.Chunk<number>
) => Chunk.Chunk<number> = Vector.add

/**
 * Scalar-vector multiplication `cᵢ = α · vᵢ` — scales every element of `v`
 * by `alpha`. Returns a new `Chunk`; the input is not mutated.
 *
 * @see {@link vectorAdd} for elementwise addition
 * @since 0.1.0
 * @category operations
 */
export const vectorScale: (
  alpha: number,
  v: Chunk.Chunk<number>
) => Chunk.Chunk<number> = Vector.scale

/**
 * Matrix-vector multiply `y = A · x` — returns a `Chunk` of length `rows`.
 * Assumes a contiguous row-major flat layout (`stride = cols`, `offset = 0`).
 * The vector `x` must have length equal to `cols`.
 *
 * @example
 * ```ts
 * import { Chunk } from "effect"
 * import { LinearAlgebra } from "effect-math"
 *
 * // 2×2 identity matrix times [3, 7] → [3, 7]
 * const y = LinearAlgebra.matvec(
 *   Chunk.fromIterable([1, 0, 0, 1]),
 *   2,
 *   2,
 *   Chunk.fromIterable([3, 7])
 * )
 * ```
 *
 * @see {@link matvecValidated} for Schema-validated boundary input with shape checking
 * @see {@link transpose} for the transpose operation on the same layout
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
 * shape `cols × rows`. Assumes contiguous layout (`stride = cols`,
 * `offset = 0`). Useful for converting between row-major and column-major
 * access patterns.
 *
 * @see {@link transposeValidated} for Schema-validated boundary input with shape checking
 * @see {@link matvec} for matrix-vector multiply on the same layout
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
 * Assumes contiguous row-major layout. Commonly used to measure matrix
 * magnitude or convergence distance between iterates.
 *
 * @see {@link normL2} for the vector equivalent
 * @since 0.1.0
 * @category operations
 */
export const frobeniusNorm = (
  data: Chunk.Chunk<number>,
  rows: number,
  cols: number
): number => Matrix.frobeniusNorm(data, rows, cols, cols, 0)

/**
 * Cholesky decomposition `A = L Lᵀ` for symmetric positive-definite matrices.
 * Input matrix is row-major dense with shape `size × size`. Returns the
 * row-major lower-triangular factor `L` (upper entries are zero) or
 * `Option.none()` when the matrix is not SPD.
 *
 * @since 0.1.0
 * @category operations
 */
export const cholesky = (
  matrix: Chunk.Chunk<number>,
  size: number
) => Solver.choleskySpd(matrix, size)

/**
 * Forward substitution solve for lower-triangular systems `Lx = b`.
 *
 * @since 0.1.0
 * @category operations
 */
export const forwardSubstitutionLower = (
  lower: Chunk.Chunk<number>,
  size: number,
  rhs: Chunk.Chunk<number>
) => Solver.forwardSubstituteLower(lower, size, rhs)

/**
 * Backward substitution solve for upper-triangular systems `Ux = b`.
 *
 * @since 0.1.0
 * @category operations
 */
export const backwardSubstitutionUpper = (
  upper: Chunk.Chunk<number>,
  size: number,
  rhs: Chunk.Chunk<number>
) => Solver.backwardSubstituteUpper(upper, size, rhs)

/**
 * Solve symmetric positive-definite systems `Ax = b` via Cholesky +
 * triangular substitution. Returns `Option.none()` for invalid shapes or
 * non-SPD matrices.
 *
 * @since 0.1.0
 * @category operations
 */
export const solveSpd = (
  matrix: Chunk.Chunk<number>,
  size: number,
  rhs: Chunk.Chunk<number>
) => Solver.solveSpd(matrix, size, rhs)

// ---------------------------------------------------------------------------
// Schema-validated operations with boundary input checking
// ---------------------------------------------------------------------------

/**
 * Boundary-validated dot product — decodes `input` through `DotProductInput`,
 * verifies equal-length vectors, and computes `Σ aᵢ·bᵢ`. Fails with
 * `LinearAlgebraDecodeError` for malformed input or `ShapeMismatchError`
 * for mismatched vector lengths.
 *
 * @example
 * ```ts
 * import { Effect } from "effect"
 * import { LinearAlgebra } from "effect-math"
 *
 * const program = LinearAlgebra.dotValidated({ a: [1, 2, 3], b: [4, 5, 6] }).pipe(
 *   Effect.catchTag("ShapeMismatchError", (e) =>
 *     Effect.succeed(`dimension error: ${e.message}`)
 *   )
 * )
 * ```
 *
 * @see {@link dot} for the pure kernel (no validation overhead)
 * @see {@link dotWithPolicies} for policy-aware variant
 * @since 0.1.0
 * @category operations
 */
export const dotValidated = (input: unknown) =>
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
 * Boundary-validated matrix-vector multiply `y = A · x`. Decodes through
 * `MatvecInput`, validates `data.length === rows × cols` and
 * `x.length === cols`, then returns `ReadonlyArray<number>` of length `rows`.
 *
 * @example
 * ```ts
 * import { Effect } from "effect"
 * import { LinearAlgebra } from "effect-math"
 *
 * const program = LinearAlgebra.matvecValidated({
 *   data: [1, 0, 0, 1], rows: 2, cols: 2, x: [3, 7]
 * })
 * ```
 *
 * @see {@link matvec} for the pure kernel (no validation overhead)
 * @since 0.1.0
 * @category operations
 */
export const matvecValidated = (input: unknown) =>
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
 * Boundary-validated vector norm — decodes through `NormInput` and dispatches
 * to L1, L2, or L∞ based on the `kind` discriminator. Fails with
 * `LinearAlgebraDecodeError` for malformed input.
 *
 * @example
 * ```ts
 * import { Effect } from "effect"
 * import { LinearAlgebra } from "effect-math"
 *
 * const program = LinearAlgebra.normValidated({ values: [3, 4], kind: "L2" })
 * // Effect succeeds with 5
 * ```
 *
 * @see {@link normL1} / {@link normL2} / {@link normLinf} for pure kernel functions
 * @see {@link normWithPolicies} for policy-aware variant
 * @since 0.1.0
 * @category operations
 */
export const normValidated = (input: unknown) =>
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
 * Boundary-validated matrix transpose — decodes through `TransposeInput`,
 * validates `data.length === rows × cols`, and returns the transposed matrix
 * as `ReadonlyArray<number>` in row-major order with shape `cols × rows`.
 *
 * @example
 * ```ts
 * import { Effect } from "effect"
 * import { LinearAlgebra } from "effect-math"
 *
 * const program = LinearAlgebra.transposeValidated({
 *   data: [1, 2, 3, 4], rows: 2, cols: 2
 * })
 * // Effect succeeds with [1, 3, 2, 4]
 * ```
 *
 * @see {@link transpose} for the pure kernel (no validation overhead)
 * @since 0.1.0
 * @category operations
 */
export const transposeValidated = (input: unknown) =>
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
 * Policy-aware dot product that reads three runtime services from context:
 *
 * - **BackendPolicyService** — selects the execution strategy (`"typed-array"` or `"scalar"`)
 * - **PrecisionPolicyService** — `"strict"` rejects non-finite results with `LinearAlgebraDomainViolationError`; `"relaxed"` passes through
 * - **DiagnosticsPolicyService** — `"enabled"` emits `Effect.logDebug` with timing, backend, and vector-length metadata
 *
 * @example
 * ```ts
 * import { Chunk, Effect, Layer } from "effect"
 * import {
 *   BackendPolicyService,
 *   DiagnosticsPolicyService,
 *   LinearAlgebra,
 *   PrecisionPolicyService
 * } from "effect-math"
 *
 * const policies = Layer.mergeAll(
 *   Layer.succeed(BackendPolicyService, { policy: "scalar" }),
 *   Layer.succeed(PrecisionPolicyService, { policy: "strict" }),
 *   Layer.succeed(DiagnosticsPolicyService, { policy: "disabled" })
 * )
 *
 * const program = LinearAlgebra.dotWithPolicies(
 *   Chunk.fromIterable([1, 2]),
 *   Chunk.fromIterable([3, 4])
 * ).pipe(Effect.provide(policies))
 * ```
 *
 * @see {@link dot} for the pure kernel (no service requirements)
 * @see {@link PrecisionPolicyService}
 * @see {@link DiagnosticsPolicyService}
 * @since 0.1.0
 * @category operations
 */
export const dotWithPolicies = (a: Chunk.Chunk<number>, b: Chunk.Chunk<number>) =>
  Effect.gen(function*() {
    const backend = yield* BackendPolicyService
    return yield* withScalarPolicyGuards({
      operation: "LinearAlgebra.dotWithPolicies",
      compute: () => Vector.dot(a, b),
      makeError: (message) => new LinearAlgebraDomainViolationError({ operation: "dotWithPolicies", message }),
      annotations: (result) => ({
        backend: backend.policy,
        vectorLength: String(Chunk.size(a)),
        result: String(result)
      })
    })
  })

/**
 * Policy-aware vector norm that reads two runtime services from context:
 *
 * - **PrecisionPolicyService** — `"strict"` rejects non-finite results (e.g. from overflow) with `LinearAlgebraDomainViolationError`; `"relaxed"` passes through
 * - **DiagnosticsPolicyService** — `"enabled"` emits `Effect.logDebug` with norm kind, precision policy, and vector length
 *
 * @example
 * ```ts
 * import { Chunk, Effect, Layer } from "effect"
 * import {
 *   DiagnosticsPolicyService,
 *   LinearAlgebra,
 *   PrecisionPolicyService
 * } from "effect-math"
 *
 * const policies = Layer.mergeAll(
 *   Layer.succeed(PrecisionPolicyService, { policy: "strict" }),
 *   Layer.succeed(DiagnosticsPolicyService, { policy: "disabled" })
 * )
 *
 * const program = LinearAlgebra.normWithPolicies(
 *   Chunk.fromIterable([3, 4]),
 *   "L2"
 * ).pipe(Effect.provide(policies))
 * ```
 *
 * @see {@link normL1} / {@link normL2} / {@link normLinf} for pure kernels
 * @see {@link PrecisionPolicyService}
 * @see {@link DiagnosticsPolicyService}
 * @since 0.1.0
 * @category operations
 */
export const normWithPolicies = (values: Chunk.Chunk<number>, kind: "L1" | "L2" | "Linf") =>
  withScalarPolicyGuards({
    operation: "LinearAlgebra.normWithPolicies",
    compute: () =>
      Match.value(kind).pipe(
        Match.when("L1", () => Vector.normL1(values)),
        Match.when("L2", () => Vector.normL2(values)),
        Match.when("Linf", () => Vector.normLinf(values)),
        Match.exhaustive
      ),
    makeError: (message) => new LinearAlgebraDomainViolationError({ operation: "normWithPolicies", message }),
    annotations: (result) => ({
      kind,
      vectorLength: String(Chunk.size(values)),
      result: String(result)
    })
  })
