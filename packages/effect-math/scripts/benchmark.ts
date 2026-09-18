/**
 * Measure public math operations with fixed inputs and consumed results.
 * Run without concurrent CPU workloads:
 * `bun run packages/effect-math/scripts/benchmark.ts > /tmp/math-benchmark.json`
 * MATH_BENCHMARK_FILTER selects a case-insensitive substring of the case name.
 * MATH_BENCHMARK_ITERATIONS, MATH_BENCHMARK_WARMUPS, and MATH_BENCHMARK_SAMPLES
 * control the run. Timings include traversal and checksum overhead; no estimated
 * overhead is subtracted. Numerical correctness belongs to the fixture tests.
 */
import { BunRuntime } from "@effect/platform-bun"
import * as Algebra from "@scenesystems/effect-math/Algebra"
import * as Calculus from "@scenesystems/effect-math/Calculus"
import * as Complex from "@scenesystems/effect-math/Complex"
import * as Distribution from "@scenesystems/effect-math/Distribution"
import * as Geometry from "@scenesystems/effect-math/Geometry"
import * as LinearAlgebra from "@scenesystems/effect-math/LinearAlgebra"
import * as Numeric from "@scenesystems/effect-math/Numeric"
import * as Optimization from "@scenesystems/effect-math/Optimization"
import * as Policy from "@scenesystems/effect-math/Policy"
import * as Special from "@scenesystems/effect-math/Special"
import * as Statistics from "@scenesystems/effect-math/Statistics"
import {
  Array,
  BigInt,
  Boolean,
  Chunk,
  Clock,
  Config,
  Console,
  Data,
  Effect,
  HashSet,
  Number,
  Option,
  Schema,
  String
} from "effect"

const PositiveInteger = Schema.Number.pipe(Schema.int(), Schema.greaterThanOrEqualTo(1))
const BenchmarkConfig = Schema.Struct({
  filter: Schema.String,
  iterations: PositiveInteger,
  warmups: PositiveInteger.pipe(Schema.greaterThanOrEqualTo(2)),
  samples: PositiveInteger.pipe(
    Schema.greaterThanOrEqualTo(5),
    Schema.filter((value) => Number.Equivalence(Number.remainder(value, 2), 1), {
      message: () => "MATH_BENCHMARK_SAMPLES must be odd so the median is an observed sample"
    })
  )
})

const BenchmarkReport = Schema.Struct({
  config: BenchmarkConfig,
  results: Schema.Array(Schema.Struct({
    name: Schema.String,
    operationCount: PositiveInteger,
    medianElapsedNanos: Schema.Number,
    nanosecondsPerOperation: Schema.Number,
    checksum: Schema.Number
  }))
})

class BenchmarkCase extends Data.Class<{
  readonly name: string
  readonly operationsPerIteration: number
  readonly evaluate: (iterations: number) => Effect.Effect<number, BenchmarkError>
}> {}

class BenchmarkError extends Data.TaggedError("BenchmarkError")<{
  readonly message: string
}> {}

const repeat = (iterations: number, evaluate: () => number): number =>
  Chunk.reduce(Chunk.range(1, iterations), 0, (checksum) => Number.sum(checksum, evaluate()))

const consume = (values: Chunk.Chunk<number>): number => Number.sumAll(values)

const unaryCase = (
  name: string,
  values: Chunk.Chunk<number>,
  operation: (value: number) => number
): BenchmarkCase => {
  const evaluateBatch = () => Chunk.reduce(values, 0, (checksum, value) => Number.sum(checksum, operation(value)))
  return new BenchmarkCase({
    name,
    operationsPerIteration: Chunk.size(values),
    evaluate: (iterations) => Effect.sync(() => repeat(iterations, evaluateBatch))
  })
}

const binaryCase = (
  name: string,
  left: Chunk.Chunk<number>,
  right: Chunk.Chunk<number>,
  operation: (left: number, right: number) => number
): BenchmarkCase => {
  const evaluateBatch = () => consume(Chunk.zipWith(left, right, operation))
  return new BenchmarkCase({
    name,
    operationsPerIteration: Number.min(Chunk.size(left), Chunk.size(right)),
    evaluate: (iterations) => Effect.sync(() => repeat(iterations, evaluateBatch))
  })
}

const singleCallCase = (name: string, evaluate: () => number): BenchmarkCase =>
  new BenchmarkCase({
    name,
    operationsPerIteration: 1,
    evaluate: (iterations) => Effect.sync(() => repeat(iterations, evaluate))
  })

