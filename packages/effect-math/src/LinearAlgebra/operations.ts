/**
 * Computes dense linear algebra over immutable `Chunk` values.
 *
 * @remarks
 * Pure operations trust dimensions and storage. Validated operations decode
 * finite data and check the shapes they consume. Policy-aware scalar operations
 * reject non-finite results under strict precision and can emit diagnostics.
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
 * Returns the canonical provisional dense-linear-algebra descriptor for
 * registration or startup discovery, without service requirements or a
 * failure channel.
 *
 * @since 0.1.0
 * @category operations
 */
export const loadLinearAlgebraDomain = Effect.succeed(LinearAlgebraDomainModel)

// ---------------------------------------------------------------------------
// Pure kernel re-exports
// ---------------------------------------------------------------------------

/**
 * Computes the sum of pairwise products over the shared vector prefix.
 *
 * @remarks
 * Unequal lengths are accepted; components beyond the shorter `Chunk` are
 * ignored. Two empty vectors produce `0`.
 *
 * @since 0.1.0
 * @category operations
 */
export const dot: (a: Chunk.Chunk<number>, b: Chunk.Chunk<number>) => number = Vector.dot

/**
 * Computes the Euclidean norm, returning `0` for an empty vector.
 * @since 0.1.0
 * @category operations
 */
export const normL2: (v: Chunk.Chunk<number>) => number = Vector.normL2

/**
 * Sums absolute component values, returning `0` for an empty vector.
 * @since 0.1.0
 * @category operations
 */
export const normL1: (v: Chunk.Chunk<number>) => number = Vector.normL1

/**
 * Returns the largest absolute component or `0` for an empty vector.
 * @since 0.1.0
 * @category operations
 */
export const normLinf: (v: Chunk.Chunk<number>) => number = Vector.normLinf

/**
 * Adds corresponding components over the shared vector prefix.
 *
 * @returns A new `Chunk` whose length is the shorter input length.
 * @since 0.1.0
 * @category operations
 */
export const vectorAdd: (
  a: Chunk.Chunk<number>,
  b: Chunk.Chunk<number>
) => Chunk.Chunk<number> = Vector.add

/**
 * Multiplies every vector component by `alpha` and returns a new `Chunk`.
 * @since 0.1.0
 * @category operations
 */
export const vectorScale: (
  alpha: number,
  v: Chunk.Chunk<number>
) => Chunk.Chunk<number> = Vector.scale

/**
 * Multiplies a contiguous row-major matrix by a vector.
 *
 * @remarks
 * `rows` and `cols` are trusted. Missing matrix or vector components are read
 * as zero, and excess components are ignored.
 *
 * @returns A new `Chunk` containing one value per declared row.
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
 * Transposes a contiguous row-major matrix into row-major output.
 *
 * @remarks
 * Dimensions are trusted. Missing storage positions become zero, and storage
 * beyond `rows * cols` is ignored.
 *
 * @returns A new flat `Chunk` with declared shape `cols` by `rows`.
 * @since 0.1.0
 * @category operations
 */
export const transpose = (
  data: Chunk.Chunk<number>,
  rows: number,
  cols: number
): Chunk.Chunk<number> => Matrix.transpose(data, rows, cols, cols, 0)

/**
 * Computes the Frobenius norm of a contiguous row-major matrix.
 *
 * @remarks
 * Dimensions are trusted. Missing storage positions contribute zero, and
 * storage beyond `rows * cols` is ignored.
 * @since 0.1.0
 * @category operations
 */
export const frobeniusNorm = (
  data: Chunk.Chunk<number>,
  rows: number,
  cols: number
): number => Matrix.frobeniusNorm(data, rows, cols, cols, 0)

/**
 * Computes a Cholesky factor for a row-major symmetric positive-definite matrix.
 *
 * @remarks
 * Symmetry is accepted within `1e-12`. Every diagonal pivot must exceed
 * `1e-12`.
 *
 * @returns The row-major lower-triangular factor with zero upper entries, or
 * `Option.none()` for an invalid shape, asymmetry, or failed pivot.
 *
 * @example
 * ```ts
 * import { Chunk, Effect, Match } from "effect"
 * import { LinearAlgebra } from "@scenesystems/effect-math"
 *
 * const factor: Effect.Effect<ReadonlyArray<number>, string> = Match.value(
 *   LinearAlgebra.cholesky(Chunk.fromIterable([4, 2, 2, 3]), 2)
 * ).pipe(
 *   Match.tag("None", () => Effect.fail("MatrixWasNotPositiveDefinite")),
 *   Match.tag("Some", ({ value }) => Effect.succeed(Chunk.toReadonlyArray(value))),
 *   Match.exhaustive
 * )
 *
 * export const program = factor.pipe(
 *   Effect.filterOrFail(
 *     (lower) => lower[0] === 2 && lower[1] === 0 &&
 *       (lower[3] ?? 0) > 1.414 && (lower[3] ?? 0) < 1.415,
 *     () => "UnexpectedCholeskyFactor"
 *   )
 * )
 * ```
 *
 * @since 0.1.0
 * @category operations
 */
export const cholesky = (
  matrix: Chunk.Chunk<number>,
  size: number
) => Solver.choleskySpd(matrix, size)

/**
 * Solves a row-major lower-triangular system by forward substitution.
 *
 * @returns A new solution `Chunk`, or `Option.none()` when matrix or right-hand
 * side lengths do not match `size` or a diagonal magnitude is at most `1e-12`.
 * @since 0.1.0
 * @category operations
 */
export const forwardSubstitutionLower = (
  lower: Chunk.Chunk<number>,
  size: number,
  rhs: Chunk.Chunk<number>
) => Solver.forwardSubstituteLower(lower, size, rhs)

