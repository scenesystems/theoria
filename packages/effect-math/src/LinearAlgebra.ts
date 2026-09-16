/**
 * Dense linear-algebra schemas, errors, and operations over immutable `Chunk` values.
 *
 * @since 0.1.0
 * @module
 */
import { Chunk, Effect, Match, Number, Schema, String } from "effect"
import { dual } from "effect/Function"

import * as Matrix from "./internal/linearAlgebra/matrix.js"
import * as Solver from "./internal/linearAlgebra/solver.js"
import * as Vector from "./internal/linearAlgebra/vector.js"
import * as PolicyGuard from "./internal/policyGuard.js"
import * as Policy from "./Policy.js"

const encodeNumber = Schema.encodeSync(Schema.NumberFromString)
const finite = Schema.Finite
const finiteChunk = Schema.Chunk(finite)

/** Positive finite vector or matrix dimension.
 * @since 0.1.0
 * @category schemas
 */
export const Dimension = Schema.Number.pipe(
  Schema.finite(),
  Schema.int(),
  Schema.greaterThanOrEqualTo(1)
).annotations({ identifier: "@scenesystems/effect-math/LinearAlgebra/Dimension" }).pipe(
  Schema.brand("@scenesystems/effect-math/LinearAlgebra/Dimension")
)

/** Zero-based finite axis index.
 * @since 0.1.0
 * @category schemas
 */
export const Axis = Schema.Number.pipe(
  Schema.finite(),
  Schema.int(),
  Schema.greaterThanOrEqualTo(0)
).annotations({ identifier: "@scenesystems/effect-math/LinearAlgebra/Axis" }).pipe(
  Schema.brand("@scenesystems/effect-math/LinearAlgebra/Axis")
)

/** Matrix storage order metadata.
 * @since 0.1.0
 * @category schemas
 */
export const StorageOrder = Schema.Literal("row-major", "column-major").annotations({
  identifier: "@scenesystems/effect-math/LinearAlgebra/StorageOrder"
})

/** Finite dense vector with a declared dimension.
 * @since 0.1.0
 * @category schemas
 */
export class DenseVector extends Schema.TaggedClass<DenseVector>()("DenseVector", {
  data: finiteChunk,
  length: Dimension
}) {}

/** Finite dense matrix with explicit shape and layout metadata.
 * @since 0.1.0
 * @category schemas
 */
export class DenseMatrix extends Schema.TaggedClass<DenseMatrix>()("DenseMatrix", {
  data: finiteChunk,
  rows: Dimension,
  cols: Dimension,
  stride: Dimension,
  offset: Schema.Int.pipe(Schema.greaterThanOrEqualTo(0)).annotations({
    identifier: "@scenesystems/effect-math/LinearAlgebra/MatrixOffset"
  }),
  order: StorageOrder
}) {}

/** Finite vectors for a validated dot product.
 * @since 0.1.0
 * @category schemas
 */
export const DotProductInput = Schema.Struct({ a: finiteChunk, b: finiteChunk }).annotations({
  identifier: "@scenesystems/effect-math/LinearAlgebra/DotProductInput"
})

/** Dense row-major matrix-vector multiplication input.
 * @since 0.1.0
 * @category schemas
 */
export const MatvecInput = Schema.Struct({
  rows: Dimension,
  cols: Dimension,
  data: finiteChunk,
  x: finiteChunk
}).annotations({ identifier: "@scenesystems/effect-math/LinearAlgebra/MatvecInput" })

/** Finite vector and norm selection.
 * @since 0.1.0
 * @category schemas
 */
export const NormInput = Schema.Struct({
  values: finiteChunk,
  kind: Schema.Literal("L1", "L2", "Linf")
}).annotations({ identifier: "@scenesystems/effect-math/LinearAlgebra/NormInput" })

/** Dense row-major transposition input.
 * @since 0.1.0
 * @category schemas
 */
