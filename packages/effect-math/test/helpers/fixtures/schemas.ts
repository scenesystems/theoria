import { Array, Schema } from "effect"
import { CPythonRandomFixture, NumPyRandomFixture } from "./randomSchemas.js"

const FixtureMetadataSchema = Schema.Struct({
  generatedAt: Schema.String,
  generator: Schema.Struct({
    script: Schema.String
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
  input: Schema.Struct({ x: Schema.Finite }),
  expected: Schema.Finite
})

const NumericExpm1CaseSchema = Schema.Struct({
  id: Schema.String,
  operation: Schema.Literal("expm1"),
  input: Schema.Struct({ x: Schema.Finite }),
  expected: Schema.Finite
})

const NumericSumCaseSchema = Schema.Struct({
  id: Schema.String,
  operation: Schema.Literal("sum"),
  input: Schema.Struct({ values: Schema.Array(Schema.Finite) }),
  expected: Schema.Finite
})

const NumericPairwiseSumCaseSchema = Schema.Struct({
  ...NumericSumCaseSchema.fields,
  operation: Schema.Literal("sumPairwise")
})

const NumericScalarCaseSchema = Schema.Union([
  NumericLog1pCaseSchema,
  NumericExpm1CaseSchema,
  NumericSumCaseSchema,
  NumericPairwiseSumCaseSchema
])

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
  input: Schema.Struct({ a: Schema.Array(Schema.Finite), b: Schema.Array(Schema.Finite) }),
  expected: Schema.Finite
})

const LinalgNormCaseSchema = Schema.Struct({
  id: Schema.String,
  operation: Schema.Literal("norm"),
  input: Schema.Struct({
    kind: Schema.Literals(["L1", "L2", "Linf"]),
    values: Schema.Array(Schema.Finite)
  }),
  expected: Schema.Finite
})

const LinalgMatvecCaseSchema = Schema.Struct({
  id: Schema.String,
  operation: Schema.Literal("matvec"),
  input: Schema.Struct({
    data: Schema.Array(Schema.Finite),
    rows: Schema.Finite,
    cols: Schema.Finite,
    x: Schema.Array(Schema.Finite)
  }),
  expected: Schema.Array(Schema.Finite)
})

const LinalgFrobeniusCaseSchema = Schema.Struct({
  id: Schema.String,
  operation: Schema.Literal("frobenius"),
  input: Schema.Struct({
    data: Schema.Array(Schema.Finite),
    rows: Schema.Finite,
    cols: Schema.Finite
  }),
  expected: Schema.Finite
})

const LinalgVectorCaseSchema = Schema.Union([
  LinalgDotCaseSchema,
  LinalgNormCaseSchema,
  LinalgMatvecCaseSchema,
  LinalgFrobeniusCaseSchema
])

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
    a: Schema.Array(Schema.Finite),
    b: Schema.Array(Schema.Finite),
    metric: Schema.Literals(["euclidean", "manhattan", "chebyshev"])
  }),
  expected: Schema.Finite
})

const GeometryMidpointCaseSchema = Schema.Struct({
  id: Schema.String,
  operation: Schema.Literal("midpoint"),
  input: Schema.Struct({
    a: Schema.Array(Schema.Finite),
    b: Schema.Array(Schema.Finite)
  }),
  expected: Schema.Array(Schema.Finite)
})

const GeometryDistanceParityCaseSchema = Schema.Union([
  GeometryDistanceCaseSchema,
  GeometryMidpointCaseSchema
])

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
  input: Schema.Struct({ x: Schema.Finite, mu: Schema.Finite, sigma: Schema.Finite }),
  expected: Schema.Finite
})

const ProbabilityNormalCdfCaseSchema = Schema.Struct({
  id: Schema.String,
  operation: Schema.Literal("normalCdf"),
  input: Schema.Struct({ x: Schema.Finite, mu: Schema.Finite, sigma: Schema.Finite }),
  expected: Schema.Finite
})

const ProbabilityUniformPdfCaseSchema = Schema.Struct({
  id: Schema.String,
  operation: Schema.Literal("uniformPdf"),
  input: Schema.Struct({ x: Schema.Finite, low: Schema.Finite, high: Schema.Finite }),
  expected: Schema.Finite
})

const ProbabilityUniformCdfCaseSchema = Schema.Struct({
  id: Schema.String,
  operation: Schema.Literal("uniformCdf"),
  input: Schema.Struct({ x: Schema.Finite, low: Schema.Finite, high: Schema.Finite }),
  expected: Schema.Finite
})

const ProbabilityEntropyCaseSchema = Schema.Struct({
  id: Schema.String,
  operation: Schema.Literal("entropy"),
  input: Schema.Struct({ probabilities: Schema.Array(Schema.Finite) }),
  expected: Schema.Finite
})

const ProbabilityDistributionCaseSchema = Schema.Union([
  ProbabilityNormalPdfCaseSchema,
  ProbabilityNormalCdfCaseSchema,
  ProbabilityUniformPdfCaseSchema,
  ProbabilityUniformCdfCaseSchema,
  ProbabilityEntropyCaseSchema
])

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
  input: Schema.Struct({ values: Schema.Array(Schema.Finite) }),
  expected: Schema.Finite
})

const StatisticsVarianceCaseSchema = Schema.Struct({
  id: Schema.String,
  operation: Schema.Literal("variance"),
  input: Schema.Struct({ values: Schema.Array(Schema.Finite) }),
  expected: Schema.Finite
})

const StatisticsStddevCaseSchema = Schema.Struct({
  id: Schema.String,
  operation: Schema.Literal("standardDeviation"),
  input: Schema.Struct({ values: Schema.Array(Schema.Finite) }),
  expected: Schema.Finite
})

const StatisticsCovarianceCaseSchema = Schema.Struct({
  id: Schema.String,
  operation: Schema.Literal("covariance"),
  input: Schema.Struct({ a: Schema.Array(Schema.Finite), b: Schema.Array(Schema.Finite) }),
  expected: Schema.Finite
})

const StatisticsMinMaxCaseSchema = Schema.Struct({
  id: Schema.String,
  operation: Schema.Literal("minMax"),
  input: Schema.Struct({ values: Schema.Array(Schema.Finite) }),
  expected: Schema.Struct({ min: Schema.Finite, max: Schema.Finite })
})

