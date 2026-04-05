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

const NumericLogSumExpCaseSchema = Schema.Struct({
  id: Schema.String,
  operation: Schema.Literal("logSumExp"),
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
  NumericLogSumExpCaseSchema
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
  expected: Schema.Number,
  assertion: Schema.Struct({
    absoluteTolerance: Schema.Number.pipe(Schema.greaterThan(0)),
    relativeTolerance: Schema.Number.pipe(Schema.greaterThan(0))
  })
})

const CalculusSecondDerivativeCaseSchema = Schema.Struct({
  id: Schema.String,
  operation: Schema.Literal("secondDerivative"),
  input: Schema.Struct({ function: Schema.String, x: Schema.Number }),
  expected: Schema.Number,
  assertion: Schema.Struct({
    absoluteTolerance: Schema.Number.pipe(Schema.greaterThan(0)),
    relativeTolerance: Schema.Number.pipe(Schema.greaterThan(0))
  })
})

const CalculusDirectionalDerivativeCaseSchema = Schema.Struct({
  id: Schema.String,
  operation: Schema.Literal("directionalDerivative"),
  input: Schema.Struct({
    function: Schema.String,
    point: Schema.Array(Schema.Number),
    direction: Schema.Array(Schema.Number)
  }),
  expected: Schema.Number,
  assertion: Schema.Struct({
    absoluteTolerance: Schema.Number.pipe(Schema.greaterThan(0)),
    relativeTolerance: Schema.Number.pipe(Schema.greaterThan(0))
  })
})

const CalculusTrapezoidCaseSchema = Schema.Struct({
  id: Schema.String,
  operation: Schema.Literal("trapezoid"),
  input: Schema.Struct({ values: Schema.Array(Schema.Number), dx: Schema.Number }),
  expected: Schema.Number,
  assertion: Schema.Struct({
    absoluteTolerance: Schema.Number.pipe(Schema.greaterThan(0)),
    relativeTolerance: Schema.Number.pipe(Schema.greaterThan(0))
  })
})

const CalculusSimpsonCaseSchema = Schema.Struct({
  id: Schema.String,
  operation: Schema.Literal("simpson"),
  input: Schema.Struct({ values: Schema.Array(Schema.Number), dx: Schema.Number }),
  expected: Schema.Number,
  assertion: Schema.Struct({
    absoluteTolerance: Schema.Number.pipe(Schema.greaterThan(0)),
    relativeTolerance: Schema.Number.pipe(Schema.greaterThan(0))
  })
})

const CalculusAdaptiveSimpsonCaseSchema = Schema.Struct({
  id: Schema.String,
  operation: Schema.Literal("adaptiveSimpson"),
  input: Schema.Struct({
    function: Schema.String,
    a: Schema.Number,
    b: Schema.Number,
    absoluteTolerance: Schema.Number,
    relativeTolerance: Schema.Number,
    maxDepth: Schema.Number
  }),
  expected: Schema.Number,
  assertion: Schema.Struct({
    absoluteTolerance: Schema.Number.pipe(Schema.greaterThan(0)),
    relativeTolerance: Schema.Number.pipe(Schema.greaterThan(0))
  })
})

const CalculusGradientCaseSchema = Schema.Struct({
  id: Schema.String,
  operation: Schema.Literal("gradient"),
  input: Schema.Struct({ function: Schema.String, point: Schema.Array(Schema.Number) }),
  expected: Schema.Array(Schema.Number),
  assertion: Schema.Struct({
    absoluteTolerance: Schema.Number.pipe(Schema.greaterThan(0)),
    relativeTolerance: Schema.Number.pipe(Schema.greaterThan(0))
  })
})

const CalculusJacobianCaseSchema = Schema.Struct({
  id: Schema.String,
  operation: Schema.Literal("jacobian"),
  input: Schema.Struct({ function: Schema.String, point: Schema.Array(Schema.Number) }),
  expected: Schema.Array(Schema.Array(Schema.Number)),
  assertion: Schema.Struct({
    absoluteTolerance: Schema.Number.pipe(Schema.greaterThan(0)),
    relativeTolerance: Schema.Number.pipe(Schema.greaterThan(0))
  })
})

const CalculusHessianCaseSchema = Schema.Struct({
  id: Schema.String,
  operation: Schema.Literal("hessian"),
  input: Schema.Struct({ function: Schema.String, point: Schema.Array(Schema.Number) }),
  expected: Schema.Array(Schema.Array(Schema.Number)),
  assertion: Schema.Struct({
    absoluteTolerance: Schema.Number.pipe(Schema.greaterThan(0)),
    relativeTolerance: Schema.Number.pipe(Schema.greaterThan(0))
  })
})

const CalculusDivergenceCaseSchema = Schema.Struct({
  id: Schema.String,
  operation: Schema.Literal("divergence"),
  input: Schema.Struct({ function: Schema.String, point: Schema.Array(Schema.Number) }),
  expected: Schema.Number,
  assertion: Schema.Struct({
    absoluteTolerance: Schema.Number.pipe(Schema.greaterThan(0)),
    relativeTolerance: Schema.Number.pipe(Schema.greaterThan(0))
  })
})