export const TransposeInput = Schema.Struct({
  rows: Dimension,
  cols: Dimension,
  data: finiteChunk
}).annotations({ identifier: "@scenesystems/effect-math/LinearAlgebra/TransposeInput" })

/**
 * Decoded positive dimension.
 * @since 0.1.0
 * @category models
 */
export type Dimension = typeof Dimension.Type
/**
 * Decoded zero-based axis.
 * @since 0.1.0
 * @category models
 */
export type Axis = typeof Axis.Type
/**
 * Decoded matrix storage order.
 * @since 0.1.0
 * @category models
 */
export type StorageOrder = typeof StorageOrder.Type
/**
 * Decoded dot-product input.
 * @since 0.1.0
 * @category models
 */
export type DotProductInput = typeof DotProductInput.Type
/**
 * Decoded matrix-vector input.
 * @since 0.1.0
 * @category models
 */
export type MatvecInput = typeof MatvecInput.Type
/**
 * Decoded vector norm input.
 * @since 0.1.0
 * @category models
 */
export type NormInput = typeof NormInput.Type
/**
 * Decoded matrix transposition input.
 * @since 0.1.0
 * @category models
 */
export type TransposeInput = typeof TransposeInput.Type

/** Malformed validated-operation input.
 * @since 0.1.0
 * @category errors
 */
export class DecodeError extends Schema.TaggedError<DecodeError>()("LinearAlgebraDecodeError", {
  operation: Schema.Literal("dot", "matvec", "norm", "transpose"),
  message: Schema.String
}) {}

/** Incompatible linear-algebra operand dimensions.
 * @since 0.1.0
 * @category errors
 */
export class ShapeMismatchError extends Schema.TaggedError<ShapeMismatchError>()("ShapeMismatchError", {
  operation: Schema.Literal("dot", "matvec", "transpose"),
  expected: Schema.String,
  actual: Schema.String,
  message: Schema.String
}) {}

/** Non-finite result rejected by strict precision.
 * @since 0.1.0
 * @category errors
 */
export class DomainViolationError
  extends Schema.TaggedError<DomainViolationError>()("LinearAlgebraDomainViolationError", {
    operation: Schema.Literal("dotWithPolicies", "normWithPolicies"),
    message: Schema.String
  })
{}

/** Recoverable LinearAlgebra operation failures.
 * @since 0.1.0
 * @category errors
 */
export type OperationError = DecodeError | ShapeMismatchError | DomainViolationError

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
export const add: {
  (that: Chunk.Chunk<number>): (self: Chunk.Chunk<number>) => Chunk.Chunk<number>
  (self: Chunk.Chunk<number>, that: Chunk.Chunk<number>): Chunk.Chunk<number>
} = dual(2, Vector.add)

/**
 * Multiplies every vector component by `alpha` and returns a new `Chunk`.
 * @since 0.1.0
 * @category operations
 */