const StatisticsEstimatorCaseSchema = Schema.Union([
  StatisticsMeanCaseSchema,
  StatisticsVarianceCaseSchema,
  StatisticsStddevCaseSchema,
  StatisticsCovarianceCaseSchema,
  StatisticsMinMaxCaseSchema
])

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
  input: Schema.Struct({ a: Schema.Finite, b: Schema.Finite }),
  expected: Schema.Finite
})

const NumericLogsubexpCaseSchema = Schema.Struct({
  id: Schema.String,
  operation: Schema.Literal("logsubexp"),
  input: Schema.Struct({ a: Schema.Finite, b: Schema.Finite }),
  expected: Schema.Finite
})

const NumericLog1mexpCaseSchema = Schema.Struct({
  id: Schema.String,
  operation: Schema.Literal("log1mexp"),
  input: Schema.Struct({ x: Schema.Finite }),
  expected: Schema.Finite
})

const NumericLog1pexpCaseSchema = Schema.Struct({
  id: Schema.String,
  operation: Schema.Literal("log1pexp"),
  input: Schema.Struct({ x: Schema.Finite }),
  expected: Schema.Finite
})

const NumericXlogyCaseSchema = Schema.Struct({
  id: Schema.String,
  operation: Schema.Literal("xlogy"),
  input: Schema.Struct({ x: Schema.Finite, y: Schema.Finite }),
  expected: Schema.Finite
})

const NumericXlog1pyCaseSchema = Schema.Struct({
  id: Schema.String,
  operation: Schema.Literal("xlog1py"),
  input: Schema.Struct({ x: Schema.Finite, y: Schema.Finite }),
  expected: Schema.Finite
})

const NumericLogSumExpCaseSchema = Schema.Struct({
  id: Schema.String,
  operation: Schema.Literal("logSumExp"),
  input: Schema.Struct({ values: Schema.Array(Schema.Finite) }),
  expected: Schema.Finite
})

const NumericLogspaceCaseSchema = Schema.Union([
  NumericLogaddexpCaseSchema,
  NumericLogsubexpCaseSchema,
  NumericLog1mexpCaseSchema,
  NumericLog1pexpCaseSchema,
  NumericXlogyCaseSchema,
  NumericXlog1pyCaseSchema,
  NumericLogSumExpCaseSchema
])

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
  input: Schema.Struct({ x: Schema.Finite }),
  expected: Schema.Finite
})

const SpecialLnGammaCaseSchema = Schema.Struct({
  id: Schema.String,
  operation: Schema.Literal("lnGamma"),
  input: Schema.Struct({ x: Schema.Finite }),
  expected: Schema.Finite
})

const SpecialBetaCaseSchema = Schema.Struct({
  id: Schema.String,
  operation: Schema.Literal("beta"),
  input: Schema.Struct({ a: Schema.Finite, b: Schema.Finite }),
  expected: Schema.Finite
})

const SpecialErfCaseSchema = Schema.Struct({
  id: Schema.String,
  operation: Schema.Literal("erf"),
  input: Schema.Struct({ x: Schema.Finite }),
  expected: Schema.Finite
})

const SpecialErfcCaseSchema = Schema.Struct({
  id: Schema.String,
  operation: Schema.Literal("erfc"),
  input: Schema.Struct({ x: Schema.Finite }),
  expected: Schema.Finite
})

const SpecialDigammaCaseSchema = Schema.Struct({
  id: Schema.String,
  operation: Schema.Literal("digamma"),
  input: Schema.Struct({ x: Schema.Finite }),
  expected: Schema.Finite
})

const SpecialFunctionCaseSchema = Schema.Union([
  SpecialGammaCaseSchema,
  SpecialLnGammaCaseSchema,
  SpecialBetaCaseSchema,
  SpecialErfCaseSchema,
  SpecialErfcCaseSchema,
  SpecialDigammaCaseSchema
])

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
  input: Schema.Struct({ x: Schema.Finite }),
  expected: Schema.Finite
})

const SpecialErfcinvCaseSchema = Schema.Struct({
  id: Schema.String,
  operation: Schema.Literal("erfcinv"),
  input: Schema.Struct({ x: Schema.Finite }),
  expected: Schema.Finite
})

const SpecialGammaincCaseSchema = Schema.Struct({
  id: Schema.String,
  operation: Schema.Literal("gammainc"),
  input: Schema.Struct({ a: Schema.Finite, x: Schema.Finite }),
  expected: Schema.Finite
})

const SpecialGammainccCaseSchema = Schema.Struct({
  id: Schema.String,
  operation: Schema.Literal("gammaincc"),
  input: Schema.Struct({ a: Schema.Finite, x: Schema.Finite }),
  expected: Schema.Finite
})

const SpecialBetaincCaseSchema = Schema.Struct({
  id: Schema.String,
  operation: Schema.Literal("betainc"),
  input: Schema.Struct({ a: Schema.Finite, b: Schema.Finite, x: Schema.Finite }),
  expected: Schema.Finite
})

const SpecialPolygammaCaseSchema = Schema.Struct({
  id: Schema.String,
  operation: Schema.Literal("polygamma"),
  input: Schema.Struct({ n: Schema.Finite, x: Schema.Finite }),
  expected: Schema.Finite
})

const SpecialInverseCaseSchema = Schema.Union([
  SpecialErfinvCaseSchema,
  SpecialErfcinvCaseSchema,
  SpecialGammaincCaseSchema,
  SpecialGammainccCaseSchema,
  SpecialBetaincCaseSchema,
  SpecialPolygammaCaseSchema
])

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
  input: Schema.Struct({ coefficients: Schema.Array(Schema.Finite), x: Schema.Finite }),
  expected: Schema.Finite
})

const AlgebraPolyDerivativeCaseSchema = Schema.Struct({
  id: Schema.String,
  operation: Schema.Literal("polyDerivative"),
  input: Schema.Struct({ coefficients: Schema.Array(Schema.Finite) }),
  expected: Schema.Array(Schema.Finite)
})