const effectCase = <E>(
  name: string,
  evaluate: Effect.Effect<number, E, Policy.Precision | Policy.Diagnostics | Policy.Backend>
): BenchmarkCase =>
  new BenchmarkCase({
    name,
    operationsPerIteration: 1,
    evaluate: (iterations) =>
      Effect.reduce(
        Chunk.range(1, iterations),
        0,
        (checksum) => Effect.map(evaluate, (value) => Number.sum(checksum, value))
      ).pipe(
        Effect.provide(policyLayer),
        Effect.mapError(() => new BenchmarkError({ message: `${name}: operation failed` }))
      )
  })

const ordinary = Chunk.make(-7.75, -2.5, -0.125, 0.25, 1.5, 3.75, 11.125, 31.5)
const positive = Chunk.make(0.03125, 0.125, 0.5, 0.875, 1.25, 2.5, 11.75, 97.5)
const extremePositive = Chunk.make(2.2250738585072014e-308, 1e-200, 1e200, 1e300)
const tiny = Chunk.make(-1e-12, -1e-16, 1e-16, 1e-12, 1e-8, 1e-5)
const trigOrdinary = Chunk.make(-6.25, -3.125, -0.75, 0.125, 1.25, 3.5, 6.125)
const trigLargeAngle = Chunk.make(-1e12, -1e8, -1e6, 1_000_000.25, 100_000_000.5, 1_000_000_000_000.75)
const moderate = Chunk.make(-5, -2.5, -0.5, 0.125, 1.5, 3.25, 5)
const inverseErrorInputs = Chunk.make(-0.999, -0.8, -0.4, 0.125, 0.55, 0.9, 0.99)
const probabilities = Chunk.make(0.0001, 0.005, 0.05, 0.25, 0.625, 0.9, 0.999)
const powers = Chunk.make(0.5, 1.25, 2.5, 10, 31.5, 100)
const exponents = Chunk.make(-3, -0.5, 0.25, 1.5, 2.25, 3)
const atanY = Chunk.make(-5, -2, -0.25, 0.25, 2, 5)
const atanX = Chunk.make(3, -3, 0.5, -0.5, 4, -4)
const logLeft = Chunk.make(-1000, -100, -10, -1, 1, 10, 100, 1000)
const logRight = Chunk.make(-1001, -99, -11, -0.5, 0.5, 9, 101, 999)
const logSubLeft = Chunk.make(-999, -98, -9, 0, 2, 11, 102, 1001)
const sumValues = Chunk.make(-1000, 0.125, 2.5, 7.75, 100, -3.25, 1e-8, 1e6, -999_000)
const polynomialCoefficients = Chunk.make(1.25, -2.5, 3.75, -4.5, 2.125, -0.75, 0.125)
const largePolynomialCoefficients = Chunk.map(
  Chunk.range(1, 4096),
  (coefficient) => Number.unsafeDivide(coefficient, 4096)
)

