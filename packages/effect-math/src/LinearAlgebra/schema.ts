/**
 * Defines discovery metadata and serializable dense linear-algebra inputs.
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
 * Accepts the LinearAlgebra discovery discriminator and its stability classification.
 *
 * @since 0.1.0
 * @category schemas
 */
export const LinearAlgebraDomainSchema = Schema.Struct({
  domain: Schema.Literal("LinearAlgebra"),
  stability: DomainStability
})

/**
 * Decoded LinearAlgebra discovery descriptor.
 *
 * @since 0.1.0
 * @category models
 */
export type LinearAlgebraDomain = typeof LinearAlgebraDomainSchema.Type

/**
 * Decodes a LinearAlgebra discovery descriptor and rejects unknown fields.
 *
 * @throws {@link BoundaryDecodeError} in the Effect error channel when the
 * discriminator, stability, or object shape is invalid.
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
 * Encodes validated LinearAlgebra discovery metadata.
 *
 * @throws {@link BoundaryEncodeError} in the Effect error channel when a
 * value has been forged outside the `LinearAlgebraDomain` type.
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
 * Identifies LinearAlgebra descriptor decode and encode failures.
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
// Dense carrier schemas
// ---------------------------------------------------------------------------

/**
 * Records whether consecutive matrix elements belong to rows or columns.
 *
 * @remarks
 * Current public matrix operations accept row-major storage directly and do
 * not dispatch on this metadata.
 *
 * @since 0.1.0
 * @category schemas
 */
export const StorageOrder = Schema.Literal("row-major", "column-major").annotations({
  identifier: "StorageOrder"
})

/**
 * Stores finite vector data with a positive declared length.
 *
 * @remarks
 * Decoding does not require the declared length to equal `data.length`.
 *
 * @since 0.1.0
 * @category schemas
 */
export class DenseVector extends Schema.TaggedClass<DenseVector>()("DenseVector", {
  /** Finite elements in vector-coordinate order. */
  data: Schema.Array(FiniteNumber),
  /** Positive declared dimension, which decoding does not compare with `data.length`. */
  length: Dimension
}) {}

/**
 * Stores finite dense matrix data with explicit shape and layout metadata.
 *
 * @remarks
 * Decoding does not prove that storage covers the declared shape. In row-major
 * storage, element `(i, j)` has index `offset + i * stride + j`. `offset` may
 * be any non-negative finite number; this schema does not require an integer.
 *
 * @since 0.1.0
 * @category schemas
 */
export class DenseMatrix extends Schema.TaggedClass<DenseMatrix>()("DenseMatrix", {
  /** Finite elements in the layout described by the remaining fields. */
  data: Schema.Array(FiniteNumber),
  /** Positive declared row count. */
  rows: Dimension,
  /** Positive declared column count. */
  cols: Dimension,
  /** Positive element distance between consecutive rows in row-major storage. */
  stride: Dimension,
  /** Non-negative starting index for the matrix view. */
  offset: Schema.Number.pipe(Schema.finite(), Schema.greaterThanOrEqualTo(0)).annotations({
    identifier: "MatrixOffset"
  }),
  /** Declared storage order; current matrix operations consume row-major data. */
  order: StorageOrder
}) {}

// ---------------------------------------------------------------------------
// Operation input schemas
// ---------------------------------------------------------------------------

/**
 * Accepts finite vector data for a validated dot product.
 *
 * @remarks
 * Equal lengths are checked by {@link dotValidated} after decoding.
 *
 * @since 0.1.0
 * @category schemas
 */
export const DotProductInput = Schema.Struct({
  a: Schema.Array(FiniteNumber),
  b: Schema.Array(FiniteNumber)
}).annotations({ identifier: "DotProductInput" })

/**
 * Accepts positive matrix dimensions and finite row-major matrix-vector data.
 *
 * @remarks
 * Storage and vector lengths are checked by {@link matvecValidated} after decoding.
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
 * Accepts finite vector data and selects the L1, L2, or infinity norm.
 *
 * @remarks
 * Empty vectors are accepted and have norm `0` under each supported kind.
 *
 * @since 0.1.0
 * @category schemas
 */
export const NormInput = Schema.Struct({
  values: Schema.Array(FiniteNumber),
  kind: Schema.Literal("L1", "L2", "Linf")
}).annotations({ identifier: "NormInput" })

/**
 * Accepts positive dimensions and finite row-major data for transposition.
 *
 * @remarks
 * Storage length is checked by {@link transposeValidated} after decoding.
 *
 * @since 0.1.0
 * @category schemas
 */
export const TransposeInput = Schema.Struct({
  rows: Dimension,
  cols: Dimension,
  data: Schema.Array(FiniteNumber)
}).annotations({ identifier: "TransposeInput" })