const AlgebraGcdCaseSchema = Schema.Struct({
  id: Schema.String,
  operation: Schema.Literal("gcd"),
  input: Schema.Struct({ a: Schema.Finite, b: Schema.Finite }),
  expected: Schema.Finite
})

const AlgebraLcmCaseSchema = Schema.Struct({
  id: Schema.String,
  operation: Schema.Literal("lcm"),
  input: Schema.Struct({ a: Schema.Finite, b: Schema.Finite }),
  expected: Schema.Finite
})

const AlgebraFactorialCaseSchema = Schema.Struct({
  id: Schema.String,
  operation: Schema.Literal("factorial"),
  input: Schema.Struct({ n: Schema.Finite }),
  expected: Schema.Finite
})

const AlgebraPolynomialCaseSchema = Schema.Union([
  AlgebraPolyEvalCaseSchema,
  AlgebraPolyDerivativeCaseSchema,
  AlgebraGcdCaseSchema,
  AlgebraLcmCaseSchema,
  AlgebraFactorialCaseSchema
])

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

const NumericalAssertionSchema = Schema.Struct({
  absoluteTolerance: Schema.Finite.check(Schema.isGreaterThan(0)),
  relativeTolerance: Schema.Finite.check(Schema.isGreaterThan(0))
})

const CalculusDerivativeCaseSchema = Schema.Struct({
  id: Schema.String,
  operation: Schema.Literal("derivative"),
  input: Schema.Struct({ function: Schema.String, x: Schema.Finite }),
  expected: Schema.Finite,
  assertion: NumericalAssertionSchema
})

const CalculusSecondDerivativeCaseSchema = Schema.Struct({
  id: Schema.String,
  operation: Schema.Literal("secondDerivative"),
  input: Schema.Struct({ function: Schema.String, x: Schema.Finite }),
  expected: Schema.Finite,
  assertion: NumericalAssertionSchema
})

const CalculusDirectionalDerivativeCaseSchema = Schema.Struct({
  id: Schema.String,
  operation: Schema.Literal("directionalDerivative"),
  input: Schema.Struct({
    function: Schema.String,
    point: Schema.Array(Schema.Finite),
    direction: Schema.Array(Schema.Finite)
  }),
  expected: Schema.Finite,
  assertion: NumericalAssertionSchema
})

const CalculusTrapezoidCaseSchema = Schema.Struct({
  id: Schema.String,
  operation: Schema.Literal("trapezoid"),
  input: Schema.Struct({ values: Schema.Array(Schema.Finite), dx: Schema.Finite }),
  expected: Schema.Finite,
  assertion: NumericalAssertionSchema
})

const CalculusSimpsonCaseSchema = Schema.Struct({
  id: Schema.String,
  operation: Schema.Literal("simpson"),
  input: Schema.Struct({ values: Schema.Array(Schema.Finite), dx: Schema.Finite }),
  expected: Schema.Finite,
  assertion: NumericalAssertionSchema
})

const CalculusAdaptiveSimpsonCaseSchema = Schema.Struct({
  id: Schema.String,
  operation: Schema.Literal("adaptiveSimpson"),
  input: Schema.Struct({
    function: Schema.String,
    a: Schema.Finite,
    b: Schema.Finite,
    absoluteTolerance: Schema.Finite,
    relativeTolerance: Schema.Finite,
    maxDepth: Schema.Finite
  }),
  expected: Schema.Finite,
  assertion: NumericalAssertionSchema
})

const CalculusGradientCaseSchema = Schema.Struct({
  id: Schema.String,
  operation: Schema.Literal("gradient"),
  input: Schema.Struct({ function: Schema.String, point: Schema.Array(Schema.Finite) }),
  expected: Schema.Array(Schema.Finite),
  assertion: NumericalAssertionSchema
})

const CalculusJacobianCaseSchema = Schema.Struct({
  id: Schema.String,
  operation: Schema.Literal("jacobian"),
  input: Schema.Struct({ function: Schema.String, point: Schema.Array(Schema.Finite) }),
  expected: Schema.Array(Schema.Array(Schema.Finite)),
  assertion: NumericalAssertionSchema
})

const CalculusHessianCaseSchema = Schema.Struct({
  id: Schema.String,
  operation: Schema.Literal("hessian"),
  input: Schema.Struct({ function: Schema.String, point: Schema.Array(Schema.Finite) }),
  expected: Schema.Array(Schema.Array(Schema.Finite)),
  assertion: NumericalAssertionSchema
})

const CalculusDivergenceCaseSchema = Schema.Struct({
  id: Schema.String,
  operation: Schema.Literal("divergence"),
  input: Schema.Struct({ function: Schema.String, point: Schema.Array(Schema.Finite) }),
  expected: Schema.Finite,
  assertion: NumericalAssertionSchema
})

const CalculusLaplacianCaseSchema = Schema.Struct({
  id: Schema.String,
  operation: Schema.Literal("laplacian"),
  input: Schema.Struct({ function: Schema.String, point: Schema.Array(Schema.Finite) }),
  expected: Schema.Finite,
  assertion: NumericalAssertionSchema
})

const CalculusNumericalCaseSchema = Schema.Union([
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
])

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
  input: Schema.Struct({ function: Schema.String, a: Schema.Finite, b: Schema.Finite }),
  expected: Schema.Finite
})

const OptimizationGoldenSectionCaseSchema = Schema.Struct({
  id: Schema.String,
  operation: Schema.Literal("goldenSection"),
  input: Schema.Struct({ function: Schema.String, a: Schema.Finite, b: Schema.Finite }),
  expected: Schema.Finite
})

const OptimizationSolverCaseSchema = Schema.Union([
  OptimizationBisectCaseSchema,
  OptimizationGoldenSectionCaseSchema
])

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

const ComplexReImExpected = Schema.Struct({ re: Schema.Finite, im: Schema.Finite })

const ComplexBinaryInputSchema = Schema.Struct({
  aRe: Schema.Finite,
  aIm: Schema.Finite,
  bRe: Schema.Finite,
  bIm: Schema.Finite
})

const ComplexUnaryInputSchema = Schema.Struct({
  re: Schema.Finite,
  im: Schema.Finite
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
  expected: Schema.Finite
})