const vectorA = Chunk.make(1.25, -2.5, 3.75, 4.5, -5.25, 6.125, 7.75, -8.5)
const vectorB = Chunk.make(-0.5, 1.75, 2.25, -3.5, 4.125, -5.75, 6.5, 7.25)
const matrix = Chunk.make(4, 1, 0, 0, 1, 4, 1, 0, 0, 1, 4, 1, 0, 0, 1, 3)
const rectangularMatrix = Chunk.make(1.25, -2.5, 3.75, 4.5, -5.25, 6.125, 7.75, -8.5, 9.25, 10.5, -11.75, 12.125)
const lowerTriangularMatrix = Chunk.make(2, 0, 0, 0, -1, 3, 0, 0, 4, 0.5, -2, 0, 1.25, -3, 2, 5)
const upperTriangularMatrix = Chunk.make(-2, 1.5, 0.25, -3, 0, 4, -1, 2, 0, 0, 3, 0.75, 0, 0, 0, -5)
const matrixVector = Chunk.make(1.25, -0.75, 2.5, 0.5)
const matrixRhs = Chunk.make(2, 1, 4, 3)
const mediumMatrixSize = 16
const mediumMatrixIndices = Chunk.range(0, Number.decrement(mediumMatrixSize))
const mediumMatrix = Chunk.flatMap(
  mediumMatrixIndices,
  (row) =>
    Chunk.map(mediumMatrixIndices, (column) =>
      Boolean.match(Number.Equivalence(row, column), {
        onFalse: () => Number.unsafeDivide(1, Number.increment(Numeric.abs(Number.subtract(row, column)))),
        onTrue: () => Number.sum(mediumMatrixSize, row)
      }))
)
const mediumMatrixVector = Chunk.map(
  mediumMatrixIndices,
  (index) => Number.unsafeDivide(Number.increment(index), mediumMatrixSize)
)
const points = Chunk.make(
  Chunk.make(1.25, -2.5, 3.75, 0.5),
  Chunk.make(-4.5, 2.25, 1.5, 3.25),
  Chunk.make(2.75, 4.5, -3.25, 1.125),
  Chunk.make(5.25, -1.75, 2.5, -4.125)
)
const complexLeft = new Complex.Complex({ re: 1.25, im: -2.5 })
const complexRight = new Complex.Complex({ re: -0.75, im: 1.125 })
const statisticValues = Chunk.make(1.25, 1.75, 2.5, 3.125, 5.5, 8.25, 13.75, 21.125, 34.5)
const covarianceValues = Chunk.make(-4.5, 7.25, 3.125, -2.75, 11.5, 0.625, 19.25, -8.125, 5.75)
const erfcUpperTail = Chunk.make(-1.25, 0, 0.5, 1.75, 3.5, 8)
const argmaxValues = Chunk.make(-4.5, 11.25, 3.125, -2.75, 8.5, 29.625, 19.25, -8.125)
const argmaxValueSet = HashSet.make(-4.5, 11.25, 3.125, -2.75, 8.5, 29.625, 19.25, -8.125)
const sampledCurve = Chunk.make(0, 0.015625, 0.0625, 0.140625, 0.25, 0.390625, 0.5625, 0.765625, 1)
const calculusPoint = Chunk.make(-1.25, 0.5, 2.75)

const scalarObjective = (value: number): number =>
  Number.multiply(Number.subtract(value, 1.75), Number.subtract(value, 1.75))
const rootObjective = (value: number): number => Number.subtract(Number.multiply(value, value), 2)
const multivariateObjective = (point: Chunk.Chunk<number>): number =>
  Number.sumAll(Chunk.map(point, (value) => Number.multiply(value, value)))
const policyLayer = Policy.layerDeterministic({
  seed: Policy.Seed.make(42),
  precision: "strict",
  backend: "scalar",
  diagnostics: "disabled"
})

