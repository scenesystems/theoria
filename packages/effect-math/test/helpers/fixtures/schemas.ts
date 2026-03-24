import { Schema } from "effect"

const FixtureMetadataSchema = Schema.Struct({
  generatedAt: Schema.String,
  generator: Schema.Struct({
    script: Schema.String,
    version: Schema.String
  }),
  upstream: Schema.Struct({
    name: Schema.Literal("scipy"),
    version: Schema.String
  })
})

// ---------------------------------------------------------------------------
// Numeric: scalar-parity
// ---------------------------------------------------------------------------

const NumericLog1pCaseSchema = Schema.Struct({
  id: Schema.String,
  operation: Schema.Literal("log1p"),
  input: Schema.Struct({ x: Schema.Number }),
  expected: Schema.Number
})

const NumericExpm1CaseSchema = Schema.Struct({
  id: Schema.String,
  operation: Schema.Literal("expm1"),
  input: Schema.Struct({ x: Schema.Number }),
  expected: Schema.Number
})

const NumericSumCaseSchema = Schema.Struct({
  id: Schema.String,
  operation: Schema.Literal("sum"),
  input: Schema.Struct({ values: Schema.Array(Schema.Number) }),
  expected: Schema.Number
})

const NumericScalarCaseSchema = Schema.Union(
  NumericLog1pCaseSchema,
  NumericExpm1CaseSchema,
  NumericSumCaseSchema
)

export const NumericScalarParityFixtureSchema = Schema.Struct({
  fixture: Schema.Literal("numeric.scalar-parity"),
  metadata: FixtureMetadataSchema,
  payload: Schema.Struct({
    cases: Schema.Array(NumericScalarCaseSchema)
  })
})

// ---------------------------------------------------------------------------
// LinearAlgebra: vector-parity
// ---------------------------------------------------------------------------

const LinalgDotCaseSchema = Schema.Struct({
  id: Schema.String,
  operation: Schema.Literal("dot"),
  input: Schema.Struct({ a: Schema.Array(Schema.Number), b: Schema.Array(Schema.Number) }),
  expected: Schema.Number
})

const LinalgNormCaseSchema = Schema.Struct({
  id: Schema.String,
  operation: Schema.Literal("norm"),
  input: Schema.Struct({
    kind: Schema.Literal("L1", "L2", "Linf"),
    values: Schema.Array(Schema.Number)
  }),
  expected: Schema.Number
})

const LinalgMatvecCaseSchema = Schema.Struct({
  id: Schema.String,
  operation: Schema.Literal("matvec"),
  input: Schema.Struct({
    data: Schema.Array(Schema.Number),
    rows: Schema.Number,
    cols: Schema.Number,
    x: Schema.Array(Schema.Number)
  }),
  expected: Schema.Array(Schema.Number)
})

const LinalgFrobeniusCaseSchema = Schema.Struct({
  id: Schema.String,
  operation: Schema.Literal("frobenius"),
  input: Schema.Struct({
    data: Schema.Array(Schema.Number),
    rows: Schema.Number,
    cols: Schema.Number
  }),
  expected: Schema.Number
})

const LinalgVectorCaseSchema = Schema.Union(
  LinalgDotCaseSchema,
  LinalgNormCaseSchema,
  LinalgMatvecCaseSchema,
  LinalgFrobeniusCaseSchema
)

export const LinalgVectorParityFixtureSchema = Schema.Struct({
  fixture: Schema.Literal("linalg.vector-parity"),
  metadata: FixtureMetadataSchema,
  payload: Schema.Struct({
    cases: Schema.Array(LinalgVectorCaseSchema)
  })
})

// ---------------------------------------------------------------------------
// Geometry: distance-parity
// ---------------------------------------------------------------------------

const GeometryDistanceCaseSchema = Schema.Struct({
  id: Schema.String,
  operation: Schema.Literal("distance"),
  input: Schema.Struct({
    a: Schema.Array(Schema.Number),
    b: Schema.Array(Schema.Number),
    metric: Schema.Literal("euclidean", "manhattan", "chebyshev")
  }),
  expected: Schema.Number
})

const GeometryMidpointCaseSchema = Schema.Struct({
  id: Schema.String,
  operation: Schema.Literal("midpoint"),
  input: Schema.Struct({
    a: Schema.Array(Schema.Number),
    b: Schema.Array(Schema.Number)
  }),
  expected: Schema.Array(Schema.Number)
})