const ComplexArgCaseSchema = Schema.Struct({
  id: Schema.String,
  operation: Schema.Literal("arg"),
  input: ComplexUnaryInputSchema,
  expected: Schema.Finite
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
    baseRe: Schema.Finite,
    baseIm: Schema.Finite,
    expRe: Schema.Finite,
    expIm: Schema.Finite
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
  expected: Schema.Struct({ r: Schema.Finite, theta: Schema.Finite })
})

const ComplexDerivativeCaseSchema = Schema.Struct({
  id: Schema.String,
  operation: Schema.Literal("complexDerivative"),
  input: Schema.Struct({ fn: Schema.String, x: Schema.Finite }),
  expected: Schema.Finite
})

const ComplexArithmeticCaseSchema = Schema.Union([
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
])

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

const DistNormalEvalInputSchema = Schema.Struct({ x: Schema.Finite, mu: Schema.Finite, sigma: Schema.Finite })
const DistNormalParamsInputSchema = Schema.Struct({ mu: Schema.Finite, sigma: Schema.Finite })
const DistNormalQuantileInputSchema = Schema.Struct({ p: Schema.Finite, mu: Schema.Finite, sigma: Schema.Finite })

const DistLogNormalEvalInputSchema = Schema.Struct({ x: Schema.Finite, mu: Schema.Finite, sigma: Schema.Finite })
const DistLogNormalParamsInputSchema = Schema.Struct({ mu: Schema.Finite, sigma: Schema.Finite })
const DistLogNormalQuantileInputSchema = Schema.Struct({ p: Schema.Finite, mu: Schema.Finite, sigma: Schema.Finite })

const DistExponentialEvalInputSchema = Schema.Struct({ x: Schema.Finite, rate: Schema.Finite })
const DistExponentialParamsInputSchema = Schema.Struct({ rate: Schema.Finite })
const DistExponentialQuantileInputSchema = Schema.Struct({ p: Schema.Finite, rate: Schema.Finite })

const DistUniformEvalInputSchema = Schema.Struct({ x: Schema.Finite, low: Schema.Finite, high: Schema.Finite })
const DistUniformParamsInputSchema = Schema.Struct({ low: Schema.Finite, high: Schema.Finite })
const DistUniformQuantileInputSchema = Schema.Struct({ p: Schema.Finite, low: Schema.Finite, high: Schema.Finite })

const DistBetaEvalInputSchema = Schema.Struct({ x: Schema.Finite, alpha: Schema.Finite, beta: Schema.Finite })
const DistBetaParamsInputSchema = Schema.Struct({ alpha: Schema.Finite, beta: Schema.Finite })
const DistBetaQuantileInputSchema = Schema.Struct({ p: Schema.Finite, alpha: Schema.Finite, beta: Schema.Finite })

const DistGammaEvalInputSchema = Schema.Struct({ x: Schema.Finite, shape: Schema.Finite, scale: Schema.Finite })
const DistGammaParamsInputSchema = Schema.Struct({ shape: Schema.Finite, scale: Schema.Finite })
const DistGammaQuantileInputSchema = Schema.Struct({ p: Schema.Finite, shape: Schema.Finite, scale: Schema.Finite })

const DistStudentTEvalInputSchema = Schema.Struct({ x: Schema.Finite, df: Schema.Finite })
const DistStudentTParamsInputSchema = Schema.Struct({ df: Schema.Finite })
const DistStudentTQuantileInputSchema = Schema.Struct({ p: Schema.Finite, df: Schema.Finite })

const DistCategoricalEvalInputSchema = Schema.Struct({ k: Schema.Finite, probs: Schema.Array(Schema.Finite) })
const DistCategoricalParamsInputSchema = Schema.Struct({ probs: Schema.Array(Schema.Finite) })

const DistBinomialEvalInputSchema = Schema.Struct({ k: Schema.Finite, n: Schema.Finite, p: Schema.Finite })
const DistBinomialParamsInputSchema = Schema.Struct({ n: Schema.Finite, p: Schema.Finite })

const DistPoissonEvalInputSchema = Schema.Struct({ k: Schema.Finite, mu: Schema.Finite })
const DistPoissonParamsInputSchema = Schema.Struct({ mu: Schema.Finite })

export const DistNormalCaseSchema = Schema.Union([
  Schema.Struct({
    id: Schema.String,
    operation: Schema.Literal("normalPdf"),
    input: DistNormalEvalInputSchema,
    expected: Schema.Finite
  }),
  Schema.Struct({
    id: Schema.String,
    operation: Schema.Literal("normalLogpdf"),
    input: DistNormalEvalInputSchema,
    expected: Schema.Finite
  }),
  Schema.Struct({
    id: Schema.String,
    operation: Schema.Literal("normalCdf"),
    input: DistNormalEvalInputSchema,
    expected: Schema.Finite
  }),
  Schema.Struct({
    id: Schema.String,
    operation: Schema.Literal("normalQuantile"),
    input: DistNormalQuantileInputSchema,
    expected: Schema.Finite
  }),
  Schema.Struct({
    id: Schema.String,
    operation: Schema.Literal("normalMean"),
    input: DistNormalParamsInputSchema,
    expected: Schema.Finite
  }),
  Schema.Struct({
    id: Schema.String,
    operation: Schema.Literal("normalVariance"),
    input: DistNormalParamsInputSchema,
    expected: Schema.Finite
  }),
  Schema.Struct({
    id: Schema.String,
    operation: Schema.Literal("normalEntropy"),
    input: DistNormalParamsInputSchema,
    expected: Schema.Finite
  })
])