const cases = Chunk.make(
  unaryCase("Numeric.abs ordinary", ordinary, Numeric.abs),
  unaryCase("Numeric.floor ordinary", ordinary, Numeric.floor),
  unaryCase("Numeric.ceil ordinary", ordinary, Numeric.ceil),
  unaryCase("Numeric.truncate ordinary", ordinary, Numeric.truncate),
  unaryCase("Numeric.sqrt ordinary", positive, Numeric.sqrt),
  unaryCase("Numeric.sqrt extreme", extremePositive, Numeric.sqrt),
  singleCallCase("Numeric.hypot extreme", () => Numeric.hypot(extremePositive)),
  unaryCase("Numeric.log ordinary", positive, Numeric.log),
  unaryCase("Numeric.log extreme", extremePositive, Numeric.log),
  unaryCase("Numeric.logStrict ordinary", positive, Numeric.logStrict),
  unaryCase("Numeric.logStrict extreme", extremePositive, Numeric.logStrict),
  unaryCase("Numeric.log1pStrict tiny", tiny, Numeric.log1pStrict),
  unaryCase("Numeric.expm1Strict tiny", tiny, Numeric.expm1Strict),
  unaryCase("Numeric.exp ordinary", moderate, Numeric.exp),
  unaryCase("Numeric.log10 ordinary", positive, Numeric.log10),
  binaryCase("Numeric.pow ordinary", powers, exponents, Numeric.pow),
  unaryCase("Numeric.sin ordinary", trigOrdinary, Numeric.sin),
  unaryCase("Numeric.sin trig large-angle", trigLargeAngle, Numeric.sin),
  unaryCase("Numeric.cos ordinary", trigOrdinary, Numeric.cos),
  unaryCase("Numeric.cos trig large-angle", trigLargeAngle, Numeric.cos),
  binaryCase("Numeric.atan2 ordinary", atanY, atanX, Numeric.atan2),
  unaryCase("Numeric.sinh ordinary", moderate, Numeric.sinh),
  unaryCase("Numeric.cosh ordinary", moderate, Numeric.cosh),
  singleCallCase("Numeric.sum reduction", () => Numeric.sum(sumValues)),
  binaryCase("Numeric.logaddexp log-space", logLeft, logRight, Numeric.logaddexp),
  binaryCase("Numeric.logsubexp log-space", logSubLeft, logRight, Numeric.logsubexp),
  unaryCase("Numeric.log1mexp log-space", Chunk.make(-100, -10, -2, -1, -0.5, -0.01), Numeric.log1mexp),
  unaryCase("Numeric.log1pexp log-space", logLeft, Numeric.log1pexp),
  binaryCase("Numeric.xlogy log-space", ordinary, positive, Numeric.xlogy),
  binaryCase("Numeric.xlog1py tiny", ordinary, tiny, Numeric.xlog1py),
  singleCallCase("Numeric.logSumExp reduction", () => Numeric.logSumExp(logLeft)),
  singleCallCase("Numeric.argmaxIndex Chunk", () => Option.getOrElse(Numeric.argmaxIndex(argmaxValues), () => 0)),
  singleCallCase(
    "Numeric.argmaxIndex one-shot iterable",
    () => Option.getOrElse(Numeric.argmaxIndex(HashSet.values(argmaxValueSet)), () => 0)
  ),
  singleCallCase("Algebra.polyEval ordinary coefficients", () => Algebra.polyEval(polynomialCoefficients, 1.25)),
  singleCallCase(
    "Algebra.polyEval 4096 coefficients",
    () => Algebra.polyEval(largePolynomialCoefficients, 0.875)
  ),
  effectCase(
    "Algebra.polyEvalWithPolicies ordinary coefficients",
    Algebra.polyEvalWithPolicies(polynomialCoefficients, 1.25)
  ),
  singleCallCase("Geometry.euclideanDistance vector", () => Geometry.euclideanDistance(vectorA, vectorB)),
  singleCallCase("Geometry.squaredEuclideanDistance vector", () => Geometry.squaredEuclideanDistance(vectorA, vectorB)),
  singleCallCase("Geometry.manhattanDistance vector", () => Geometry.manhattanDistance(vectorA, vectorB)),
  singleCallCase("Geometry.chebyshevDistance vector", () => Geometry.chebyshevDistance(vectorA, vectorB)),
  singleCallCase("Geometry.midpoint vector", () => consume(Geometry.midpoint(vectorA, vectorB))),
  singleCallCase("Geometry.centroid points", () => consume(Geometry.centroid(points))),
  singleCallCase("LinearAlgebra.dot vector", () => LinearAlgebra.dot(vectorA, vectorB)),
  singleCallCase("LinearAlgebra.matvec matrix", () => consume(LinearAlgebra.matvec(matrix, 4, 4, matrixVector))),
  singleCallCase(
    "LinearAlgebra.transpose rectangular",
    () => consume(LinearAlgebra.transpose(rectangularMatrix, 3, 4))
  ),
  singleCallCase("LinearAlgebra.frobeniusNorm rectangular", () => LinearAlgebra.frobeniusNorm(rectangularMatrix, 3, 4)),
  singleCallCase(
    "LinearAlgebra.cholesky matrix",
    () => Option.match(LinearAlgebra.cholesky(matrix, 4), { onNone: () => 0, onSome: consume })
  ),
  singleCallCase(
    "LinearAlgebra.forwardSubstitutionLower triangular",
    () =>
      Option.match(LinearAlgebra.forwardSubstitutionLower(lowerTriangularMatrix, 4, matrixRhs), {
        onNone: () => 0,
        onSome: consume
      })
  ),
  singleCallCase(
    "LinearAlgebra.backwardSubstitutionUpper triangular",
    () =>
      Option.match(LinearAlgebra.backwardSubstitutionUpper(upperTriangularMatrix, 4, matrixRhs), {
        onNone: () => 0,
        onSome: consume
      })
  ),
  singleCallCase(
    "LinearAlgebra.solveSpd matrix",
    () => Option.match(LinearAlgebra.solveSpd(matrix, 4, matrixRhs), { onNone: () => 0, onSome: consume })
  ),
  singleCallCase(
    "LinearAlgebra.matvec 16x16 matrix",
    () => consume(LinearAlgebra.matvec(mediumMatrix, mediumMatrixSize, mediumMatrixSize, mediumMatrixVector))
  ),
  singleCallCase(
    "LinearAlgebra.transpose 16x16 matrix",
    () => consume(LinearAlgebra.transpose(mediumMatrix, mediumMatrixSize, mediumMatrixSize))
  ),
  singleCallCase(
    "LinearAlgebra.cholesky 16x16 matrix",
    () => Option.match(LinearAlgebra.cholesky(mediumMatrix, mediumMatrixSize), { onNone: () => 0, onSome: consume })
  ),
  singleCallCase(
    "LinearAlgebra.solveSpd 16x16 matrix",
    () =>
      Option.match(LinearAlgebra.solveSpd(mediumMatrix, mediumMatrixSize, mediumMatrixVector), {
        onNone: () => 0,
        onSome: consume
      })
  ),
  singleCallCase("Complex.multiply ordinary", () => {
    const value = Complex.multiply(complexLeft, complexRight)
    return Number.sum(value.re, value.im)
  }),
  singleCallCase("Complex.exp ordinary", () => {
    const value = Complex.exp(complexLeft)
    return Number.sum(value.re, value.im)
  }),
  singleCallCase("Complex.sqrt ordinary", () => {
    const value = Complex.sqrt(complexLeft)
    return Number.sum(value.re, value.im)
  }),
  unaryCase("Special.gamma ordinary", positive, Special.gamma),
  unaryCase("Special.erf ordinary", moderate, Special.erf),
  unaryCase("Special.erfc upper-tail", erfcUpperTail, Special.erfc),
  unaryCase("Special.erfinv ordinary", inverseErrorInputs, Special.erfinv),
  unaryCase("Special.erfcinv ordinary", probabilities, Special.erfcinv),
  singleCallCase("Special.gammainc ordinary", () => Special.gammainc(3.75, 2.25)),
  unaryCase("Distribution.normalCdf ordinary", moderate, (value) => Distribution.normalCdf(value, 0.5, 1.75)),
  unaryCase(
    "Distribution.normalQuantile ordinary",
    probabilities,
    (value) => Distribution.normalQuantile(value, 0.5, 1.75)
  ),
  singleCallCase("Distribution.betaCdf ordinary", () => Distribution.betaCdf(0.375, 2.5, 4.25)),
  singleCallCase("Distribution.betaCdf reflected", () => Distribution.betaCdf(0.875, 2.5, 4.25)),
  singleCallCase("Distribution.betaPdf ordinary", () => Distribution.betaPdf(0.375, 2.5, 4.25)),
  unaryCase("Distribution.betaQuantile uniform", probabilities, (value) => Distribution.betaQuantile(value, 1, 1)),
  singleCallCase("Distribution.betaQuantile ordinary", () => Distribution.betaQuantile(0.375, 2.5, 4.25)),
  singleCallCase("Distribution.betaQuantile lower-tail", () => Distribution.betaQuantile(1e-12, 0.25, 7)),
  singleCallCase("Distribution.betaQuantile upper-tail", () => Distribution.betaQuantile(0.999999, 2, 40)),
  singleCallCase("Distribution.gammaCdf series", () => Distribution.gammaCdf(2, 3.75, 1.25)),
  singleCallCase("Distribution.gammaCdf fraction", () => Distribution.gammaCdf(15, 3.75, 1.25)),
  singleCallCase("Distribution.gammaPdf ordinary", () => Distribution.gammaPdf(2, 3.75, 1.25)),
  unaryCase(
    "Distribution.gammaQuantile exponential",
    probabilities,
    (value) => Distribution.gammaQuantile(value, 1, 3)
  ),
  singleCallCase("Distribution.gammaQuantile ordinary", () => Distribution.gammaQuantile(0.375, 3.75, 1.25)),
  singleCallCase("Distribution.gammaQuantile lower-tail", () => Distribution.gammaQuantile(1e-9, 100, 1)),
  singleCallCase("Distribution.gammaQuantile upper-tail", () => Distribution.gammaQuantile(0.999999, 2, 3)),
  singleCallCase("Distribution.poissonCdf ordinary", () => Distribution.poissonCdf(7, 4.25)),
  singleCallCase("Statistics.variance reduction", () => Statistics.variance(statisticValues)),
  singleCallCase("Statistics.mean reduction", () => Statistics.mean(statisticValues)),
  singleCallCase("Statistics.covariance paired", () => Statistics.covariance(statisticValues, covarianceValues)),
  singleCallCase("Statistics.summaryStatistics reduction", () => {
    const summary = Statistics.summaryStatistics(statisticValues)
    return Number.sum(summary.mean, Number.sum(summary.variance, summary.standardDeviation))
  }),
  singleCallCase("Calculus.derivative callback", () => Calculus.derivative(scalarObjective, 2.25)),
  singleCallCase("Calculus.secondDerivative callback", () => Calculus.secondDerivative(scalarObjective, 2.25)),
  singleCallCase("Calculus.gradient callback", () => consume(Calculus.gradient(multivariateObjective, calculusPoint))),
  singleCallCase(
    "Calculus.hessian callback",
    () => consume(Chunk.flatten(Calculus.hessian(multivariateObjective, calculusPoint)))
  ),
  singleCallCase("Calculus.simpson reduction", () => Calculus.simpson(sampledCurve, 0.125)),
  singleCallCase(
    "Calculus.adaptiveSimpson callback",
    () => Calculus.adaptiveSimpson(scalarObjective, -2, 4, 1e-8, 1e-8, 12)
  ),
  effectCase(
    "Calculus.derivativeWithPolicies callback",
    Calculus.derivativeWithPolicies(scalarObjective, 2.25)
  ),
  singleCallCase("Optimization.bisect callback", () => Optimization.bisect(rootObjective, 0, 2, 1e-10, 64)),
  singleCallCase(
    "Optimization.goldenSection callback",
    () => Optimization.goldenSection(scalarObjective, -3, 5, 1e-10, 64)
  )
)

