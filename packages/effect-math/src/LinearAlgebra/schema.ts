/**
 * Schema authority for the LinearAlgebra domain — defines the canonical
 * carrier types (`DenseVector`, `DenseMatrix`), operation input contracts,
 * and boundary codec functions. All schemas enforce finite-number validation
 * at decode time, so kernels can assume well-formed numeric input.
 *
 * @since 0.1.0
 * @category schemas
 */
import { Effect, Schema } from "effect"

import { BoundaryDecodeError, BoundaryEncodeError } from "../contracts/shared/BoundaryErrors.js"
import { Dimension } from "../contracts/shared/BrandedScalars.js"
import { DomainStability } from "../contracts/shared/DomainStability.js"

// ---------------------------------------------------------------------------
// Domain model
// ---------------------------------------------------------------------------

/**
 * Canonical domain discriminator for LinearAlgebra. Consumers use this to
 * identify which domain produced a result when multiple domains coexist in
 * the same pipeline. The `stability` field tracks the domain's maturity level.
 *
 * @since 0.1.0
 * @category schemas
 */
export const LinearAlgebraDomainSchema = Schema.Struct({
  domain: Schema.Literal("LinearAlgebra"),
  stability: DomainStability
})

/**
 * Extracted type of a decoded `LinearAlgebraDomainSchema` — use this in
 * function signatures that accept an already-validated domain descriptor.
 *
 * @since 0.1.0
 * @category models
 */
export type LinearAlgebraDomain = typeof LinearAlgebraDomainSchema.Type

/**
 * Decodes unknown boundary input into the canonical linear-algebra domain model.
 * Uses strict excess-property checking — any properties beyond `domain` and
 * `stability` cause a `BoundaryDecodeError`. Use at package edges where
 * untrusted input enters the domain.
 *
 * @since 0.1.0
 * @category schemas
 */
export const decodeLinearAlgebraDomain = (input: unknown) =>
  Schema.decodeUnknown(LinearAlgebraDomainSchema)(input, {
    onExcessProperty: "error"
  }).pipe(
    Effect.catchAll((error) =>
      Effect.fail(
        new BoundaryDecodeError({
          domain: "LinearAlgebra",
          contract: "LinearAlgebraDomainSchema",
          message: error.message
        })
      )
    )
  )

/**
 * Encodes a validated `LinearAlgebraDomain` back to its serializable form at
 * the package boundary. Failures surface as `BoundaryEncodeError` — this
 * should only happen if the domain value was constructed outside of Schema.
 *
 * @since 0.1.0
 * @category schemas
 */
export const encodeLinearAlgebraDomain = (domain: LinearAlgebraDomain) =>
  Schema.encode(LinearAlgebraDomainSchema)(domain).pipe(
    Effect.catchAll((error) =>
      Effect.fail(
        new BoundaryEncodeError({
          domain: "LinearAlgebra",
          contract: "LinearAlgebraDomainSchema",
          message: error.message
        })
      )
    )
  )

/**
 * Union of all errors that can arise from boundary encode/decode operations
 * on the LinearAlgebra domain schema. Useful as a catch-all error channel
 * type in Effect pipelines that call `decodeLinearAlgebraDomain` or
 * `encodeLinearAlgebraDomain`.
 *
 * @since 0.1.0
 * @category errors
 */
export type LinearAlgebraSchemaBoundaryError = BoundaryDecodeError | BoundaryEncodeError

// ---------------------------------------------------------------------------
// Shared finite number schema
// ---------------------------------------------------------------------------

const FiniteNumber = Schema.Number.pipe(Schema.finite())

// ---------------------------------------------------------------------------
// Dense carrier schemas — Schema.TaggedClass
// ---------------------------------------------------------------------------

/**
 * Memory layout discriminator for dense matrices. `"row-major"` (the default
 * throughout this package) stores consecutive row elements contiguously.
 * `"column-major"` is provided for interop with BLAS/LAPACK-style libraries
 * that expect Fortran-order storage.
 *
 * @since 0.1.0
 * @category schemas
 */
export const StorageOrder = Schema.Literal("row-major", "column-major").annotations({
  identifier: "StorageOrder"
})