const GeometryDistanceParityCaseSchema = Schema.Union(
  GeometryDistanceCaseSchema,
  GeometryMidpointCaseSchema
)

export const GeometryDistanceParityFixtureSchema = Schema.Struct({
  fixture: Schema.Literal("geometry.distance-parity"),
  metadata: FixtureMetadataSchema,
  payload: Schema.Struct({
    cases: Schema.Array(GeometryDistanceParityCaseSchema)
  })
})

// ---------------------------------------------------------------------------
// Probability: distribution-parity
// ---------------------------------------------------------------------------

const ProbabilityNormalPdfCaseSchema = Schema.Struct({
  id: Schema.String,
  operation: Schema.Literal("normalPdf"),
  input: Schema.Struct({ x: Schema.Number, mu: Schema.Number, sigma: Schema.Number }),
  expected: Schema.Number
})

const ProbabilityNormalCdfCaseSchema = Schema.Struct({
  id: Schema.String,
  operation: Schema.Literal("normalCdf"),
  input: Schema.Struct({ x: Schema.Number, mu: Schema.Number, sigma: Schema.Number }),
  expected: Schema.Number
})

const ProbabilityUniformPdfCaseSchema = Schema.Struct({
  id: Schema.String,
  operation: Schema.Literal("uniformPdf"),
  input: Schema.Struct({ x: Schema.Number, low: Schema.Number, high: Schema.Number }),
  expected: Schema.Number
})

const ProbabilityUniformCdfCaseSchema = Schema.Struct({
  id: Schema.String,
  operation: Schema.Literal("uniformCdf"),
  input: Schema.Struct({ x: Schema.Number, low: Schema.Number, high: Schema.Number }),
  expected: Schema.Number
})

const ProbabilityEntropyCaseSchema = Schema.Struct({
  id: Schema.String,
  operation: Schema.Literal("entropy"),
  input: Schema.Struct({ probabilities: Schema.Array(Schema.Number) }),
  expected: Schema.Number
})

const ProbabilityDistributionCaseSchema = Schema.Union(
  ProbabilityNormalPdfCaseSchema,
  ProbabilityNormalCdfCaseSchema,
  ProbabilityUniformPdfCaseSchema,
  ProbabilityUniformCdfCaseSchema,
  ProbabilityEntropyCaseSchema
)

export const ProbabilityDistributionParityFixtureSchema = Schema.Struct({
  fixture: Schema.Literal("probability.distribution-parity"),
  metadata: FixtureMetadataSchema,
  payload: Schema.Struct({
    cases: Schema.Array(ProbabilityDistributionCaseSchema)
  })
})

// ---------------------------------------------------------------------------
// Statistics: estimator-parity
// ---------------------------------------------------------------------------

const StatisticsMeanCaseSchema = Schema.Struct({
  id: Schema.String,
  operation: Schema.Literal("mean"),
  input: Schema.Struct({ values: Schema.Array(Schema.Number) }),
  expected: Schema.Number
})

const StatisticsVarianceCaseSchema = Schema.Struct({
  id: Schema.String,
  operation: Schema.Literal("variance"),
  input: Schema.Struct({ values: Schema.Array(Schema.Number) }),
  expected: Schema.Number
})

const StatisticsStddevCaseSchema = Schema.Struct({
  id: Schema.String,
  operation: Schema.Literal("standardDeviation"),
  input: Schema.Struct({ values: Schema.Array(Schema.Number) }),
  expected: Schema.Number
})

const StatisticsCovarianceCaseSchema = Schema.Struct({
  id: Schema.String,
  operation: Schema.Literal("covariance"),
  input: Schema.Struct({ a: Schema.Array(Schema.Number), b: Schema.Array(Schema.Number) }),
  expected: Schema.Number
})

const StatisticsMinMaxCaseSchema = Schema.Struct({
  id: Schema.String,
  operation: Schema.Literal("minMax"),
  input: Schema.Struct({ values: Schema.Array(Schema.Number) }),
  expected: Schema.Struct({ min: Schema.Number, max: Schema.Number })
})

const StatisticsEstimatorCaseSchema = Schema.Union(
  StatisticsMeanCaseSchema,
  StatisticsVarianceCaseSchema,
  StatisticsStddevCaseSchema,
  StatisticsCovarianceCaseSchema,
  StatisticsMinMaxCaseSchema
)

export const StatisticsEstimatorParityFixtureSchema = Schema.Struct({
  fixture: Schema.Literal("statistics.estimator-parity"),
  metadata: FixtureMetadataSchema,
  payload: Schema.Struct({
    cases: Schema.Array(StatisticsEstimatorCaseSchema)
  })
})