export const DistLogNormalCaseSchema = Schema.Union([
  Schema.Struct({
    id: Schema.String,
    operation: Schema.Literal("logNormalPdf"),
    input: DistLogNormalEvalInputSchema,
    expected: Schema.Finite
  }),
  Schema.Struct({
    id: Schema.String,
    operation: Schema.Literal("logNormalLogpdf"),
    input: DistLogNormalEvalInputSchema,
    expected: Schema.Finite
  }),
  Schema.Struct({
    id: Schema.String,
    operation: Schema.Literal("logNormalCdf"),
    input: DistLogNormalEvalInputSchema,
    expected: Schema.Finite
  }),
  Schema.Struct({
    id: Schema.String,
    operation: Schema.Literal("logNormalQuantile"),
    input: DistLogNormalQuantileInputSchema,
    expected: Schema.Finite
  }),
  Schema.Struct({
    id: Schema.String,
    operation: Schema.Literal("logNormalMean"),
    input: DistLogNormalParamsInputSchema,
    expected: Schema.Finite
  }),
  Schema.Struct({
    id: Schema.String,
    operation: Schema.Literal("logNormalVariance"),
    input: DistLogNormalParamsInputSchema,
    expected: Schema.Finite
  }),
  Schema.Struct({
    id: Schema.String,
    operation: Schema.Literal("logNormalEntropy"),
    input: DistLogNormalParamsInputSchema,
    expected: Schema.Finite
  })
])

export const DistExponentialCaseSchema = Schema.Union([
  Schema.Struct({
    id: Schema.String,
    operation: Schema.Literal("exponentialPdf"),
    input: DistExponentialEvalInputSchema,
    expected: Schema.Finite
  }),
  Schema.Struct({
    id: Schema.String,
    operation: Schema.Literal("exponentialLogpdf"),
    input: DistExponentialEvalInputSchema,
    expected: Schema.Finite
  }),
  Schema.Struct({
    id: Schema.String,
    operation: Schema.Literal("exponentialCdf"),
    input: DistExponentialEvalInputSchema,
    expected: Schema.Finite
  }),
  Schema.Struct({
    id: Schema.String,
    operation: Schema.Literal("exponentialQuantile"),
    input: DistExponentialQuantileInputSchema,
    expected: Schema.Finite
  }),
  Schema.Struct({
    id: Schema.String,
    operation: Schema.Literal("exponentialMean"),
    input: DistExponentialParamsInputSchema,
    expected: Schema.Finite
  }),
  Schema.Struct({
    id: Schema.String,
    operation: Schema.Literal("exponentialVariance"),
    input: DistExponentialParamsInputSchema,
    expected: Schema.Finite
  }),
  Schema.Struct({
    id: Schema.String,
    operation: Schema.Literal("exponentialEntropy"),
    input: DistExponentialParamsInputSchema,
    expected: Schema.Finite
  })
])

export const DistUniformCaseSchema = Schema.Union([
  Schema.Struct({
    id: Schema.String,
    operation: Schema.Literal("uniformPdf"),
    input: DistUniformEvalInputSchema,
    expected: Schema.Finite
  }),
  Schema.Struct({
    id: Schema.String,
    operation: Schema.Literal("uniformLogpdf"),
    input: DistUniformEvalInputSchema,
    expected: Schema.Finite
  }),
  Schema.Struct({
    id: Schema.String,
    operation: Schema.Literal("uniformCdf"),
    input: DistUniformEvalInputSchema,
    expected: Schema.Finite
  }),
  Schema.Struct({
    id: Schema.String,
    operation: Schema.Literal("uniformQuantile"),
    input: DistUniformQuantileInputSchema,
    expected: Schema.Finite
  }),
  Schema.Struct({
    id: Schema.String,
    operation: Schema.Literal("uniformMean"),
    input: DistUniformParamsInputSchema,
    expected: Schema.Finite
  }),
  Schema.Struct({
    id: Schema.String,
    operation: Schema.Literal("uniformVariance"),
    input: DistUniformParamsInputSchema,
    expected: Schema.Finite
  }),
  Schema.Struct({
    id: Schema.String,
    operation: Schema.Literal("uniformEntropy"),
    input: DistUniformParamsInputSchema,
    expected: Schema.Finite
  })
])

export const DistBetaCaseSchema = Schema.Union([
  Schema.Struct({
    id: Schema.String,
    operation: Schema.Literal("betaPdf"),
    input: DistBetaEvalInputSchema,
    expected: Schema.Finite
  }),
  Schema.Struct({
    id: Schema.String,
    operation: Schema.Literal("betaLogpdf"),
    input: DistBetaEvalInputSchema,
    expected: Schema.Finite
  }),
  Schema.Struct({
    id: Schema.String,
    operation: Schema.Literal("betaCdf"),
    input: DistBetaEvalInputSchema,
    expected: Schema.Finite
  }),
  Schema.Struct({
    id: Schema.String,
    operation: Schema.Literal("betaQuantile"),
    input: DistBetaQuantileInputSchema,
    expected: Schema.Finite
  }),
  Schema.Struct({
    id: Schema.String,
    operation: Schema.Literal("betaMean"),
    input: DistBetaParamsInputSchema,
    expected: Schema.Finite
  }),
  Schema.Struct({
    id: Schema.String,
    operation: Schema.Literal("betaVariance"),
    input: DistBetaParamsInputSchema,
    expected: Schema.Finite
  }),
  Schema.Struct({
    id: Schema.String,
    operation: Schema.Literal("betaEntropy"),
    input: DistBetaParamsInputSchema,
    expected: Schema.Finite
  })
])

export const DistGammaCaseSchema = Schema.Union([
  Schema.Struct({
    id: Schema.String,
    operation: Schema.Literal("gammaPdf"),
    input: DistGammaEvalInputSchema,
    expected: Schema.Finite
  }),
  Schema.Struct({
    id: Schema.String,
    operation: Schema.Literal("gammaLogpdf"),
    input: DistGammaEvalInputSchema,
    expected: Schema.Finite
  }),
  Schema.Struct({
    id: Schema.String,
    operation: Schema.Literal("gammaCdf"),
    input: DistGammaEvalInputSchema,
    expected: Schema.Finite
  }),
  Schema.Struct({
    id: Schema.String,
    operation: Schema.Literal("gammaQuantile"),
    input: DistGammaQuantileInputSchema,
    expected: Schema.Finite
  }),
  Schema.Struct({
    id: Schema.String,
    operation: Schema.Literal("gammaMean"),
    input: DistGammaParamsInputSchema,
    expected: Schema.Finite
  }),
  Schema.Struct({
    id: Schema.String,
    operation: Schema.Literal("gammaVariance"),
    input: DistGammaParamsInputSchema,
    expected: Schema.Finite
  }),
  Schema.Struct({
    id: Schema.String,
    operation: Schema.Literal("gammaEntropy"),
    input: DistGammaParamsInputSchema,
    expected: Schema.Finite
  })
])