/**
 * Immutable dense vector carrier backed by a flat array of finite scalars.
 * The `data` array holds the vector elements, and `length` is a branded
 * `Dimension` that must equal `data.length` — this invariant is enforced
 * at Schema decode time, not by a runtime assertion.
 *
 * @example
 * ```ts
 * import { Schema } from "effect"
 * import { DenseVector } from "./schema.js"
 *
 * const v = new DenseVector({ data: [1, 2, 3], length: 3 as any })
 * ```
 *
 * @since 0.1.0
 * @category schemas
 */
export class DenseVector extends Schema.TaggedClass<DenseVector>()("DenseVector", {
  data: Schema.Array(FiniteNumber),
  length: Dimension
}) {}

/**
 * Immutable dense matrix carrier stored as a flat array of finite scalars in
 * row-major order. Element `(i, j)` is located at `data[offset + i * stride + j]`.
 *
 * For a contiguous M×N matrix, set `stride = N` and `offset = 0`. Non-zero
 * offsets and strides wider than `cols` support sub-matrix views without copying.
 *
 * @example
 * ```ts
 * import { DenseMatrix } from "./schema.js"
 *
 * // A contiguous 2×3 matrix [[1,2,3],[4,5,6]]
 * const m = new DenseMatrix({
 *   data: [1, 2, 3, 4, 5, 6],
 *   rows: 2 as any,
 *   cols: 3 as any,
 *   stride: 3 as any,
 *   offset: 0,
 *   order: "row-major"
 * })
 * ```
 *
 * @since 0.1.0
 * @category schemas
 */
export class DenseMatrix extends Schema.TaggedClass<DenseMatrix>()("DenseMatrix", {
  data: Schema.Array(FiniteNumber),
  rows: Dimension,
  cols: Dimension,
  stride: Dimension,
  offset: Schema.Number.pipe(Schema.finite(), Schema.greaterThanOrEqualTo(0)).annotations({
    identifier: "MatrixOffset"
  }),
  order: StorageOrder
}) {}

// ---------------------------------------------------------------------------
// Operation input schemas — boundary decode contracts
// ---------------------------------------------------------------------------

/**
 * Boundary input contract for the dot product operation. Both `a` and `b`
 * must contain only finite numbers. Decoded with strict excess-property
 * semantics — any extra fields cause a `LinearAlgebraDecodeError`.
 *
 * @since 0.1.0
 * @category schemas
 */
export const DotProductInput = Schema.Struct({
  a: Schema.Array(FiniteNumber),
  b: Schema.Array(FiniteNumber)
}).annotations({ identifier: "DotProductInput" })

/**
 * Boundary input contract for matrix-vector multiplication. The `data` array
 * represents a row-major matrix of shape `rows × cols`, and `x` is the
 * right-hand-side vector. All numeric values must be finite. Excess
 * properties are rejected at decode time.
 *
 * @since 0.1.0
 * @category schemas
 */
export const MatvecInput = Schema.Struct({
  rows: Dimension,
  cols: Dimension,
  data: Schema.Array(FiniteNumber),
  x: Schema.Array(FiniteNumber)
}).annotations({ identifier: "MatvecInput" })

/**
 * Boundary input contract for vector norm computation. The `kind`
 * discriminator selects L1 (Manhattan), L2 (Euclidean), or Linf (Chebyshev)
 * norm. All values in the `values` array must be finite. Excess properties
 * are rejected at decode time.
 *
 * @since 0.1.0
 * @category schemas
 */
export const NormInput = Schema.Struct({
  values: Schema.Array(FiniteNumber),
  kind: Schema.Literal("L1", "L2", "Linf")
}).annotations({ identifier: "NormInput" })

/**
 * Boundary input contract for matrix transposition. The `data` array is a
 * row-major matrix of shape `rows × cols` whose length must equal
 * `rows * cols`. All numeric values must be finite. Excess properties are
 * rejected at decode time.
 *
 * @since 0.1.0
 * @category schemas
 */
export const TransposeInput = Schema.Struct({
  rows: Dimension,
  cols: Dimension,
  data: Schema.Array(FiniteNumber)
}).annotations({ identifier: "TransposeInput" })