// ---------------------------------------------------------------------------
// Numeric: logspace-parity
// ---------------------------------------------------------------------------

const NumericLogaddexpCaseSchema = Schema.Struct({
  id: Schema.String,
  operation: Schema.Literal("logaddexp"),
  input: Schema.Struct({ a: Schema.Number, b: Schema.Number }),
  expected: Schema.Number
})

const NumericLogsubexpCaseSchema = Schema.Struct({
  id: Schema.String,
  operation: Schema.Literal("logsubexp"),
  input: Schema.Struct({ a: Schema.Number, b: Schema.Number }),
  expected: Schema.Number
})

const NumericLog1mexpCaseSchema = Schema.Struct({
  id: Schema.String,
  operation: Schema.Literal("log1mexp"),
  input: Schema.Struct({ x: Schema.Number }),
  expected: Schema.Number
})

const NumericLog1pexpCaseSchema = Schema.Struct({
  id: Schema.String,
  operation: Schema.Literal("log1pexp"),
  input: Schema.Struct({ x: Schema.Number }),
  expected: Schema.Number
})

const NumericXlogyCaseSchema = Schema.Struct({
  id: Schema.String,
  operation: Schema.Literal("xlogy"),
  input: Schema.Struct({ x: Schema.Number, y: Schema.Number }),
  expected: Schema.Number
})

const NumericXlog1pyCaseSchema = Schema.Struct({
  id: Schema.String,
  operation: Schema.Literal("xlog1py"),
  input: Schema.Struct({ x: Schema.Number, y: Schema.Number }),
  expected: Schema.Number
})

const NumericLogsumexpCaseSchema = Schema.Struct({
  id: Schema.String,
  operation: Schema.Literal("logsumexp"),
  input: Schema.Struct({ values: Schema.Array(Schema.Number) }),
  expected: Schema.Number
})

const NumericLogspaceCaseSchema = Schema.Union(
  NumericLogaddexpCaseSchema,
  NumericLogsubexpCaseSchema,
  NumericLog1mexpCaseSchema,
  NumericLog1pexpCaseSchema,
  NumericXlogyCaseSchema,
  NumericXlog1pyCaseSchema,
  NumericLogsumexpCaseSchema
)

export const NumericLogspaceParityFixtureSchema = Schema.Struct({
  fixture: Schema.Literal("numeric.logspace-parity"),
  metadata: FixtureMetadataSchema,
  payload: Schema.Struct({
    cases: Schema.Array(NumericLogspaceCaseSchema)
  })
})

// ---------------------------------------------------------------------------
// Special: function-parity
// ---------------------------------------------------------------------------

const SpecialGammaCaseSchema = Schema.Struct({
  id: Schema.String,
  operation: Schema.Literal("gamma"),
  input: Schema.Struct({ x: Schema.Number }),
  expected: Schema.Number
})

const SpecialLnGammaCaseSchema = Schema.Struct({
  id: Schema.String,
  operation: Schema.Literal("lnGamma"),
  input: Schema.Struct({ x: Schema.Number }),
  expected: Schema.Number
})

const SpecialBetaCaseSchema = Schema.Struct({
  id: Schema.String,
  operation: Schema.Literal("beta"),
  input: Schema.Struct({ a: Schema.Number, b: Schema.Number }),
  expected: Schema.Number
})

const SpecialErfCaseSchema = Schema.Struct({
  id: Schema.String,
  operation: Schema.Literal("erf"),
  input: Schema.Struct({ x: Schema.Number }),
  expected: Schema.Number
})

const SpecialErfcCaseSchema = Schema.Struct({
  id: Schema.String,
  operation: Schema.Literal("erfc"),
  input: Schema.Struct({ x: Schema.Number }),
  expected: Schema.Number
})

const SpecialDigammaCaseSchema = Schema.Struct({
  id: Schema.String,
  operation: Schema.Literal("digamma"),
  input: Schema.Struct({ x: Schema.Number }),
  expected: Schema.Number
})

const SpecialFunctionCaseSchema = Schema.Union(
  SpecialGammaCaseSchema,
  SpecialLnGammaCaseSchema,
  SpecialBetaCaseSchema,
  SpecialErfCaseSchema,
  SpecialErfcCaseSchema,
  SpecialDigammaCaseSchema
)