export const DistStudentTCaseSchema = Schema.Union([
  Schema.Struct({
    id: Schema.String,
    operation: Schema.Literal("studentTPdf"),
    input: DistStudentTEvalInputSchema,
    expected: Schema.Finite
  }),
  Schema.Struct({
    id: Schema.String,
    operation: Schema.Literal("studentTLogpdf"),
    input: DistStudentTEvalInputSchema,
    expected: Schema.Finite
  }),
  Schema.Struct({
    id: Schema.String,
    operation: Schema.Literal("studentTCdf"),
    input: DistStudentTEvalInputSchema,
    expected: Schema.Finite
  }),
  Schema.Struct({
    id: Schema.String,
    operation: Schema.Literal("studentTQuantile"),
    input: DistStudentTQuantileInputSchema,
    expected: Schema.Finite
  }),
  Schema.Struct({
    id: Schema.String,
    operation: Schema.Literal("studentTMean"),
    input: DistStudentTParamsInputSchema,
    expected: Schema.Finite
  }),
  Schema.Struct({
    id: Schema.String,
    operation: Schema.Literal("studentTVariance"),
    input: DistStudentTParamsInputSchema,
    expected: Schema.Finite
  })
])

export const DistCategoricalCaseSchema = Schema.Union([
  Schema.Struct({
    id: Schema.String,
    operation: Schema.Literal("categoricalPmf"),
    input: DistCategoricalEvalInputSchema,
    expected: Schema.Finite
  }),
  Schema.Struct({
    id: Schema.String,
    operation: Schema.Literal("categoricalLogpmf"),
    input: DistCategoricalEvalInputSchema,
    expected: Schema.Finite
  }),
  Schema.Struct({
    id: Schema.String,
    operation: Schema.Literal("categoricalCdf"),
    input: DistCategoricalEvalInputSchema,
    expected: Schema.Finite
  }),
  Schema.Struct({
    id: Schema.String,
    operation: Schema.Literal("categoricalMean"),
    input: DistCategoricalParamsInputSchema,
    expected: Schema.Finite
  }),
  Schema.Struct({
    id: Schema.String,
    operation: Schema.Literal("categoricalVariance"),
    input: DistCategoricalParamsInputSchema,
    expected: Schema.Finite
  }),
  Schema.Struct({
    id: Schema.String,
    operation: Schema.Literal("categoricalEntropy"),
    input: DistCategoricalParamsInputSchema,
    expected: Schema.Finite
  })
])

export const DistBinomialCaseSchema = Schema.Union([
  Schema.Struct({
    id: Schema.String,
    operation: Schema.Literal("binomialPmf"),
    input: DistBinomialEvalInputSchema,
    expected: Schema.Finite
  }),
  Schema.Struct({
    id: Schema.String,
    operation: Schema.Literal("binomialLogpmf"),
    input: DistBinomialEvalInputSchema,
    expected: Schema.Finite
  }),
  Schema.Struct({
    id: Schema.String,
    operation: Schema.Literal("binomialCdf"),
    input: DistBinomialEvalInputSchema,
    expected: Schema.Finite
  }),
  Schema.Struct({
    id: Schema.String,
    operation: Schema.Literal("binomialMean"),
    input: DistBinomialParamsInputSchema,
    expected: Schema.Finite
  }),
  Schema.Struct({
    id: Schema.String,
    operation: Schema.Literal("binomialVariance"),
    input: DistBinomialParamsInputSchema,
    expected: Schema.Finite
  })
])

export const DistPoissonCaseSchema = Schema.Union([
  Schema.Struct({
    id: Schema.String,
    operation: Schema.Literal("poissonPmf"),
    input: DistPoissonEvalInputSchema,
    expected: Schema.Finite
  }),
  Schema.Struct({
    id: Schema.String,
    operation: Schema.Literal("poissonLogpmf"),
    input: DistPoissonEvalInputSchema,
    expected: Schema.Finite
  }),
  Schema.Struct({
    id: Schema.String,
    operation: Schema.Literal("poissonCdf"),
    input: DistPoissonEvalInputSchema,
    expected: Schema.Finite
  }),
  Schema.Struct({
    id: Schema.String,
    operation: Schema.Literal("poissonMean"),
    input: DistPoissonParamsInputSchema,
    expected: Schema.Finite
  }),
  Schema.Struct({
    id: Schema.String,
    operation: Schema.Literal("poissonVariance"),
    input: DistPoissonParamsInputSchema,
    expected: Schema.Finite
  })
])

