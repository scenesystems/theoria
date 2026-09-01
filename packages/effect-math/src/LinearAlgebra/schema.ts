/**
 * Schema authority for the LinearAlgebra domain — defines the canonical
 * carrier types (`DenseVector`, `DenseMatrix`), operation input contracts,
 * and boundary codec functions.
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
 * Descriptor schema used to advertise dense LinearAlgebra support in
 * domain-discovery results.
 *
 * @since 0.1.0
 * @category schemas
 */
export const LinearAlgebraDomainSchema = Schema.Struct({
  domain: Schema.Literal("LinearAlgebra"),
  stability: DomainStability
})

/**
 * Validated descriptor for dense LinearAlgebra support.
 *
 * @since 0.1.0
 * @category models
 */
export type LinearAlgebraDomain = typeof LinearAlgebraDomainSchema.Type

/**
 * Decodes a LinearAlgebra discovery descriptor and rejects unknown fields.
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
 * Encodes a validated LinearAlgebra discovery descriptor, failing for forged values.
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
 * Error channel shared by LinearAlgebra descriptor ingestion and serialization.
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
 * Declares whether consecutive elements belong to rows or columns. The
 * current matrix kernels accept flat row-major chunks directly; this field is
 * metadata on `DenseMatrix`, not a kernel dispatch setting.
 *
 * @since 0.1.0
 * @category schemas
 */
export const StorageOrder = Schema.Literal("row-major", "column-major").annotations({
  identifier: "StorageOrder"
})

/**
 * Dense vector descriptor with finite `data` elements and a non-negative
 * integral `length`. This schema does not require `length === data.length`;
 * callers that rely on that shape invariant must check it separately.
 *
 * @since 0.1.0
 * @category schemas
 */
export class DenseVector extends Schema.TaggedClass<DenseVector>()("DenseVector", {
  data: Schema.Array(FiniteNumber),
  length: Dimension
}) {}

/**
 * Dense matrix descriptor with finite flat storage, dimensions, stride,
 * offset, and declared storage order. The schema validates each field but
 * does not prove that the storage covers the declared shape. For row-major
 * data, element `(i, j)` is at `offset + i * stride + j`.
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
 * row-major matrix of declared shape `rows × cols`. Numeric values must be
 * finite; `transposeValidated` performs the data-length and excess-property
 * checks.
 *
 * @since 0.1.0
 * @category schemas
 */
export const TransposeInput = Schema.Struct({
  rows: Dimension,
  cols: Dimension,
  data: Schema.Array(FiniteNumber)
}).annotations({ identifier: "TransposeInput" })