const measure = (benchmark: BenchmarkCase, config: typeof BenchmarkConfig.Type) =>
  Effect.gen(function*() {
    yield* Effect.replicateEffect(benchmark.evaluate(config.iterations), config.warmups, {
      discard: true
    })
    const samples = yield* Effect.replicateEffect(
      Effect.gen(function*() {
        const started = yield* Clock.currentTimeNanos
        const checksum = yield* benchmark.evaluate(config.iterations)
        const finished = yield* Clock.currentTimeNanos
        const elapsedNanos = yield* BigInt.toNumber(BigInt.subtract(finished, started))
        yield* Effect.succeed(checksum).pipe(
          Effect.filterOrFail(Numeric.isFinite, () =>
            new BenchmarkError({ message: `${benchmark.name}: nonfinite result` }))
        )
        return { elapsedNanos, checksum }
      }),
      config.samples
    )
    const ordered = Array.sort(
      Array.map(samples, (sample) =>
        sample.elapsedNanos),
      Number.Order
    )
    const medianElapsedNanos = yield* Array.get(ordered, Number.unsafeDivide(Number.decrement(config.samples), 2))
    const operationCount = Number.multiply(config.iterations, benchmark.operationsPerIteration)
    return {
      name: benchmark.name,
      operationCount,
      medianElapsedNanos,
      nanosecondsPerOperation: Number.unsafeDivide(medianElapsedNanos, operationCount),
      checksum: Number.sumAll(Array.map(samples, (sample) => sample.checksum))
    }
  })

BunRuntime.runMain(Effect.gen(function*() {
  const filter = yield* Config.string("MATH_BENCHMARK_FILTER").pipe(Config.withDefault(""))
  const iterations = yield* Config.integer("MATH_BENCHMARK_ITERATIONS").pipe(Config.withDefault(500))
  const warmups = yield* Config.integer("MATH_BENCHMARK_WARMUPS").pipe(Config.withDefault(5))
  const samples = yield* Config.integer("MATH_BENCHMARK_SAMPLES").pipe(Config.withDefault(7))
  const config = yield* Schema.decodeUnknown(BenchmarkConfig)({ filter, iterations, warmups, samples }, {
    onExcessProperty: "error"
  })
  const selected = yield* Effect.succeed(
    Chunk.filter(cases, (benchmark) => String.includes(String.toLowerCase(filter))(String.toLowerCase(benchmark.name)))
  ).pipe(Effect.filterOrFail(Chunk.isNonEmpty, () => new BenchmarkError({ message: `No benchmark matches ${filter}` })))
  const results = yield* Effect.forEach(selected, (benchmark) => measure(benchmark, config))
  yield* Console.log(yield* Schema.encode(Schema.parseJson(BenchmarkReport, { space: 2 }))({ config, results }))
}))