// Flat union of all 65 individual case structs — avoids nested Schema.Union
// which breaks Match.when narrowing (Match requires a flat discriminated union)
const DistributionAlgebraParityCaseSchema = Schema.Union([
  // Normal (7)
  Schema.Struct({
    id: Schema.String,
    operation: Schema.Literal("normalPdf"),
    input: DistNormalEvalInputSchema,
    expected: Schema.Finite
  }),
  Schema.Struct({
    id: Schema.String,
    operation: Schema.Literal("normalLogpdf"),
    input: DistNormalEvalInputSchema,
    expected: Schema.Finite
  }),
  Schema.Struct({
    id: Schema.String,
    operation: Schema.Literal("normalCdf"),
    input: DistNormalEvalInputSchema,
    expected: Schema.Finite
  }),
  Schema.Struct({
    id: Schema.String,
    operation: Schema.Literal("normalQuantile"),
    input: DistNormalQuantileInputSchema,
    expected: Schema.Finite
  }),
  Schema.Struct({
    id: Schema.String,
    operation: Schema.Literal("normalMean"),
    input: DistNormalParamsInputSchema,
    expected: Schema.Finite
  }),
  Schema.Struct({
    id: Schema.String,
    operation: Schema.Literal("normalVariance"),
    input: DistNormalParamsInputSchema,
    expected: Schema.Finite
  }),
  Schema.Struct({
    id: Schema.String,
    operation: Schema.Literal("normalEntropy"),
    input: DistNormalParamsInputSchema,
    expected: Schema.Finite
  }),
  // LogNormal (7)
  Schema.Struct({
    id: Schema.String,
    operation: Schema.Literal("logNormalPdf"),
    input: DistLogNormalEvalInputSchema,
    expected: Schema.Finite
  }),
  Schema.Struct({
    id: Schema.String,
    operation: Schema.Literal("logNormalLogpdf"),
    input: DistLogNormalEvalInputSchema,
    expected: Schema.Finite
  }),
  Schema.Struct({
    id: Schema.String,
    operation: Schema.Literal("logNormalCdf"),
    input: DistLogNormalEvalInputSchema,
    expected: Schema.Finite
  }),
  Schema.Struct({
    id: Schema.String,
    operation: Schema.Literal("logNormalQuantile"),
    input: DistLogNormalQuantileInputSchema,
    expected: Schema.Finite
  }),
  Schema.Struct({
    id: Schema.String,
    operation: Schema.Literal("logNormalMean"),
    input: DistLogNormalParamsInputSchema,
    expected: Schema.Finite
  }),
  Schema.Struct({
    id: Schema.String,
    operation: Schema.Literal("logNormalVariance"),
    input: DistLogNormalParamsInputSchema,
    expected: Schema.Finite
  }),
  Schema.Struct({
    id: Schema.String,
    operation: Schema.Literal("logNormalEntropy"),
    input: DistLogNormalParamsInputSchema,
    expected: Schema.Finite
  }),
  // Exponential (7)
  Schema.Struct({
    id: Schema.String,
    operation: Schema.Literal("exponentialPdf"),
    input: DistExponentialEvalInputSchema,
    expected: Schema.Finite
  }),
  Schema.Struct({
    id: Schema.String,
    operation: Schema.Literal("exponentialLogpdf"),
    input: DistExponentialEvalInputSchema,
    expected: Schema.Finite
  }),
  Schema.Struct({
    id: Schema.String,
    operation: Schema.Literal("exponentialCdf"),
    input: DistExponentialEvalInputSchema,
    expected: Schema.Finite
  }),
  Schema.Struct({
    id: Schema.String,
    operation: Schema.Literal("exponentialQuantile"),
    input: DistExponentialQuantileInputSchema,
    expected: Schema.Finite
  }),
  Schema.Struct({
    id: Schema.String,
    operation: Schema.Literal("exponentialMean"),
    input: DistExponentialParamsInputSchema,
    expected: Schema.Finite
  }),
  Schema.Struct({
    id: Schema.String,
    operation: Schema.Literal("exponentialVariance"),
    input: DistExponentialParamsInputSchema,
    expected: Schema.Finite
  }),
  Schema.Struct({
    id: Schema.String,
    operation: Schema.Literal("exponentialEntropy"),
    input: DistExponentialParamsInputSchema,
    expected: Schema.Finite
  }),
  // Uniform (7)
  Schema.Struct({
    id: Schema.String,
    operation: Schema.Literal("uniformPdf"),
    input: DistUniformEvalInputSchema,
    expected: Schema.Finite
  }),
  Schema.Struct({
    id: Schema.String,
    operation: Schema.Literal("uniformLogpdf"),
    input: DistUniformEvalInputSchema,
    expected: Schema.Finite
  }),
  Schema.Struct({
    id: Schema.String,
    operation: Schema.Literal("uniformCdf"),
    input: DistUniformEvalInputSchema,
    expected: Schema.Finite
  }),
  Schema.Struct({
    id: Schema.String,
    operation: Schema.Literal("uniformQuantile"),
    input: DistUniformQuantileInputSchema,
    expected: Schema.Finite
  }),
  Schema.Struct({
    id: Schema.String,
    operation: Schema.Literal("uniformMean"),
    input: DistUniformParamsInputSchema,
    expected: Schema.Finite
  }),
  Schema.Struct({
    id: Schema.String,
    operation: Schema.Literal("uniformVariance"),
    input: DistUniformParamsInputSchema,
    expected: Schema.Finite
  }),
  Schema.Struct({
    id: Schema.String,
    operation: Schema.Literal("uniformEntropy"),
    input: DistUniformParamsInputSchema,
    expected: Schema.Finite
  }),
  // Beta (7)
  Schema.Struct({
    id: Schema.String,
    operation: Schema.Literal("betaPdf"),
    input: DistBetaEvalInputSchema,
    expected: Schema.Finite
  }),
  Schema.Struct({
    id: Schema.String,
    operation: Schema.Literal("betaLogpdf"),
    input: DistBetaEvalInputSchema,
    expected: Schema.Finite
  }),
  Schema.Struct({
    id: Schema.String,
    operation: Schema.Literal("betaCdf"),
    input: DistBetaEvalInputSchema,
    expected: Schema.Finite
  }),
  Schema.Struct({
    id: Schema.String,
    operation: Schema.Literal("betaQuantile"),
    input: DistBetaQuantileInputSchema,
    expected: Schema.Finite
  }),
  Schema.Struct({
    id: Schema.String,
    operation: Schema.Literal("betaMean"),
    input: DistBetaParamsInputSchema,
    expected: Schema.Finite
  }),
  Schema.Struct({
    id: Schema.String,
    operation: Schema.Literal("betaVariance"),
    input: DistBetaParamsInputSchema,
    expected: Schema.Finite
  }),
  Schema.Struct({
    id: Schema.String,
    operation: Schema.Literal("betaEntropy"),
    input: DistBetaParamsInputSchema,
    expected: Schema.Finite
  }),
  // Gamma (7)
  Schema.Struct({
    id: Schema.String,
    operation: Schema.Literal("gammaPdf"),
    input: DistGammaEvalInputSchema,
    expected: Schema.Finite
  }),
  Schema.Struct({
    id: Schema.String,
    operation: Schema.Literal("gammaLogpdf"),
    input: DistGammaEvalInputSchema,
    expected: Schema.Finite
  }),
  Schema.Struct({
    id: Schema.String,
    operation: Schema.Literal("gammaCdf"),
    input: DistGammaEvalInputSchema,
    expected: Schema.Finite
  }),
  Schema.Struct({
    id: Schema.String,
    operation: Schema.Literal("gammaQuantile"),
    input: DistGammaQuantileInputSchema,
    expected: Schema.Finite
  }),
  Schema.Struct({
    id: Schema.String,
    operation: Schema.Literal("gammaMean"),
    input: DistGammaParamsInputSchema,
    expected: Schema.Finite
  }),
  Schema.Struct({
    id: Schema.String,
    operation: Schema.Literal("gammaVariance"),
    input: DistGammaParamsInputSchema,
    expected: Schema.Finite
  }),
  Schema.Struct({
    id: Schema.String,
    operation: Schema.Literal("gammaEntropy"),
    input: DistGammaParamsInputSchema,
    expected: Schema.Finite
  }),
  // StudentT (6)
  Schema.Struct({
    id: Schema.String,
    operation: Schema.Literal("studentTPdf"),
    input: DistStudentTEvalInputSchema,
    expected: Schema.Finite
  }),
  Schema.Struct({
    id: Schema.String,
    operation: Schema.Literal("studentTLogpdf"),
    input: DistStudentTEvalInputSchema,
    expected: Schema.Finite
  }),
  Schema.Struct({
    id: Schema.String,
    operation: Schema.Literal("studentTCdf"),
    input: DistStudentTEvalInputSchema,
    expected: Schema.Finite
  }),
  Schema.Struct({
    id: Schema.String,
    operation: Schema.Literal("studentTQuantile"),
    input: DistStudentTQuantileInputSchema,
    expected: Schema.Finite
  }),
  Schema.Struct({
    id: Schema.String,
    operation: Schema.Literal("studentTMean"),
    input: DistStudentTParamsInputSchema,
    expected: Schema.Finite
  }),
  Schema.Struct({
    id: Schema.String,
    operation: Schema.Literal("studentTVariance"),
    input: DistStudentTParamsInputSchema,
    expected: Schema.Finite
  }),
  // Categorical (6)
  Schema.Struct({
    id: Schema.String,
    operation: Schema.Literal("categoricalPmf"),
    input: DistCategoricalEvalInputSchema,
    expected: Schema.Finite
  }),
  Schema.Struct({
    id: Schema.String,
    operation: Schema.Literal("categoricalLogpmf"),
    input: DistCategoricalEvalInputSchema,
    expected: Schema.Finite
  }),
  Schema.Struct({
    id: Schema.String,
    operation: Schema.Literal("categoricalCdf"),
    input: DistCategoricalEvalInputSchema,
    expected: Schema.Finite
  }),
  Schema.Struct({
    id: Schema.String,
    operation: Schema.Literal("categoricalMean"),
    input: DistCategoricalParamsInputSchema,
    expected: Schema.Finite
  }),
  Schema.Struct({
    id: Schema.String,
    operation: Schema.Literal("categoricalVariance"),
    input: DistCategoricalParamsInputSchema,
    expected: Schema.Finite
  }),
  Schema.Struct({
    id: Schema.String,
    operation: Schema.Literal("categoricalEntropy"),
    input: DistCategoricalParamsInputSchema,
    expected: Schema.Finite
  }),
  // Binomial (5)
  Schema.Struct({
    id: Schema.String,
    operation: Schema.Literal("binomialPmf"),
    input: DistBinomialEvalInputSchema,
    expected: Schema.Finite
  }),
  Schema.Struct({
    id: Schema.String,
    operation: Schema.Literal("binomialLogpmf"),
    input: DistBinomialEvalInputSchema,
    expected: Schema.Finite
  }),
  Schema.Struct({
    id: Schema.String,
    operation: Schema.Literal("binomialCdf"),
    input: DistBinomialEvalInputSchema,
    expected: Schema.Finite
  }),
  Schema.Struct({
    id: Schema.String,
    operation: Schema.Literal("binomialMean"),
    input: DistBinomialParamsInputSchema,
    expected: Schema.Finite
  }),
  Schema.Struct({
    id: Schema.String,
    operation: Schema.Literal("binomialVariance"),
    input: DistBinomialParamsInputSchema,
    expected: Schema.Finite
  }),
  // Poisson (5)
  Schema.Struct({
    id: Schema.String,
    operation: Schema.Literal("poissonPmf"),
    input: DistPoissonEvalInputSchema,
    expected: Schema.Finite
  }),
  Schema.Struct({
    id: Schema.String,
    operation: Schema.Literal("poissonLogpmf"),
    input: DistPoissonEvalInputSchema,
    expected: Schema.Finite
  }),
  Schema.Struct({
    id: Schema.String,
    operation: Schema.Literal("poissonCdf"),
    input: DistPoissonEvalInputSchema,
    expected: Schema.Finite
  }),
  Schema.Struct({
    id: Schema.String,
    operation: Schema.Literal("poissonMean"),
    input: DistPoissonParamsInputSchema,
    expected: Schema.Finite
  }),
  Schema.Struct({
    id: Schema.String,
    operation: Schema.Literal("poissonVariance"),
    input: DistPoissonParamsInputSchema,
    expected: Schema.Finite
  })
])

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

export const KnownFixtureSchema = Schema.Union([
  CPythonRandomFixture,
  NumPyRandomFixture,
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
])

export const FixtureNameSchema = Schema.Union(Array.map(KnownFixtureSchema.members, (schema) => schema.fields.fixture))

export type FixtureName = Schema.Schema.Type<typeof FixtureNameSchema>

export type KnownFixture = Schema.Schema.Type<typeof KnownFixtureSchema>

// ---------------------------------------------------------------------------
// Manifest
// ---------------------------------------------------------------------------

export const FixtureManifestEntrySchema = Schema.Struct({
  name: FixtureNameSchema,
  file: Schema.String
})

export const FixtureManifestSchema = Schema.Struct({
  generator: Schema.Struct({
    script: Schema.String,
    upstream: Schema.String,
    upstreamVersion: Schema.String,
    numpyVersion: Schema.String,
    pythonVersion: Schema.String,
    generatedAt: Schema.String
  }),
  fixtures: Schema.Array(FixtureManifestEntrySchema)
})

export type FixtureManifest = Schema.Schema.Type<typeof FixtureManifestSchema>
