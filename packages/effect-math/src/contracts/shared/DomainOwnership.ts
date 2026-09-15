/**
 * Defines descriptive ownership metadata for mathematical domains.
 *
 * @since 0.1.0
 * @category contracts
 */
import { Array, Schema } from "effect"

const DomainOwnership = Schema.Struct({
  owns: Schema.NonEmptyArray(Schema.String),
  sharedWith: Schema.Array(Schema.String),
  note: Schema.String
})

/**
 * Accepts ownership notes for the domains represented by this fixed contract.
 *
 * @since 0.1.0
 * @category contracts
 */
export const DomainOwnershipMatrix = Schema.Struct({
  Probability: DomainOwnership,
  Statistics: DomainOwnership,
  Optimization: DomainOwnership,
  LinearAlgebra: DomainOwnership,
  Algebra: DomainOwnership,
  Numeric: DomainOwnership,
  Calculus: DomainOwnership,
  Special: DomainOwnership,
  Geometry: DomainOwnership
})

/**
 * Ownership metadata decoded by {@link DomainOwnershipMatrix}.
 *
 * @since 0.1.0
 * @category models
 */
export type DomainOwnershipMatrixType = typeof DomainOwnershipMatrix.Type

/**
 * Records the package's initial descriptive ownership assignments.
 *
 * @since 0.1.0
 * @category contracts
 */
export const InitialDomainOwnershipMatrix = Schema.decodeUnknownSync(DomainOwnershipMatrix)({
  Probability: {
    owns: Array.make(
      "distribution contracts",
      "measure-space primitives",
      "random variable semantics",
      "stochastic process contracts"
    ),
    sharedWith: Array.make("Statistics", "Optimization"),
    note: "Probability owns distribution semantics; statistics consumes them for estimation and inference."
  },
  Statistics: {
    owns: Array.make("estimators", "summary statistics", "inference outputs", "tests", "intervals", "diagnostics"),
    sharedWith: Array.make("Probability", "Optimization"),
    note: "Statistics owns estimators and inference artifacts; distribution definitions remain in Probability."
  },
  Optimization: {
    owns: Array.make("objective-space geometry", "dominance relations", "convergence diagnostics"),
    sharedWith: Array.make("Statistics", "LinearAlgebra"),
    note: "Optimization owns search-space and objective geometry while consuming statistics and linear algebra kernels."
  },
  LinearAlgebra: {
    owns: Array.make("vector/matrix contracts", "decompositions", "linear solvers"),
    sharedWith: Array.make("Optimization", "Geometry"),
    note: "LinearAlgebra owns matrix and solver authorities consumed by optimization and geometry domains."
  },
  Algebra: {
    owns: Array.make("algebraic structures", "group-like contracts"),
    sharedWith: Array.make("Numeric", "LinearAlgebra"),
    note: "Algebra owns abstract algebraic contracts reused by numeric and linear algebra implementations."
  },
  Numeric: {
    owns: Array.make("scalar kernels", "precision and tolerance semantics"),
    sharedWith: Array.make("Algebra", "Statistics", "Optimization"),
    note: "Numeric owns scalar contracts and tolerance vocab reused by all computational domains."
  },
  Calculus: {
    owns: Array.make("derivative/integral contracts", "differentiation operators"),
    sharedWith: Array.make("Optimization", "Special"),
    note: "Calculus owns differential and integral contracts leveraged by optimization and special functions."
  },
  Special: {
    owns: Array.make("special-function contracts", "transcendental approximations"),
    sharedWith: Array.make("Probability", "Calculus", "Statistics"),
    note: "Special owns reusable special functions powering probability and inference domains."
  },
  Geometry: {
    owns: Array.make("metric-space contracts", "spatial transforms"),
    sharedWith: Array.make("Optimization", "LinearAlgebra"),
    note:
      "Geometry is first-wave stable and owns spatial and metric contracts used by optimization objective-space tooling."
  }
})
