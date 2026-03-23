/**
 * LinearAlgebra schema authority — domain model, dense carrier contracts.
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
 * LinearAlgebra domain model schema.
 *
 * @since 0.1.0
 * @category schemas
 */
export const LinearAlgebraDomainSchema = Schema.Struct({
  domain: Schema.Literal("LinearAlgebra"),
  stability: DomainStability
})

/**
 * LinearAlgebra schema-derived type.
 *
 * @since 0.1.0
 * @category models
 */
export type LinearAlgebraDomain = typeof LinearAlgebraDomainSchema.Type

/**
 * Decodes unknown boundary input into the canonical linear-algebra domain model.
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
 * Encodes the canonical linear-algebra domain model at the package boundary.
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
 * Linear-algebra boundary encode/decode errors.
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
 * Storage order — row-major or column-major.
 *
 * @since 0.1.0
 * @category schemas
 */
export const StorageOrder = Schema.Literal("row-major", "column-major").annotations({
  identifier: "StorageOrder"
})

/**
 * Dense vector carrier. Schema-backed with branded Dimension length.
 *
 * @since 0.1.0
 * @category schemas
 */
export class DenseVector extends Schema.TaggedClass<DenseVector>()("DenseVector", {
  data: Schema.Array(FiniteNumber),
  length: Dimension
}) {}

/**
 * Dense matrix carrier. Schema-backed, row-major with shape metadata.
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
 * Dot product input contract — two finite-valued vectors.
 *
 * @since 0.1.0
 * @category schemas
 */
export const DotProductInput = Schema.Struct({
  a: Schema.Array(FiniteNumber),
  b: Schema.Array(FiniteNumber)
}).annotations({ identifier: "DotProductInput" })

/**
 * Matrix-vector multiply input contract.
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
 * Vector norm input contract.
 *
 * @since 0.1.0
 * @category schemas
 */
export const NormInput = Schema.Struct({
  values: Schema.Array(FiniteNumber),
  kind: Schema.Literal("L1", "L2", "Linf")
}).annotations({ identifier: "NormInput" })

/**
 * Matrix transpose input contract.
 *
 * @since 0.1.0
 * @category schemas
 */
export const TransposeInput = Schema.Struct({
  rows: Dimension,
  cols: Dimension,
  data: Schema.Array(FiniteNumber)
}).annotations({ identifier: "TransposeInput" })