/**
 * Solves a row-major upper-triangular system by backward substitution.
 *
 * @returns A new solution `Chunk`, or `Option.none()` when matrix or right-hand
 * side lengths do not match `size` or a diagonal magnitude is at most `1e-12`.
 * @since 0.1.0
 * @category operations
 */
export const backwardSubstitutionUpper = (
  upper: Chunk.Chunk<number>,
  size: number,
  rhs: Chunk.Chunk<number>
) => Solver.backwardSubstituteUpper(upper, size, rhs)

/**
 * Solves a row-major symmetric positive-definite system through Cholesky factorization.
 *
 * @returns A new solution `Chunk`, or `Option.none()` when dimensions do not
 * match, symmetry differs by more than `1e-12`, or factorization encounters a
 * pivot at or below `1e-12`.
 *
 * @example
 * ```ts
 * import { Chunk, Effect, Match } from "effect"
 * import { LinearAlgebra } from "@scenesystems/effect-math"
 *
 * const solution: Effect.Effect<ReadonlyArray<number>, string> = Match.value(
 *   LinearAlgebra.solveSpd(
 *     Chunk.fromIterable([4, 1, 1, 3]),
 *     2,
 *     Chunk.fromIterable([1, 2])
 *   )
 * ).pipe(
 *   Match.tag("None", () => Effect.fail("SystemCouldNotBeSolved")),
 *   Match.tag("Some", ({ value }) => Effect.succeed(Chunk.toReadonlyArray(value))),
 *   Match.exhaustive
 * )
 *
 * export const program = solution.pipe(
 *   Effect.filterOrFail(
 *     (values) => (values[0] ?? 0) > 0.09 && (values[0] ?? 0) < 0.091 &&
 *       (values[1] ?? 0) > 0.636 && (values[1] ?? 0) < 0.637,
 *     () => "UnexpectedSolution"
 *   )
 * )
 * ```
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
 * Decodes finite, equal-length vectors before computing their dot product.
 *
 * @throws {@link LinearAlgebraDecodeError} in the Effect error channel for
 * missing, non-finite, or excess fields.
 * @throws {@link ShapeMismatchError} in the Effect error channel when the
 * vectors have different lengths.
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
 * Decodes a complete row-major matrix and compatible vector before multiplication.
 *
 * @returns A new readonly array containing one value per row.
 * @throws {@link LinearAlgebraDecodeError} in the Effect error channel for
 * missing, non-finite, or excess fields.
 * @throws {@link ShapeMismatchError} in the Effect error channel when storage
 * length differs from `rows * cols` or vector length differs from `cols`.
 *
 * @example
 * ```ts
 * import { Effect } from "effect"
 * import { LinearAlgebra } from "@scenesystems/effect-math"
 *
 * export const program = LinearAlgebra.matvecValidated({
 *   data: [1, 0, 0, 1], rows: 2, cols: 2, x: [3, 7]
 * }).pipe(
 *   Effect.filterOrFail(
 *     (product) => product[0] === 3 && product[1] === 7,
 *     () => "UnexpectedProduct"
 *   )
 * )
 * ```
 *
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
 * Decodes finite vector data and evaluates the selected norm.
 *
 * @remarks
 * `kind` accepts `"L1"`, `"L2"`, or `"Linf"`. An empty vector succeeds with `0`.
 *
 * @throws {@link LinearAlgebraDecodeError} in the Effect error channel for
 * an unknown norm kind or missing, non-finite, or excess fields.
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
 * Decodes complete row-major matrix storage before transposition.
 *
 * @returns A new readonly row-major array with shape `cols` by `rows`.
 * @throws {@link LinearAlgebraDecodeError} in the Effect error channel for
 * missing, non-finite, or excess fields.
 * @throws {@link ShapeMismatchError} in the Effect error channel when storage
 * length differs from `rows * cols`.
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
 * Computes a dot product under the configured precision and diagnostics policies.
 *
 * @remarks
 * Unequal vectors are truncated to their shared prefix. Strict precision
 * rejects a non-finite result. Enabled diagnostics emit one debug log with the
 * configured backend label, first-vector length, result, and elapsed time.
 * `BackendPolicyService` is required for that label; its value does not change
 * the current computation.
 *
 * @example
 * ```ts
 * import { Chunk, Effect, Layer } from "effect"
 * import {
 *   BackendPolicyService,
 *   DiagnosticsPolicyService,
 *   LinearAlgebra,
 *   PrecisionPolicyService
 * } from "@scenesystems/effect-math"
 *
 * const policies = Layer.mergeAll(
 *   Layer.succeed(BackendPolicyService, { policy: "scalar" }),
 *   Layer.succeed(PrecisionPolicyService, { policy: "strict" }),
 *   Layer.succeed(DiagnosticsPolicyService, { policy: "disabled" })
 * )
 *
 * export const program = LinearAlgebra.dotWithPolicies(
 *   Chunk.fromIterable([1, 2]),
 *   Chunk.fromIterable([3, 4])
 * ).pipe(
 *   Effect.provide(policies),
 *   Effect.filterOrFail(
 *     (result) => result === 11,
 *     () => "UnexpectedDotProduct"
 *   )
 * )
 * ```
 *
 * @throws {@link LinearAlgebraDomainViolationError} in the Effect error channel
 * when strict precision rejects the result.
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
 * Evaluates the selected vector norm under the configured runtime policies.
 *
 * @remarks
 * Inputs are not decoded. Strict precision rejects a non-finite result.
 * Enabled diagnostics emit one debug log with the norm kind, vector length,
 * result, precision mode, and elapsed time.
 *
 * @throws {@link LinearAlgebraDomainViolationError} in the Effect error channel
 * when strict precision rejects the result.
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