export const SpecialFunctionParityFixtureSchema = Schema.Struct({
  fixture: Schema.Literal("special.function-parity"),
  metadata: FixtureMetadataSchema,
  payload: Schema.Struct({
    cases: Schema.Array(SpecialFunctionCaseSchema)
  })
})

// ---------------------------------------------------------------------------
// Special: inverse-parity
// ---------------------------------------------------------------------------

const SpecialErfinvCaseSchema = Schema.Struct({
  id: Schema.String,
  operation: Schema.Literal("erfinv"),
  input: Schema.Struct({ x: Schema.Number }),
  expected: Schema.Number
})

const SpecialErfcinvCaseSchema = Schema.Struct({
  id: Schema.String,
  operation: Schema.Literal("erfcinv"),
  input: Schema.Struct({ x: Schema.Number }),
  expected: Schema.Number
})

const SpecialGammaincCaseSchema = Schema.Struct({
  id: Schema.String,
  operation: Schema.Literal("gammainc"),
  input: Schema.Struct({ a: Schema.Number, x: Schema.Number }),
  expected: Schema.Number
})

const SpecialGammainccCaseSchema = Schema.Struct({
  id: Schema.String,
  operation: Schema.Literal("gammaincc"),
  input: Schema.Struct({ a: Schema.Number, x: Schema.Number }),
  expected: Schema.Number
})

const SpecialBetaincCaseSchema = Schema.Struct({
  id: Schema.String,
  operation: Schema.Literal("betainc"),
  input: Schema.Struct({ a: Schema.Number, b: Schema.Number, x: Schema.Number }),
  expected: Schema.Number
})

const SpecialPolygammaCaseSchema = Schema.Struct({
  id: Schema.String,
  operation: Schema.Literal("polygamma"),
  input: Schema.Struct({ n: Schema.Number, x: Schema.Number }),
  expected: Schema.Number
})

const SpecialInverseCaseSchema = Schema.Union(
  SpecialErfinvCaseSchema,
  SpecialErfcinvCaseSchema,
  SpecialGammaincCaseSchema,
  SpecialGammainccCaseSchema,
  SpecialBetaincCaseSchema,
  SpecialPolygammaCaseSchema
)

export const SpecialInverseParityFixtureSchema = Schema.Struct({
  fixture: Schema.Literal("special.inverse-parity"),
  metadata: FixtureMetadataSchema,
  payload: Schema.Struct({
    cases: Schema.Array(SpecialInverseCaseSchema)
  })
})

// ---------------------------------------------------------------------------
// Algebra: polynomial-parity
// ---------------------------------------------------------------------------

const AlgebraPolyEvalCaseSchema = Schema.Struct({
  id: Schema.String,
  operation: Schema.Literal("polyEval"),
  input: Schema.Struct({ coefficients: Schema.Array(Schema.Number), x: Schema.Number }),
  expected: Schema.Number
})

const AlgebraPolyDerivativeCaseSchema = Schema.Struct({
  id: Schema.String,
  operation: Schema.Literal("polyDerivative"),
  input: Schema.Struct({ coefficients: Schema.Array(Schema.Number) }),
  expected: Schema.Array(Schema.Number)
})

const AlgebraGcdCaseSchema = Schema.Struct({
  id: Schema.String,
  operation: Schema.Literal("gcd"),
  input: Schema.Struct({ a: Schema.Number, b: Schema.Number }),
  expected: Schema.Number
})

const AlgebraLcmCaseSchema = Schema.Struct({
  id: Schema.String,
  operation: Schema.Literal("lcm"),
  input: Schema.Struct({ a: Schema.Number, b: Schema.Number }),
  expected: Schema.Number
})

const AlgebraFactorialCaseSchema = Schema.Struct({
  id: Schema.String,
  operation: Schema.Literal("factorial"),
  input: Schema.Struct({ n: Schema.Number }),
  expected: Schema.Number
})

const AlgebraPolynomialCaseSchema = Schema.Union(
  AlgebraPolyEvalCaseSchema,
  AlgebraPolyDerivativeCaseSchema,
  AlgebraGcdCaseSchema,
  AlgebraLcmCaseSchema,
  AlgebraFactorialCaseSchema
)

export const AlgebraPolynomialParityFixtureSchema = Schema.Struct({
  fixture: Schema.Literal("algebra.polynomial-parity"),
  metadata: FixtureMetadataSchema,
  payload: Schema.Struct({
    cases: Schema.Array(AlgebraPolynomialCaseSchema)
  })
})

// ---------------------------------------------------------------------------
// Calculus: numerical-parity
// ---------------------------------------------------------------------------

