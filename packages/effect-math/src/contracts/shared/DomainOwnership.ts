/**
 * Domain ownership matrix — declares which domain owns which mathematical concepts.
 *
 * @since 0.1.0
 * @category contracts
 */
import { Schema } from "effect"

/**
 * Domain ownership matrix authority.
 *
 * @since 0.1.0
 * @category contracts
 */
export const DomainOwnershipMatrix = Schema.Struct({
  Probability: Schema.Struct({
    owns: Schema.NonEmptyArray(Schema.String),
    sharedWith: Schema.Array(Schema.String),
    note: Schema.String
  }),
  Statistics: Schema.Struct({
    owns: Schema.NonEmptyArray(Schema.String),
    sharedWith: Schema.Array(Schema.String),
    note: Schema.String
  }),
  Optimization: Schema.Struct({
    owns: Schema.NonEmptyArray(Schema.String),
    sharedWith: Schema.Array(Schema.String),
    note: Schema.String
  }),
  LinearAlgebra: Schema.Struct({
    owns: Schema.NonEmptyArray(Schema.String),
    sharedWith: Schema.Array(Schema.String),
    note: Schema.String
  }),
  Algebra: Schema.Struct({
    owns: Schema.NonEmptyArray(Schema.String),
    sharedWith: Schema.Array(Schema.String),
    note: Schema.String
  }),
  Numeric: Schema.Struct({
    owns: Schema.NonEmptyArray(Schema.String),
    sharedWith: Schema.Array(Schema.String),
    note: Schema.String
  }),
  Calculus: Schema.Struct({
    owns: Schema.NonEmptyArray(Schema.String),
    sharedWith: Schema.Array(Schema.String),
    note: Schema.String
  }),
  Special: Schema.Struct({
    owns: Schema.NonEmptyArray(Schema.String),
    sharedWith: Schema.Array(Schema.String),
    note: Schema.String
  }),
  Geometry: Schema.Struct({
    owns: Schema.NonEmptyArray(Schema.String),
    sharedWith: Schema.Array(Schema.String),
    note: Schema.String
  })
})

/**
 * Default domain ownership matrix.
 *
 * @since 0.1.0
 * @category contracts
 */
export const InitialDomainOwnershipMatrix = {
  Probability: {
    owns: [
      "distribution contracts",
      "measure-space primitives",
      "random variable semantics",
      "stochastic process contracts"
    ],
    sharedWith: ["Statistics", "Optimization"],
    note: "Probability owns distribution semantics; statistics consumes them for estimation and inference."
  },
  Statistics: {
    owns: ["estimators", "summary statistics", "inference outputs", "tests", "intervals", "diagnostics"],
    sharedWith: ["Probability", "Optimization"],
    note: "Statistics owns estimators and inference artifacts; distribution definitions remain in Probability."
  },
  Optimization: {
    owns: ["objective-space geometry", "dominance relations", "convergence diagnostics"],
    sharedWith: ["Statistics", "LinearAlgebra"],
    note: "Optimization owns search-space and objective geometry while consuming statistics and linear algebra kernels."
  },
  LinearAlgebra: {
    owns: ["vector/matrix contracts", "decompositions", "linear solvers"],
    sharedWith: ["Optimization", "Geometry"],
    note: "LinearAlgebra owns matrix and solver authorities consumed by optimization and geometry domains."
  },
  Algebra: {
    owns: ["algebraic structures", "group-like contracts"],
    sharedWith: ["Numeric", "LinearAlgebra"],
    note: "Algebra owns abstract algebraic contracts reused by numeric and linear algebra implementations."
  },
  Numeric: {
    owns: ["scalar kernels", "precision and tolerance semantics"],
    sharedWith: ["Algebra", "Statistics", "Optimization"],
    note: "Numeric owns scalar contracts and tolerance vocab reused by all computational domains."
  },
  Calculus: {
    owns: ["derivative/integral contracts", "differentiation operators"],
    sharedWith: ["Optimization", "Special"],
    note: "Calculus owns differential and integral contracts leveraged by optimization and special functions."
  },
  Special: {
    owns: ["special-function contracts", "transcendental approximations"],
    sharedWith: ["Probability", "Calculus", "Statistics"],
    note: "Special owns reusable special functions powering probability and inference domains."
  },
  Geometry: {
    owns: ["metric-space contracts", "spatial transforms"],
    sharedWith: ["Optimization", "LinearAlgebra"],
    note:
      "Geometry is first-wave stable and owns spatial and metric contracts used by optimization objective-space tooling."
  }
}

/**
 * Domain ownership matrix type.
 *
 * @since 0.1.0
 * @category models
 */
export type DomainOwnershipMatrixType = typeof DomainOwnershipMatrix.Type
