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
// Fixture name literal union + known fixture union
// ---------------------------------------------------------------------------

export const FixtureNameSchema = Schema.Literal(
  "numeric.scalar-parity",
  "linalg.vector-parity",
  "geometry.distance-parity",
  "probability.distribution-parity",
  "statistics.estimator-parity",
  "special.function-parity"
)

export type FixtureName = Schema.Schema.Type<typeof FixtureNameSchema>

export const KnownFixtureSchema = Schema.Union(
  NumericScalarParityFixtureSchema,
  LinalgVectorParityFixtureSchema,
  GeometryDistanceParityFixtureSchema,
  ProbabilityDistributionParityFixtureSchema,
  StatisticsEstimatorParityFixtureSchema,
  SpecialFunctionParityFixtureSchema
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