const CalculusDerivativeCaseSchema = Schema.Struct({
  id: Schema.String,
  operation: Schema.Literal("derivative"),
  input: Schema.Struct({ function: Schema.String, x: Schema.Number }),
  expected: Schema.Number
})

const CalculusTrapezoidCaseSchema = Schema.Struct({
  id: Schema.String,
  operation: Schema.Literal("trapezoid"),
  input: Schema.Struct({ values: Schema.Array(Schema.Number), dx: Schema.Number }),
  expected: Schema.Number
})

const CalculusSimpsonCaseSchema = Schema.Struct({
  id: Schema.String,
  operation: Schema.Literal("simpson"),
  input: Schema.Struct({ values: Schema.Array(Schema.Number), dx: Schema.Number }),
  expected: Schema.Number
})

const CalculusNumericalCaseSchema = Schema.Union(
  CalculusDerivativeCaseSchema,
  CalculusTrapezoidCaseSchema,
  CalculusSimpsonCaseSchema
)

export const CalculusNumericalParityFixtureSchema = Schema.Struct({
  fixture: Schema.Literal("calculus.numerical-parity"),
  metadata: FixtureMetadataSchema,
  payload: Schema.Struct({
    cases: Schema.Array(CalculusNumericalCaseSchema)
  })
})

// ---------------------------------------------------------------------------
// Optimization: solver-parity
// ---------------------------------------------------------------------------

const OptimizationBisectCaseSchema = Schema.Struct({
  id: Schema.String,
  operation: Schema.Literal("bisect"),
  input: Schema.Struct({ function: Schema.String, a: Schema.Number, b: Schema.Number }),
  expected: Schema.Number
})

const OptimizationGoldenSectionCaseSchema = Schema.Struct({
  id: Schema.String,
  operation: Schema.Literal("goldenSection"),
  input: Schema.Struct({ function: Schema.String, a: Schema.Number, b: Schema.Number }),
  expected: Schema.Number
})

const OptimizationSolverCaseSchema = Schema.Union(
  OptimizationBisectCaseSchema,
  OptimizationGoldenSectionCaseSchema
)

export const OptimizationSolverParityFixtureSchema = Schema.Struct({
  fixture: Schema.Literal("optimization.solver-parity"),
  metadata: FixtureMetadataSchema,
  payload: Schema.Struct({
    cases: Schema.Array(OptimizationSolverCaseSchema)
  })
})

// ---------------------------------------------------------------------------
// Fixture name literal union + known fixture union
// ---------------------------------------------------------------------------

export const FixtureNameSchema = Schema.Literal(
  "algebra.polynomial-parity",
  "calculus.numerical-parity",
  "numeric.scalar-parity",
  "numeric.logspace-parity",
  "linalg.vector-parity",
  "geometry.distance-parity",
  "probability.distribution-parity",
  "statistics.estimator-parity",
  "special.function-parity",
  "special.inverse-parity",
  "optimization.solver-parity"
)

export type FixtureName = Schema.Schema.Type<typeof FixtureNameSchema>

export const KnownFixtureSchema = Schema.Union(
  AlgebraPolynomialParityFixtureSchema,
  CalculusNumericalParityFixtureSchema,
  NumericScalarParityFixtureSchema,
  NumericLogspaceParityFixtureSchema,
  LinalgVectorParityFixtureSchema,
  GeometryDistanceParityFixtureSchema,
  ProbabilityDistributionParityFixtureSchema,
  StatisticsEstimatorParityFixtureSchema,
  SpecialFunctionParityFixtureSchema,
  SpecialInverseParityFixtureSchema,
  OptimizationSolverParityFixtureSchema
)

export type KnownFixture = Schema.Schema.Type<typeof KnownFixtureSchema>

// ---------------------------------------------------------------------------
// Manifest
// ---------------------------------------------------------------------------

export const FixtureManifestEntrySchema = Schema.Struct({
  name: FixtureNameSchema,
  file: Schema.String
})

export const FixtureManifestSchema = Schema.Struct({
  schemaVersion: Schema.String,
  generator: Schema.Struct({
    script: Schema.String,
    generatorVersion: Schema.String,
    upstream: Schema.String,
    upstreamVersion: Schema.String,
    numpyVersion: Schema.String,
    pythonVersion: Schema.String,
    generatedAt: Schema.String
  }),
  fixtures: Schema.Array(FixtureManifestEntrySchema)
})

export type FixtureManifest = Schema.Schema.Type<typeof FixtureManifestSchema>