export const scale: {
  (scalar: number): (self: Chunk.Chunk<number>) => Chunk.Chunk<number>
  (self: Chunk.Chunk<number>, scalar: number): Chunk.Chunk<number>
} = dual(2, (self: Chunk.Chunk<number>, scalar: number) => Vector.scale(scalar, self))

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
 * import { Chunk, Effect, Match, Number } from "effect"
 * import { LinearAlgebra } from "@scenesystems/effect-math"
 *
 * const factor: Effect.Effect<Chunk.Chunk<number>, string> = Match.value(
 *   LinearAlgebra.cholesky(Chunk.make(4, 2, 2, 3), 2)
 * ).pipe(
 *   Match.tag("None", () => Effect.fail("MatrixWasNotPositiveDefinite")),
 *   Match.tag("Some", ({ value }) => Effect.succeed(value)),
 *   Match.exhaustive
 * )
 *
 * export const program = factor.pipe(
 *   Effect.filterOrFail(
 *     (lower) => Number.Equivalence(Chunk.size(lower), 4),
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
 * import { Chunk, Effect, Match, Number } from "effect"
 * import { LinearAlgebra } from "@scenesystems/effect-math"
 *
 * const solution: Effect.Effect<Chunk.Chunk<number>, string> = Match.value(
 *   LinearAlgebra.solveSpd(
 *     Chunk.make(4, 1, 1, 3),
 *     2,
 *     Chunk.make(1, 2)
 *   )
 * ).pipe(
 *   Match.tag("None", () => Effect.fail("SystemCouldNotBeSolved")),
 *   Match.tag("Some", ({ value }) => Effect.succeed(value)),
 *   Match.exhaustive
 * )
 *
 * export const program = solution.pipe(
 *   Effect.filterOrFail(
 *     (values) => Number.Equivalence(Chunk.size(values), 2),
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
 * @throws {@link DecodeError} in the Effect error channel for
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
        new DecodeError({
          operation: "dot",
          message: error.message
        })
      )
    )

    yield* Effect.filterOrFail(
      Effect.succeed(decoded),
      (d) => Number.Equivalence(Chunk.size(d.a), Chunk.size(d.b)),
      (d) =>
        new ShapeMismatchError({
          operation: "dot",
          expected: String.concat("length ", encodeNumber(Chunk.size(d.a))),
          actual: String.concat("length ", encodeNumber(Chunk.size(d.b))),
          message: `Dot product requires vectors of equal length`
        })
    )

    return Vector.dot(decoded.a, decoded.b)
  })