const CalculusLaplacianCaseSchema = Schema.Struct({
  id: Schema.String,
  operation: Schema.Literal("laplacian"),
  input: Schema.Struct({ function: Schema.String, point: Schema.Array(Schema.Number) }),
  expected: Schema.Number,
  assertion: Schema.Struct({
    absoluteTolerance: Schema.Number.pipe(Schema.greaterThan(0)),
    relativeTolerance: Schema.Number.pipe(Schema.greaterThan(0))
  })
})

const CalculusNumericalCaseSchema = Schema.Union(
  CalculusDerivativeCaseSchema,
  CalculusSecondDerivativeCaseSchema,
  CalculusDirectionalDerivativeCaseSchema,
  CalculusTrapezoidCaseSchema,
  CalculusSimpsonCaseSchema,
  CalculusAdaptiveSimpsonCaseSchema,
  CalculusGradientCaseSchema,
  CalculusJacobianCaseSchema,
  CalculusHessianCaseSchema,
  CalculusDivergenceCaseSchema,
  CalculusLaplacianCaseSchema
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
// Complex: arithmetic-parity
// ---------------------------------------------------------------------------

const ComplexReImExpected = Schema.Struct({ re: Schema.Number, im: Schema.Number })

const ComplexBinaryInputSchema = Schema.Struct({
  aRe: Schema.Number,
  aIm: Schema.Number,
  bRe: Schema.Number,
  bIm: Schema.Number
})

const ComplexUnaryInputSchema = Schema.Struct({
  re: Schema.Number,
  im: Schema.Number
})

const ComplexAddCaseSchema = Schema.Struct({
  id: Schema.String,
  operation: Schema.Literal("add"),
  input: ComplexBinaryInputSchema,
  expected: ComplexReImExpected
})

const ComplexSubtractCaseSchema = Schema.Struct({
  id: Schema.String,
  operation: Schema.Literal("subtract"),
  input: ComplexBinaryInputSchema,
  expected: ComplexReImExpected
})

const ComplexMultiplyCaseSchema = Schema.Struct({
  id: Schema.String,
  operation: Schema.Literal("multiply"),
  input: ComplexBinaryInputSchema,
  expected: ComplexReImExpected
})

const ComplexDivideCaseSchema = Schema.Struct({
  id: Schema.String,
  operation: Schema.Literal("divide"),
  input: ComplexBinaryInputSchema,
  expected: ComplexReImExpected
})

const ComplexConjugateCaseSchema = Schema.Struct({
  id: Schema.String,
  operation: Schema.Literal("conjugate"),
  input: ComplexUnaryInputSchema,
  expected: ComplexReImExpected
})

const ComplexAbsCaseSchema = Schema.Struct({
  id: Schema.String,
  operation: Schema.Literal("abs"),
  input: ComplexUnaryInputSchema,
  expected: Schema.Number
})

const ComplexArgCaseSchema = Schema.Struct({
  id: Schema.String,
  operation: Schema.Literal("arg"),
  input: ComplexUnaryInputSchema,
  expected: Schema.Number
})

const ComplexExpCaseSchema = Schema.Struct({
  id: Schema.String,
  operation: Schema.Literal("exp"),
  input: ComplexUnaryInputSchema,
  expected: ComplexReImExpected
})

const ComplexLogCaseSchema = Schema.Struct({
  id: Schema.String,
  operation: Schema.Literal("log"),
  input: ComplexUnaryInputSchema,
  expected: ComplexReImExpected
})

const ComplexSqrtCaseSchema = Schema.Struct({
  id: Schema.String,
  operation: Schema.Literal("sqrt"),
  input: ComplexUnaryInputSchema,
  expected: ComplexReImExpected
})

const ComplexPowCaseSchema = Schema.Struct({
  id: Schema.String,
  operation: Schema.Literal("pow"),
  input: Schema.Struct({
    baseRe: Schema.Number,
    baseIm: Schema.Number,
    expRe: Schema.Number,
    expIm: Schema.Number
  }),
  expected: ComplexReImExpected
})

const ComplexSinCaseSchema = Schema.Struct({
  id: Schema.String,
  operation: Schema.Literal("sin"),
  input: ComplexUnaryInputSchema,
  expected: ComplexReImExpected
})

const ComplexCosCaseSchema = Schema.Struct({
  id: Schema.String,
  operation: Schema.Literal("cos"),
  input: ComplexUnaryInputSchema,
  expected: ComplexReImExpected
})

const ComplexTanCaseSchema = Schema.Struct({
  id: Schema.String,
  operation: Schema.Literal("tan"),
  input: ComplexUnaryInputSchema,
  expected: ComplexReImExpected
})

const ComplexSinhCaseSchema = Schema.Struct({
  id: Schema.String,
  operation: Schema.Literal("sinh"),
  input: ComplexUnaryInputSchema,
  expected: ComplexReImExpected
})

const ComplexCoshCaseSchema = Schema.Struct({
  id: Schema.String,
  operation: Schema.Literal("cosh"),
  input: ComplexUnaryInputSchema,
  expected: ComplexReImExpected
})

const ComplexTanhCaseSchema = Schema.Struct({
  id: Schema.String,
  operation: Schema.Literal("tanh"),
  input: ComplexUnaryInputSchema,
  expected: ComplexReImExpected
})

const ComplexToPolarCaseSchema = Schema.Struct({
  id: Schema.String,
  operation: Schema.Literal("toPolar"),
  input: ComplexUnaryInputSchema,
  expected: Schema.Struct({ r: Schema.Number, theta: Schema.Number })
})

const ComplexDerivativeCaseSchema = Schema.Struct({
  id: Schema.String,
  operation: Schema.Literal("complexDerivative"),
  input: Schema.Struct({ fn: Schema.String, x: Schema.Number }),
  expected: Schema.Number
})

const ComplexArithmeticCaseSchema = Schema.Union(
  ComplexAddCaseSchema,
  ComplexSubtractCaseSchema,
  ComplexMultiplyCaseSchema,
  ComplexDivideCaseSchema,
  ComplexConjugateCaseSchema,
  ComplexAbsCaseSchema,
  ComplexArgCaseSchema,
  ComplexExpCaseSchema,
  ComplexLogCaseSchema,
  ComplexSqrtCaseSchema,
  ComplexPowCaseSchema,
  ComplexSinCaseSchema,
  ComplexCosCaseSchema,
  ComplexTanCaseSchema,
  ComplexSinhCaseSchema,
  ComplexCoshCaseSchema,
  ComplexTanhCaseSchema,
  ComplexToPolarCaseSchema,
  ComplexDerivativeCaseSchema
)

export const ComplexArithmeticParityFixtureSchema = Schema.Struct({
  fixture: Schema.Literal("complex.arithmetic-parity"),
  metadata: FixtureMetadataSchema,
  payload: Schema.Struct({
    cases: Schema.Array(ComplexArithmeticCaseSchema)
  })
})

// ---------------------------------------------------------------------------
// Distribution: algebra-parity
// ---------------------------------------------------------------------------

const DistNormalEvalInputSchema = Schema.Struct({ x: Schema.Number, mu: Schema.Number, sigma: Schema.Number })
const DistNormalParamsInputSchema = Schema.Struct({ mu: Schema.Number, sigma: Schema.Number })
const DistNormalQuantileInputSchema = Schema.Struct({ p: Schema.Number, mu: Schema.Number, sigma: Schema.Number })

const DistLogNormalEvalInputSchema = Schema.Struct({ x: Schema.Number, mu: Schema.Number, sigma: Schema.Number })
const DistLogNormalParamsInputSchema = Schema.Struct({ mu: Schema.Number, sigma: Schema.Number })
const DistLogNormalQuantileInputSchema = Schema.Struct({ p: Schema.Number, mu: Schema.Number, sigma: Schema.Number })

const DistExponentialEvalInputSchema = Schema.Struct({ x: Schema.Number, rate: Schema.Number })
const DistExponentialParamsInputSchema = Schema.Struct({ rate: Schema.Number })
const DistExponentialQuantileInputSchema = Schema.Struct({ p: Schema.Number, rate: Schema.Number })

const DistUniformEvalInputSchema = Schema.Struct({ x: Schema.Number, low: Schema.Number, high: Schema.Number })
const DistUniformParamsInputSchema = Schema.Struct({ low: Schema.Number, high: Schema.Number })
const DistUniformQuantileInputSchema = Schema.Struct({ p: Schema.Number, low: Schema.Number, high: Schema.Number })

const DistBetaEvalInputSchema = Schema.Struct({ x: Schema.Number, alpha: Schema.Number, beta: Schema.Number })
const DistBetaParamsInputSchema = Schema.Struct({ alpha: Schema.Number, beta: Schema.Number })
const DistBetaQuantileInputSchema = Schema.Struct({ p: Schema.Number, alpha: Schema.Number, beta: Schema.Number })

const DistGammaEvalInputSchema = Schema.Struct({ x: Schema.Number, shape: Schema.Number, scale: Schema.Number })
const DistGammaParamsInputSchema = Schema.Struct({ shape: Schema.Number, scale: Schema.Number })
const DistGammaQuantileInputSchema = Schema.Struct({ p: Schema.Number, shape: Schema.Number, scale: Schema.Number })

const DistStudentTEvalInputSchema = Schema.Struct({ x: Schema.Number, df: Schema.Number })
const DistStudentTParamsInputSchema = Schema.Struct({ df: Schema.Number })
const DistStudentTQuantileInputSchema = Schema.Struct({ p: Schema.Number, df: Schema.Number })

const DistCategoricalEvalInputSchema = Schema.Struct({ k: Schema.Number, probs: Schema.Array(Schema.Number) })
const DistCategoricalParamsInputSchema = Schema.Struct({ probs: Schema.Array(Schema.Number) })

const DistBinomialEvalInputSchema = Schema.Struct({ k: Schema.Number, n: Schema.Number, p: Schema.Number })
const DistBinomialParamsInputSchema = Schema.Struct({ n: Schema.Number, p: Schema.Number })

const DistPoissonEvalInputSchema = Schema.Struct({ k: Schema.Number, mu: Schema.Number })
const DistPoissonParamsInputSchema = Schema.Struct({ mu: Schema.Number })

export const DistNormalCaseSchema = Schema.Union(
  Schema.Struct({
    id: Schema.String,
    operation: Schema.Literal("normalPdf"),
    input: DistNormalEvalInputSchema,
    expected: Schema.Number
  }),
  Schema.Struct({
    id: Schema.String,
    operation: Schema.Literal("normalLogpdf"),
    input: DistNormalEvalInputSchema,
    expected: Schema.Number
  }),
  Schema.Struct({
    id: Schema.String,
    operation: Schema.Literal("normalCdf"),
    input: DistNormalEvalInputSchema,
    expected: Schema.Number
  }),
  Schema.Struct({
    id: Schema.String,
    operation: Schema.Literal("normalQuantile"),
    input: DistNormalQuantileInputSchema,
    expected: Schema.Number
  }),
  Schema.Struct({
    id: Schema.String,
    operation: Schema.Literal("normalMean"),
    input: DistNormalParamsInputSchema,
    expected: Schema.Number
  }),
  Schema.Struct({
    id: Schema.String,
    operation: Schema.Literal("normalVariance"),
    input: DistNormalParamsInputSchema,
    expected: Schema.Number
  }),
  Schema.Struct({
    id: Schema.String,
    operation: Schema.Literal("normalEntropy"),
    input: DistNormalParamsInputSchema,
    expected: Schema.Number
  })
)

export const DistLogNormalCaseSchema = Schema.Union(
  Schema.Struct({
    id: Schema.String,
    operation: Schema.Literal("logNormalPdf"),
    input: DistLogNormalEvalInputSchema,
    expected: Schema.Number
  }),
  Schema.Struct({
    id: Schema.String,
    operation: Schema.Literal("logNormalLogpdf"),
    input: DistLogNormalEvalInputSchema,
    expected: Schema.Number
  }),
  Schema.Struct({
    id: Schema.String,
    operation: Schema.Literal("logNormalCdf"),
    input: DistLogNormalEvalInputSchema,
    expected: Schema.Number
  }),
  Schema.Struct({
    id: Schema.String,
    operation: Schema.Literal("logNormalQuantile"),
    input: DistLogNormalQuantileInputSchema,
    expected: Schema.Number
  }),
  Schema.Struct({
    id: Schema.String,
    operation: Schema.Literal("logNormalMean"),
    input: DistLogNormalParamsInputSchema,
    expected: Schema.Number
  }),
  Schema.Struct({
    id: Schema.String,
    operation: Schema.Literal("logNormalVariance"),
    input: DistLogNormalParamsInputSchema,
    expected: Schema.Number
  }),
  Schema.Struct({
    id: Schema.String,
    operation: Schema.Literal("logNormalEntropy"),
    input: DistLogNormalParamsInputSchema,
    expected: Schema.Number
  })
)

export const DistExponentialCaseSchema = Schema.Union(
  Schema.Struct({
    id: Schema.String,
    operation: Schema.Literal("exponentialPdf"),
    input: DistExponentialEvalInputSchema,
    expected: Schema.Number
  }),
  Schema.Struct({
    id: Schema.String,
    operation: Schema.Literal("exponentialLogpdf"),
    input: DistExponentialEvalInputSchema,
    expected: Schema.Number
  }),
  Schema.Struct({
    id: Schema.String,
    operation: Schema.Literal("exponentialCdf"),
    input: DistExponentialEvalInputSchema,
    expected: Schema.Number
  }),
  Schema.Struct({
    id: Schema.String,
    operation: Schema.Literal("exponentialQuantile"),
    input: DistExponentialQuantileInputSchema,
    expected: Schema.Number
  }),
  Schema.Struct({
    id: Schema.String,
    operation: Schema.Literal("exponentialMean"),
    input: DistExponentialParamsInputSchema,
    expected: Schema.Number
  }),
  Schema.Struct({
    id: Schema.String,
    operation: Schema.Literal("exponentialVariance"),
    input: DistExponentialParamsInputSchema,
    expected: Schema.Number
  }),
  Schema.Struct({
    id: Schema.String,
    operation: Schema.Literal("exponentialEntropy"),
    input: DistExponentialParamsInputSchema,
    expected: Schema.Number
  })
)

export const DistUniformCaseSchema = Schema.Union(
  Schema.Struct({
    id: Schema.String,
    operation: Schema.Literal("uniformPdf"),
    input: DistUniformEvalInputSchema,
    expected: Schema.Number
  }),
  Schema.Struct({
    id: Schema.String,
    operation: Schema.Literal("uniformLogpdf"),
    input: DistUniformEvalInputSchema,
    expected: Schema.Number
  }),
  Schema.Struct({
    id: Schema.String,
    operation: Schema.Literal("uniformCdf"),
    input: DistUniformEvalInputSchema,
    expected: Schema.Number
  }),
  Schema.Struct({
    id: Schema.String,
    operation: Schema.Literal("uniformQuantile"),
    input: DistUniformQuantileInputSchema,
    expected: Schema.Number
  }),
  Schema.Struct({
    id: Schema.String,
    operation: Schema.Literal("uniformMean"),
    input: DistUniformParamsInputSchema,
    expected: Schema.Number
  }),
  Schema.Struct({
    id: Schema.String,
    operation: Schema.Literal("uniformVariance"),
    input: DistUniformParamsInputSchema,
    expected: Schema.Number
  }),
  Schema.Struct({
    id: Schema.String,
    operation: Schema.Literal("uniformEntropy"),
    input: DistUniformParamsInputSchema,
    expected: Schema.Number
  })
)

export const DistBetaCaseSchema = Schema.Union(
  Schema.Struct({
    id: Schema.String,
    operation: Schema.Literal("betaPdf"),
    input: DistBetaEvalInputSchema,
    expected: Schema.Number
  }),
  Schema.Struct({
    id: Schema.String,
    operation: Schema.Literal("betaLogpdf"),
    input: DistBetaEvalInputSchema,
    expected: Schema.Number
  }),
  Schema.Struct({
    id: Schema.String,
    operation: Schema.Literal("betaCdf"),
    input: DistBetaEvalInputSchema,
    expected: Schema.Number
  }),
  Schema.Struct({
    id: Schema.String,
    operation: Schema.Literal("betaQuantile"),
    input: DistBetaQuantileInputSchema,
    expected: Schema.Number
  }),
  Schema.Struct({
    id: Schema.String,
    operation: Schema.Literal("betaMean"),
    input: DistBetaParamsInputSchema,
    expected: Schema.Number
  }),
  Schema.Struct({
    id: Schema.String,
    operation: Schema.Literal("betaVariance"),
    input: DistBetaParamsInputSchema,
    expected: Schema.Number
  }),
  Schema.Struct({
    id: Schema.String,
    operation: Schema.Literal("betaEntropy"),
    input: DistBetaParamsInputSchema,
    expected: Schema.Number
  })
)

export const DistGammaCaseSchema = Schema.Union(
  Schema.Struct({
    id: Schema.String,
    operation: Schema.Literal("gammaPdf"),
    input: DistGammaEvalInputSchema,
    expected: Schema.Number
  }),
  Schema.Struct({
    id: Schema.String,
    operation: Schema.Literal("gammaLogpdf"),
    input: DistGammaEvalInputSchema,
    expected: Schema.Number
  }),
  Schema.Struct({
    id: Schema.String,
    operation: Schema.Literal("gammaCdf"),
    input: DistGammaEvalInputSchema,
    expected: Schema.Number
  }),
  Schema.Struct({
    id: Schema.String,
    operation: Schema.Literal("gammaQuantile"),
    input: DistGammaQuantileInputSchema,
    expected: Schema.Number
  }),
  Schema.Struct({
    id: Schema.String,
    operation: Schema.Literal("gammaMean"),
    input: DistGammaParamsInputSchema,
    expected: Schema.Number
  }),
  Schema.Struct({
    id: Schema.String,
    operation: Schema.Literal("gammaVariance"),
    input: DistGammaParamsInputSchema,
    expected: Schema.Number
  }),
  Schema.Struct({
    id: Schema.String,
    operation: Schema.Literal("gammaEntropy"),
    input: DistGammaParamsInputSchema,
    expected: Schema.Number
  })
)

export const DistStudentTCaseSchema = Schema.Union(
  Schema.Struct({
    id: Schema.String,
    operation: Schema.Literal("studentTPdf"),
    input: DistStudentTEvalInputSchema,
    expected: Schema.Number
  }),
  Schema.Struct({
    id: Schema.String,
    operation: Schema.Literal("studentTLogpdf"),
    input: DistStudentTEvalInputSchema,
    expected: Schema.Number
  }),
  Schema.Struct({
    id: Schema.String,
    operation: Schema.Literal("studentTCdf"),
    input: DistStudentTEvalInputSchema,
    expected: Schema.Number
  }),
  Schema.Struct({
    id: Schema.String,
    operation: Schema.Literal("studentTQuantile"),
    input: DistStudentTQuantileInputSchema,
    expected: Schema.Number
  }),
  Schema.Struct({
    id: Schema.String,
    operation: Schema.Literal("studentTMean"),
    input: DistStudentTParamsInputSchema,
    expected: Schema.Number
  }),
  Schema.Struct({
    id: Schema.String,
    operation: Schema.Literal("studentTVariance"),
    input: DistStudentTParamsInputSchema,
    expected: Schema.Number
  })
)

export const DistCategoricalCaseSchema = Schema.Union(
  Schema.Struct({
    id: Schema.String,
    operation: Schema.Literal("categoricalPmf"),
    input: DistCategoricalEvalInputSchema,
    expected: Schema.Number
  }),
  Schema.Struct({
    id: Schema.String,
    operation: Schema.Literal("categoricalLogpmf"),
    input: DistCategoricalEvalInputSchema,
    expected: Schema.Number
  }),
  Schema.Struct({
    id: Schema.String,
    operation: Schema.Literal("categoricalCdf"),
    input: DistCategoricalEvalInputSchema,
    expected: Schema.Number
  }),
  Schema.Struct({
    id: Schema.String,
    operation: Schema.Literal("categoricalMean"),
    input: DistCategoricalParamsInputSchema,
    expected: Schema.Number
  }),
  Schema.Struct({
    id: Schema.String,
    operation: Schema.Literal("categoricalVariance"),
    input: DistCategoricalParamsInputSchema,
    expected: Schema.Number
  }),
  Schema.Struct({
    id: Schema.String,
    operation: Schema.Literal("categoricalEntropy"),
    input: DistCategoricalParamsInputSchema,
    expected: Schema.Number
  })
)

export const DistBinomialCaseSchema = Schema.Union(
  Schema.Struct({
    id: Schema.String,
    operation: Schema.Literal("binomialPmf"),
    input: DistBinomialEvalInputSchema,
    expected: Schema.Number
  }),
  Schema.Struct({
    id: Schema.String,
    operation: Schema.Literal("binomialLogpmf"),
    input: DistBinomialEvalInputSchema,
    expected: Schema.Number
  }),
  Schema.Struct({
    id: Schema.String,
    operation: Schema.Literal("binomialCdf"),
    input: DistBinomialEvalInputSchema,
    expected: Schema.Number
  }),
  Schema.Struct({
    id: Schema.String,
    operation: Schema.Literal("binomialMean"),
    input: DistBinomialParamsInputSchema,
    expected: Schema.Number
  }),
  Schema.Struct({
    id: Schema.String,
    operation: Schema.Literal("binomialVariance"),
    input: DistBinomialParamsInputSchema,
    expected: Schema.Number
  })
)

export const DistPoissonCaseSchema = Schema.Union(
  Schema.Struct({
    id: Schema.String,
    operation: Schema.Literal("poissonPmf"),
    input: DistPoissonEvalInputSchema,
    expected: Schema.Number
  }),
  Schema.Struct({
    id: Schema.String,
    operation: Schema.Literal("poissonLogpmf"),
    input: DistPoissonEvalInputSchema,
    expected: Schema.Number
  }),
  Schema.Struct({
    id: Schema.String,
    operation: Schema.Literal("poissonCdf"),
    input: DistPoissonEvalInputSchema,
    expected: Schema.Number
  }),
  Schema.Struct({
    id: Schema.String,
    operation: Schema.Literal("poissonMean"),
    input: DistPoissonParamsInputSchema,
    expected: Schema.Number
  }),
  Schema.Struct({
    id: Schema.String,
    operation: Schema.Literal("poissonVariance"),
    input: DistPoissonParamsInputSchema,
    expected: Schema.Number
  })
)

// Flat union of all 65 individual case structs — avoids nested Schema.Union
// which breaks Match.when narrowing (Match requires a flat discriminated union)
const DistributionAlgebraParityCaseSchema = Schema.Union(
  // Normal (7)
  Schema.Struct({
    id: Schema.String,
    operation: Schema.Literal("normalPdf"),
    input: DistNormalEvalInputSchema,
    expected: Schema.Number
  }),
  Schema.Struct({
    id: Schema.String,
    operation: Schema.Literal("normalLogpdf"),
    input: DistNormalEvalInputSchema,
    expected: Schema.Number
  }),
  Schema.Struct({
    id: Schema.String,
    operation: Schema.Literal("normalCdf"),
    input: DistNormalEvalInputSchema,
    expected: Schema.Number
  }),
  Schema.Struct({
    id: Schema.String,
    operation: Schema.Literal("normalQuantile"),
    input: DistNormalQuantileInputSchema,
    expected: Schema.Number
  }),
  Schema.Struct({
    id: Schema.String,
    operation: Schema.Literal("normalMean"),
    input: DistNormalParamsInputSchema,
    expected: Schema.Number
  }),
  Schema.Struct({
    id: Schema.String,
    operation: Schema.Literal("normalVariance"),
    input: DistNormalParamsInputSchema,
    expected: Schema.Number
  }),
  Schema.Struct({
    id: Schema.String,
    operation: Schema.Literal("normalEntropy"),
    input: DistNormalParamsInputSchema,
    expected: Schema.Number
  }),
  // LogNormal (7)
  Schema.Struct({
    id: Schema.String,
    operation: Schema.Literal("logNormalPdf"),
    input: DistLogNormalEvalInputSchema,
    expected: Schema.Number
  }),
  Schema.Struct({
    id: Schema.String,
    operation: Schema.Literal("logNormalLogpdf"),
    input: DistLogNormalEvalInputSchema,
    expected: Schema.Number
  }),
  Schema.Struct({
    id: Schema.String,
    operation: Schema.Literal("logNormalCdf"),
    input: DistLogNormalEvalInputSchema,
    expected: Schema.Number
  }),
  Schema.Struct({
    id: Schema.String,
    operation: Schema.Literal("logNormalQuantile"),
    input: DistLogNormalQuantileInputSchema,
    expected: Schema.Number
  }),
  Schema.Struct({
    id: Schema.String,
    operation: Schema.Literal("logNormalMean"),
    input: DistLogNormalParamsInputSchema,
    expected: Schema.Number
  }),
  Schema.Struct({
    id: Schema.String,
    operation: Schema.Literal("logNormalVariance"),
    input: DistLogNormalParamsInputSchema,
    expected: Schema.Number
  }),
  Schema.Struct({
    id: Schema.String,
    operation: Schema.Literal("logNormalEntropy"),
    input: DistLogNormalParamsInputSchema,
    expected: Schema.Number
  }),
  // Exponential (7)
  Schema.Struct({
    id: Schema.String,
    operation: Schema.Literal("exponentialPdf"),
    input: DistExponentialEvalInputSchema,
    expected: Schema.Number
  }),
  Schema.Struct({
    id: Schema.String,
    operation: Schema.Literal("exponentialLogpdf"),
    input: DistExponentialEvalInputSchema,
    expected: Schema.Number
  }),
  Schema.Struct({
    id: Schema.String,
    operation: Schema.Literal("exponentialCdf"),
    input: DistExponentialEvalInputSchema,
    expected: Schema.Number
  }),
  Schema.Struct({
    id: Schema.String,
    operation: Schema.Literal("exponentialQuantile"),
    input: DistExponentialQuantileInputSchema,
    expected: Schema.Number
  }),
  Schema.Struct({
    id: Schema.String,
    operation: Schema.Literal("exponentialMean"),
    input: DistExponentialParamsInputSchema,
    expected: Schema.Number
  }),
  Schema.Struct({
    id: Schema.String,
    operation: Schema.Literal("exponentialVariance"),
    input: DistExponentialParamsInputSchema,
    expected: Schema.Number
  }),
  Schema.Struct({
    id: Schema.String,
    operation: Schema.Literal("exponentialEntropy"),
    input: DistExponentialParamsInputSchema,
    expected: Schema.Number
  }),
  // Uniform (7)
  Schema.Struct({
    id: Schema.String,
    operation: Schema.Literal("uniformPdf"),
    input: DistUniformEvalInputSchema,
    expected: Schema.Number
  }),
  Schema.Struct({
    id: Schema.String,
    operation: Schema.Literal("uniformLogpdf"),
    input: DistUniformEvalInputSchema,
    expected: Schema.Number
  }),
  Schema.Struct({
    id: Schema.String,
    operation: Schema.Literal("uniformCdf"),
    input: DistUniformEvalInputSchema,
    expected: Schema.Number
  }),
  Schema.Struct({
    id: Schema.String,
    operation: Schema.Literal("uniformQuantile"),
    input: DistUniformQuantileInputSchema,
    expected: Schema.Number
  }),
  Schema.Struct({
    id: Schema.String,
    operation: Schema.Literal("uniformMean"),
    input: DistUniformParamsInputSchema,
    expected: Schema.Number
  }),
  Schema.Struct({
    id: Schema.String,
    operation: Schema.Literal("uniformVariance"),
    input: DistUniformParamsInputSchema,
    expected: Schema.Number
  }),
  Schema.Struct({
    id: Schema.String,
    operation: Schema.Literal("uniformEntropy"),
    input: DistUniformParamsInputSchema,
    expected: Schema.Number
  }),
  // Beta (7)
  Schema.Struct({
    id: Schema.String,
    operation: Schema.Literal("betaPdf"),
    input: DistBetaEvalInputSchema,
    expected: Schema.Number
  }),
  Schema.Struct({
    id: Schema.String,
    operation: Schema.Literal("betaLogpdf"),
    input: DistBetaEvalInputSchema,
    expected: Schema.Number
  }),
  Schema.Struct({
    id: Schema.String,
    operation: Schema.Literal("betaCdf"),
    input: DistBetaEvalInputSchema,
    expected: Schema.Number
  }),
  Schema.Struct({
    id: Schema.String,
    operation: Schema.Literal("betaQuantile"),
    input: DistBetaQuantileInputSchema,
    expected: Schema.Number
  }),
  Schema.Struct({
    id: Schema.String,
    operation: Schema.Literal("betaMean"),
    input: DistBetaParamsInputSchema,
    expected: Schema.Number
  }),
  Schema.Struct({
    id: Schema.String,
    operation: Schema.Literal("betaVariance"),
    input: DistBetaParamsInputSchema,
    expected: Schema.Number
  }),
  Schema.Struct({
    id: Schema.String,
    operation: Schema.Literal("betaEntropy"),
    input: DistBetaParamsInputSchema,
    expected: Schema.Number
  }),
  // Gamma (7)
  Schema.Struct({
    id: Schema.String,
    operation: Schema.Literal("gammaPdf"),
    input: DistGammaEvalInputSchema,
    expected: Schema.Number
  }),
  Schema.Struct({
    id: Schema.String,
    operation: Schema.Literal("gammaLogpdf"),
    input: DistGammaEvalInputSchema,
    expected: Schema.Number
  }),
  Schema.Struct({
    id: Schema.String,
    operation: Schema.Literal("gammaCdf"),
    input: DistGammaEvalInputSchema,
    expected: Schema.Number
  }),
  Schema.Struct({
    id: Schema.String,
    operation: Schema.Literal("gammaQuantile"),
    input: DistGammaQuantileInputSchema,
    expected: Schema.Number
  }),
  Schema.Struct({
    id: Schema.String,
    operation: Schema.Literal("gammaMean"),
    input: DistGammaParamsInputSchema,
    expected: Schema.Number
  }),
  Schema.Struct({
    id: Schema.String,
    operation: Schema.Literal("gammaVariance"),
    input: DistGammaParamsInputSchema,
    expected: Schema.Number
  }),
  Schema.Struct({
    id: Schema.String,
    operation: Schema.Literal("gammaEntropy"),
    input: DistGammaParamsInputSchema,
    expected: Schema.Number
  }),
  // StudentT (6)
  Schema.Struct({
    id: Schema.String,
    operation: Schema.Literal("studentTPdf"),
    input: DistStudentTEvalInputSchema,
    expected: Schema.Number
  }),
  Schema.Struct({
    id: Schema.String,
    operation: Schema.Literal("studentTLogpdf"),
    input: DistStudentTEvalInputSchema,
    expected: Schema.Number
  }),
  Schema.Struct({
    id: Schema.String,
    operation: Schema.Literal("studentTCdf"),
    input: DistStudentTEvalInputSchema,
    expected: Schema.Number
  }),
  Schema.Struct({
    id: Schema.String,
    operation: Schema.Literal("studentTQuantile"),
    input: DistStudentTQuantileInputSchema,
    expected: Schema.Number
  }),
  Schema.Struct({
    id: Schema.String,
    operation: Schema.Literal("studentTMean"),
    input: DistStudentTParamsInputSchema,
    expected: Schema.Number
  }),
  Schema.Struct({
    id: Schema.String,
    operation: Schema.Literal("studentTVariance"),
    input: DistStudentTParamsInputSchema,
    expected: Schema.Number
  }),
  // Categorical (6)
  Schema.Struct({
    id: Schema.String,
    operation: Schema.Literal("categoricalPmf"),
    input: DistCategoricalEvalInputSchema,
    expected: Schema.Number
  }),
  Schema.Struct({
    id: Schema.String,
    operation: Schema.Literal("categoricalLogpmf"),
    input: DistCategoricalEvalInputSchema,
    expected: Schema.Number
  }),
  Schema.Struct({
    id: Schema.String,
    operation: Schema.Literal("categoricalCdf"),
    input: DistCategoricalEvalInputSchema,
    expected: Schema.Number
  }),
  Schema.Struct({
    id: Schema.String,
    operation: Schema.Literal("categoricalMean"),
    input: DistCategoricalParamsInputSchema,
    expected: Schema.Number
  }),
  Schema.Struct({
    id: Schema.String,
    operation: Schema.Literal("categoricalVariance"),
    input: DistCategoricalParamsInputSchema,
    expected: Schema.Number
  }),
  Schema.Struct({
    id: Schema.String,
    operation: Schema.Literal("categoricalEntropy"),
    input: DistCategoricalParamsInputSchema,
    expected: Schema.Number
  }),
  // Binomial (5)
  Schema.Struct({
    id: Schema.String,
    operation: Schema.Literal("binomialPmf"),
    input: DistBinomialEvalInputSchema,
    expected: Schema.Number
  }),
  Schema.Struct({
    id: Schema.String,
    operation: Schema.Literal("binomialLogpmf"),
    input: DistBinomialEvalInputSchema,
    expected: Schema.Number
  }),
  Schema.Struct({
    id: Schema.String,
    operation: Schema.Literal("binomialCdf"),
    input: DistBinomialEvalInputSchema,
    expected: Schema.Number
  }),
  Schema.Struct({
    id: Schema.String,
    operation: Schema.Literal("binomialMean"),
    input: DistBinomialParamsInputSchema,
    expected: Schema.Number
  }),
  Schema.Struct({
    id: Schema.String,
    operation: Schema.Literal("binomialVariance"),
    input: DistBinomialParamsInputSchema,
    expected: Schema.Number
  }),
  // Poisson (5)
  Schema.Struct({
    id: Schema.String,
    operation: Schema.Literal("poissonPmf"),
    input: DistPoissonEvalInputSchema,
    expected: Schema.Number
  }),
  Schema.Struct({
    id: Schema.String,
    operation: Schema.Literal("poissonLogpmf"),
    input: DistPoissonEvalInputSchema,
    expected: Schema.Number
  }),
  Schema.Struct({
    id: Schema.String,
    operation: Schema.Literal("poissonCdf"),
    input: DistPoissonEvalInputSchema,
    expected: Schema.Number
  }),
  Schema.Struct({
    id: Schema.String,
    operation: Schema.Literal("poissonMean"),
    input: DistPoissonParamsInputSchema,
    expected: Schema.Number
  }),
  Schema.Struct({
    id: Schema.String,
    operation: Schema.Literal("poissonVariance"),
    input: DistPoissonParamsInputSchema,
    expected: Schema.Number
  })
)

export const DistributionAlgebraParityFixtureSchema = Schema.Struct({
  fixture: Schema.Literal("distribution.algebra-parity"),
  metadata: FixtureMetadataSchema,
  payload: Schema.Struct({
    cases: Schema.Array(DistributionAlgebraParityCaseSchema)
  })
})

// ---------------------------------------------------------------------------
// Fixture name literal union + known fixture union
// ---------------------------------------------------------------------------

export const FixtureNameSchema = Schema.Literal(
  "algebra.polynomial-parity",
  "calculus.numerical-parity",
  "complex.arithmetic-parity",
  "distribution.algebra-parity",
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
  ComplexArithmeticParityFixtureSchema,
  DistributionAlgebraParityFixtureSchema,
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
  file: Schema.String,
  hash: Schema.String
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