/**
 * Decodes a complete row-major matrix and compatible vector before multiplication.
 *
 * @returns A new `Chunk` containing one value per row.
 * @throws {@link DecodeError} in the Effect error channel for
 * missing, non-finite, or excess fields.
 * @throws {@link ShapeMismatchError} in the Effect error channel when storage
 * length differs from `rows * cols` or vector length differs from `cols`.
 *
 * @example
 * ```ts
 * import { Array, Chunk, Effect, Equal } from "effect"
 * import { LinearAlgebra } from "@scenesystems/effect-math"
 *
 * export const program = LinearAlgebra.matvecValidated({
 *   data: Array.make(1, 0, 0, 1), rows: 2, cols: 2, x: Array.make(3, 7)
 * }).pipe(
 *   Effect.filterOrFail(
 *     (product) => Equal.equals(product, Chunk.make(3, 7)),
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
        new DecodeError({
          operation: "matvec",
          message: error.message
        })
      )
    )

    yield* Effect.filterOrFail(
      Effect.succeed(decoded),
      (d) => Number.Equivalence(Chunk.size(d.data), Number.multiply(d.rows, d.cols)),
      (d) =>
        new ShapeMismatchError({
          operation: "matvec",
          expected: String.concat("data length ", encodeNumber(Number.multiply(d.rows, d.cols))),
          actual: String.concat("data length ", encodeNumber(Chunk.size(d.data))),
          message: `Matrix data length must equal rows * cols`
        })
    )

    yield* Effect.filterOrFail(
      Effect.succeed(decoded),
      (d) => Number.Equivalence(Chunk.size(d.x), d.cols),
      (d) =>
        new ShapeMismatchError({
          operation: "matvec",
          expected: String.concat("vector length ", encodeNumber(d.cols)),
          actual: String.concat("vector length ", encodeNumber(Chunk.size(d.x))),
          message: `Vector length must equal number of columns`
        })
    )

    return Matrix.matvec(
      decoded.data,
      decoded.rows,
      decoded.cols,
      decoded.cols,
      0,
      decoded.x
    )
  })

/**
 * Decodes finite vector data and evaluates the selected norm.
 *
 * @remarks
 * `kind` accepts `"L1"`, `"L2"`, or `"Linf"`. An empty vector succeeds with `0`.
 *
 * @throws {@link DecodeError} in the Effect error channel for
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
        new DecodeError({
          operation: "norm",
          message: error.message
        })
      )
    )

    return Match.value(decoded.kind).pipe(
      Match.when("L1", () => Vector.normL1(decoded.values)),
      Match.when("L2", () => Vector.normL2(decoded.values)),
      Match.when("Linf", () => Vector.normLinf(decoded.values)),
      Match.exhaustive
    )
  })

/**
 * Decodes complete row-major matrix storage before transposition.
 *
 * @returns A new row-major `Chunk` with shape `cols` by `rows`.
 * @throws {@link DecodeError} in the Effect error channel for
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
        new DecodeError({
          operation: "transpose",
          message: error.message
        })
      )
    )

    yield* Effect.filterOrFail(
      Effect.succeed(decoded),
      (d) => Number.Equivalence(Chunk.size(d.data), Number.multiply(d.rows, d.cols)),
      (d) =>
        new ShapeMismatchError({
          operation: "transpose",
          expected: String.concat("data length ", encodeNumber(Number.multiply(d.rows, d.cols))),
          actual: String.concat("data length ", encodeNumber(Chunk.size(d.data))),
          message: `Matrix data length must equal rows * cols`
        })
    )

    return Matrix.transpose(
      decoded.data,
      decoded.rows,
      decoded.cols,
      decoded.cols,
      0
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
 * `Policy.Backend` is required for that label; its value does not change
 * the current computation.
 *
 * @example
 * ```ts
 * import { Chunk, Effect, Layer, Number } from "effect"
 * import { LinearAlgebra } from "@scenesystems/effect-math"
 * import * as Policy from "@scenesystems/effect-math/Policy"
 *
 * const policies = Layer.mergeAll(
 *   Layer.succeed(Policy.Backend, { policy: "scalar" }),
 *   Layer.succeed(Policy.Precision, { policy: "strict" }),
 *   Layer.succeed(Policy.Diagnostics, { policy: "disabled" })
 * )
 *
 * export const program = LinearAlgebra.dotWithPolicies(
 *   Chunk.make(1, 2),
 *   Chunk.make(3, 4)
 * ).pipe(
 *   Effect.provide(policies),
 *   Effect.filterOrFail(
 *     (result) => Number.Equivalence(result, 11),
 *     () => "UnexpectedDotProduct"
 *   )
 * )
 * ```
 *
 * @throws {@link DomainViolationError} in the Effect error channel
 * when strict precision rejects the result.
 * @since 0.1.0
 * @category operations
 */
export const dotWithPolicies = (a: Chunk.Chunk<number>, b: Chunk.Chunk<number>) =>
  Effect.gen(function*() {
    const backend = yield* Policy.Backend
    return yield* PolicyGuard.scalar({
      operation: "LinearAlgebra.dotWithPolicies",
      compute: () => Vector.dot(a, b),
      makeError: (message) => new DomainViolationError({ operation: "dotWithPolicies", message }),
      annotations: (result) => ({
        backend: backend.policy,
        vectorLength: encodeNumber(Chunk.size(a)),
        result: encodeNumber(result)
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
 * @throws {@link DomainViolationError} in the Effect error channel
 * when strict precision rejects the result.
 * @since 0.1.0
 * @category operations
 */
export const normWithPolicies = (values: Chunk.Chunk<number>, kind: NormInput["kind"]) =>
  PolicyGuard.scalar({
    operation: "LinearAlgebra.normWithPolicies",
    compute: () =>
      Match.value(kind).pipe(
        Match.when("L1", () => Vector.normL1(values)),
        Match.when("L2", () => Vector.normL2(values)),
        Match.when("Linf", () => Vector.normLinf(values)),
        Match.exhaustive
      ),
    makeError: (message) => new DomainViolationError({ operation: "normWithPolicies", message }),
    annotations: (result) => ({
      kind,
      vectorLength: encodeNumber(Chunk.size(values)),
      result: encodeNumber(result)
    })
  })
