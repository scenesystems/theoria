/**
 * Durable public-API benchmark for comparing effect-math revisions.
 *
 * Run with `bun run packages/effect-math/scripts/benchmark.ts`. Configuration
 * is read from `MATH_BENCHMARK_REVISION`, `MATH_BENCHMARK_FILTER`,
 * `MATH_BENCHMARK_ITERATIONS`, `MATH_BENCHMARK_WARMUPS`,
 * `MATH_BENCHMARK_SAMPLES`, and `MATH_BENCHMARK_OUTPUT`. The filter is a
 * case-insensitive substring matched against case name, family, and
 * compatibility (`shared` or `pr117`). Use `shared` when running this file
 * against a revision that predates the PR117-only Numeric exports.
 */
import { Command, FileSystem } from "@effect/platform"
import { BunContext, BunRuntime } from "@effect/platform-bun"
import * as Calculus from "@scenesystems/effect-math/Calculus"
import * as Complex from "@scenesystems/effect-math/Complex"
import * as Distribution from "@scenesystems/effect-math/Distribution"
import * as Geometry from "@scenesystems/effect-math/Geometry"
import * as LinearAlgebra from "@scenesystems/effect-math/LinearAlgebra"
import * as Numeric from "@scenesystems/effect-math/Numeric"
import * as Optimization from "@scenesystems/effect-math/Optimization"
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
const WarmupCount = PositiveInteger.pipe(Schema.greaterThanOrEqualTo(2))
const SampleCount = PositiveInteger.pipe(
  Schema.greaterThanOrEqualTo(5),
  Schema.filter((value) => Number.Equivalence(Number.remainder(value, 2), 1), {
    message: () => "MATH_BENCHMARK_SAMPLES must be odd so the median is an observed sample"
  })
)

const BenchmarkConfig = Schema.Struct({
  revision: Schema.NonEmptyString,
  filter: Schema.String,
  iterations: PositiveInteger,
  warmups: WarmupCount,
  samples: SampleCount,
  outputPath: Schema.String
})

const BenchmarkResult = Schema.Struct({
  name: Schema.String,
  family: Schema.String,
  compatibility: Schema.Literal("shared", "pr117"),
  iterations: PositiveInteger,
  operationsPerIteration: PositiveInteger,
  operationCount: PositiveInteger,
  warmups: WarmupCount,
  samples: SampleCount,
  medianElapsedNanos: Schema.Number.pipe(Schema.nonNegative()),
  medianControlNanos: Schema.Number.pipe(Schema.nonNegative()),
  adjustedElapsedNanos: Schema.Number.pipe(Schema.nonNegative()),
  nanosecondsPerOperation: Schema.Number.pipe(Schema.nonNegative()),
  checksum: Schema.Number
})

const BenchmarkReport = Schema.Struct({
  schemaVersion: Schema.Literal(1),
  benchmark: Schema.Literal("@scenesystems/effect-math/public-cross-revision"),
  revision: Schema.String,
  gitCommit: Schema.String,
  runtime: Schema.String,
  platform: Schema.String,
  command: Schema.String,
  clock: Schema.Literal("Clock.currentTimeNanos"),
  overheadControl: Schema.Literal("median matched control subtracted; result clamped to zero"),
  filter: Schema.String,
  iterations: PositiveInteger,
  warmups: WarmupCount,
  samples: SampleCount,
  results: Schema.Array(BenchmarkResult)
})

class BenchmarkCase extends Data.Class<{
  readonly name: string
  readonly family: string
  readonly compatibility: "shared" | "pr117"
  readonly operationsPerIteration: number
  readonly evaluate: (iterations: number) => number
  readonly control: (iterations: number) => number
}> {}

class ScalarCallback extends Data.Class<{
  readonly evaluate: (value: number) => number
}> {}

class BinaryCallback extends Data.Class<{
  readonly evaluate: (left: number, right: number) => number
}> {}

class IterationCallback extends Data.Class<{
  readonly evaluate: () => number
  readonly control: () => number
}> {}

class TimedSample extends Data.Class<{
  readonly elapsedNanos: number
  readonly checksum: number
}> {}

class NonFiniteChecksum extends Data.TaggedError("NonFiniteChecksum")<{
  readonly benchmark: string
}> {}

const repeat = (iterations: number, evaluate: () => number): number =>
  Chunk.reduce(Chunk.range(1, iterations), 0, (checksum) => Number.sum(checksum, evaluate()))

const consume = (values: Chunk.Chunk<number>): number => Number.sumAll(values)

const unaryCase = (
  name: string,
  family: string,
  compatibility: "shared" | "pr117",
  values: Chunk.Chunk<number>,
  operation: ScalarCallback
): BenchmarkCase => {
  const evaluateBatch = () =>
    Chunk.reduce(values, 0, (checksum, value) => Number.sum(checksum, operation.evaluate(value)))
  const controlBatch = () => consume(values)
  return new BenchmarkCase({
    name,
    family,
    compatibility,
    operationsPerIteration: Chunk.size(values),
    evaluate: (iterations) => repeat(iterations, evaluateBatch),
    control: (iterations) => repeat(iterations, controlBatch)
  })
}

const binaryCase = (
  name: string,
  family: string,
  compatibility: "shared" | "pr117",
  left: Chunk.Chunk<number>,
  right: Chunk.Chunk<number>,
  operation: BinaryCallback
): BenchmarkCase => {
  const evaluateBatch = () =>
    consume(Chunk.zipWith(left, right, (leftValue, rightValue) => operation.evaluate(leftValue, rightValue)))
  const controlBatch = () => consume(Chunk.zipWith(left, right, Number.sum))
  return new BenchmarkCase({
    name,
    family,
    compatibility,
    operationsPerIteration: Number.min(Chunk.size(left), Chunk.size(right)),
    evaluate: (iterations) => repeat(iterations, evaluateBatch),
    control: (iterations) => repeat(iterations, controlBatch)
  })
}

const singleCallCase = (
  name: string,
  family: string,
  compatibility: "shared" | "pr117",
  callback: IterationCallback
): BenchmarkCase =>
  new BenchmarkCase({
    name,
    family,
    compatibility,
    operationsPerIteration: 1,
    evaluate: (iterations) => repeat(iterations, callback.evaluate),
    control: (iterations) => repeat(iterations, callback.control)
  })

const ordinary = Chunk.make(-7.75, -2.5, -0.125, 0.25, 1.5, 3.75, 11.125, 31.5)
const positive = Chunk.make(0.03125, 0.125, 0.5, 0.875, 1.25, 2.5, 11.75, 97.5)
const extremePositive = Chunk.make(2.2250738585072014e-308, 1e-200, 1e200, 1e300)
const tiny = Chunk.make(-1e-12, -1e-16, 1e-16, 1e-12, 1e-8, 1e-5)
const trigOrdinary = Chunk.make(-6.25, -3.125, -0.75, 0.125, 1.25, 3.5, 6.125)
const trigLargeAngle = Chunk.make(-1e12, -1e8, -1e6, 1_000_000.25, 100_000_000.5, 1_000_000_000_000.75)
const moderate = Chunk.make(-5, -2.5, -0.5, 0.125, 1.5, 3.25, 5)
const powers = Chunk.make(0.5, 1.25, 2.5, 10, 31.5, 100)
const exponents = Chunk.make(-3, -0.5, 0.25, 1.5, 2.25, 3)
const atanY = Chunk.make(-5, -2, -0.25, 0.25, 2, 5)
const atanX = Chunk.make(3, -3, 0.5, -0.5, 4, -4)
const logLeft = Chunk.make(-1000, -100, -10, -1, 1, 10, 100, 1000)
const logRight = Chunk.make(-1001, -99, -11, -0.5, 0.5, 9, 101, 999)
const logSubLeft = Chunk.make(-999, -98, -9, 0, 2, 11, 102, 1001)
const sumValues = Chunk.make(-1000, 0.125, 2.5, 7.75, 100, -3.25, 1e-8, 1e6, -999_000)

const vectorA = Chunk.make(1.25, -2.5, 3.75, 4.5, -5.25, 6.125, 7.75, -8.5)
const vectorB = Chunk.make(-0.5, 1.75, 2.25, -3.5, 4.125, -5.75, 6.5, 7.25)
const matrix = Chunk.make(4, 1, 0, 0, 1, 4, 1, 0, 0, 1, 4, 1, 0, 0, 1, 3)
const rectangularMatrix = Chunk.make(1.25, -2.5, 3.75, 4.5, -5.25, 6.125, 7.75, -8.5, 9.25, 10.5, -11.75, 12.125)
const lowerTriangularMatrix = Chunk.make(2, 0, 0, 0, -1, 3, 0, 0, 4, 0.5, -2, 0, 1.25, -3, 2, 5)
const upperTriangularMatrix = Chunk.make(-2, 1.5, 0.25, -3, 0, 4, -1, 2, 0, 0, 3, 0.75, 0, 0, 0, -5)
const matrixVector = Chunk.make(1.25, -0.75, 2.5, 0.5)
const matrixRhs = Chunk.make(2, 1, 4, 3)
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

const scalarObjective = new ScalarCallback({
  evaluate: (value) => Number.multiply(Number.subtract(value, 1.75), Number.subtract(value, 1.75))
})
const rootObjective = new ScalarCallback({ evaluate: (value) => Number.subtract(Number.multiply(value, value), 2) })

const cases = Chunk.make(
  unaryCase("Numeric.abs ordinary", "Numeric", "shared", ordinary, new ScalarCallback({ evaluate: Numeric.abs })),
  unaryCase("Numeric.floor ordinary", "Numeric", "shared", ordinary, new ScalarCallback({ evaluate: Numeric.floor })),
  unaryCase("Numeric.ceil ordinary", "Numeric", "shared", ordinary, new ScalarCallback({ evaluate: Numeric.ceil })),
  unaryCase(
    "Numeric.truncate ordinary",
    "Numeric",
    "shared",
    ordinary,
    new ScalarCallback({ evaluate: Numeric.truncate })
  ),
  unaryCase("Numeric.sqrt ordinary", "Numeric", "shared", positive, new ScalarCallback({ evaluate: Numeric.sqrt })),
  unaryCase(
    "Numeric.sqrt extreme",
    "Numeric",
    "shared",
    extremePositive,
    new ScalarCallback({ evaluate: Numeric.sqrt })
  ),
  singleCallCase(
    "Numeric.hypot extreme",
    "Numeric",
    "pr117",
    new IterationCallback({ evaluate: () => Numeric.hypot(extremePositive), control: () => consume(extremePositive) })
  ),
  unaryCase("Numeric.log ordinary", "Numeric", "shared", positive, new ScalarCallback({ evaluate: Numeric.log })),
  unaryCase("Numeric.log extreme", "Numeric", "shared", extremePositive, new ScalarCallback({ evaluate: Numeric.log })),
  unaryCase(
    "Numeric.logStrict ordinary",
    "Numeric",
    "shared",
    positive,
    new ScalarCallback({ evaluate: Numeric.logStrict })
  ),
  unaryCase(
    "Numeric.logStrict extreme",
    "Numeric",
    "shared",
    extremePositive,
    new ScalarCallback({ evaluate: Numeric.logStrict })
  ),
  unaryCase(
    "Numeric.log1pStrict tiny",
    "Numeric",
    "shared",
    tiny,
    new ScalarCallback({ evaluate: Numeric.log1pStrict })
  ),
  unaryCase(
    "Numeric.expm1Strict tiny",
    "Numeric",
    "shared",
    tiny,
    new ScalarCallback({ evaluate: Numeric.expm1Strict })
  ),
  unaryCase(
    "Numeric.exp ordinary",
    "Numeric",
    "pr117",
    moderate,
    new ScalarCallback({ evaluate: (value) => Numeric.exp(value) })
  ),
  unaryCase("Numeric.log10 ordinary", "Numeric", "shared", positive, new ScalarCallback({ evaluate: Numeric.log10 })),
  binaryCase(
    "Numeric.pow ordinary",
    "Numeric",
    "shared",
    powers,
    exponents,
    new BinaryCallback({ evaluate: Numeric.pow })
  ),
  unaryCase("Numeric.sin ordinary", "Numeric", "shared", trigOrdinary, new ScalarCallback({ evaluate: Numeric.sin })),
  unaryCase(
    "Numeric.sin trig large-angle",
    "Numeric",
    "shared",
    trigLargeAngle,
    new ScalarCallback({ evaluate: Numeric.sin })
  ),
  unaryCase("Numeric.cos ordinary", "Numeric", "shared", trigOrdinary, new ScalarCallback({ evaluate: Numeric.cos })),
  unaryCase(
    "Numeric.cos trig large-angle",
    "Numeric",
    "shared",
    trigLargeAngle,
    new ScalarCallback({ evaluate: Numeric.cos })
  ),
  binaryCase(
    "Numeric.atan2 ordinary",
    "Numeric",
    "pr117",
    atanY,
    atanX,
    new BinaryCallback({ evaluate: (left, right) => Numeric.atan2(left, right) })
  ),
  unaryCase(
    "Numeric.sinh ordinary",
    "Numeric",
    "pr117",
    moderate,
    new ScalarCallback({ evaluate: (value) => Numeric.sinh(value) })
  ),
  unaryCase(
    "Numeric.cosh ordinary",
    "Numeric",
    "pr117",
    moderate,
    new ScalarCallback({ evaluate: (value) => Numeric.cosh(value) })
  ),
  singleCallCase(
    "Numeric.sum reduction",
    "Numeric",
    "shared",
    new IterationCallback({ evaluate: () => Numeric.sum(sumValues), control: () => consume(sumValues) })
  ),
  binaryCase(
    "Numeric.logaddexp log-space",
    "Numeric",
    "shared",
    logLeft,
    logRight,
    new BinaryCallback({ evaluate: Numeric.logaddexp })
  ),
  binaryCase(
    "Numeric.logsubexp log-space",
    "Numeric",
    "shared",
    logSubLeft,
    logRight,
    new BinaryCallback({ evaluate: Numeric.logsubexp })
  ),
  unaryCase(
    "Numeric.log1mexp log-space",
    "Numeric",
    "shared",
    Chunk.make(-100, -10, -2, -1, -0.5, -0.01),
    new ScalarCallback({ evaluate: Numeric.log1mexp })
  ),
  unaryCase(
    "Numeric.log1pexp log-space",
    "Numeric",
    "shared",
    logLeft,
    new ScalarCallback({ evaluate: Numeric.log1pexp })
  ),
  binaryCase(
    "Numeric.xlogy log-space",
    "Numeric",
    "shared",
    ordinary,
    positive,
    new BinaryCallback({ evaluate: Numeric.xlogy })
  ),
  binaryCase(
    "Numeric.xlog1py tiny",
    "Numeric",
    "shared",
    ordinary,
    tiny,
    new BinaryCallback({ evaluate: Numeric.xlog1py })
  ),
  singleCallCase(
    "Numeric.logSumExp reduction",
    "Numeric",
    "shared",
    new IterationCallback({ evaluate: () => Numeric.logSumExp(logLeft), control: () => consume(logLeft) })
  ),
  singleCallCase(
    "Numeric.argmaxIndex Chunk",
    "Numeric",
    "pr117",
    new IterationCallback({
      evaluate: () => Option.getOrElse(Numeric.argmaxIndex(argmaxValues), () => 0),
      control: () => consume(argmaxValues)
    })
  ),
  singleCallCase(
    "Numeric.argmaxIndex one-shot iterable",
    "Numeric",
    "pr117",
    new IterationCallback({
      evaluate: () => Option.getOrElse(Numeric.argmaxIndex(HashSet.values(argmaxValueSet)), () => 0),
      control: () => Number.sumAll(argmaxValueSet)
    })
  ),
  singleCallCase(
    "Geometry.euclideanDistance vector",
    "Geometry",
    "shared",
    new IterationCallback({
      evaluate: () => Geometry.euclideanDistance(vectorA, vectorB),
      control: () => Number.sum(consume(vectorA), consume(vectorB))
    })
  ),
  singleCallCase(
    "Geometry.squaredEuclideanDistance vector",
    "Geometry",
    "shared",
    new IterationCallback({
      evaluate: () => Geometry.squaredEuclideanDistance(vectorA, vectorB),
      control: () => Number.sum(consume(vectorA), consume(vectorB))
    })
  ),
  singleCallCase(
    "Geometry.manhattanDistance vector",
    "Geometry",
    "shared",
    new IterationCallback({
      evaluate: () => Geometry.manhattanDistance(vectorA, vectorB),
      control: () => Number.sum(consume(vectorA), consume(vectorB))
    })
  ),
  singleCallCase(
    "Geometry.chebyshevDistance vector",
    "Geometry",
    "shared",
    new IterationCallback({
      evaluate: () => Geometry.chebyshevDistance(vectorA, vectorB),
      control: () => Number.sum(consume(vectorA), consume(vectorB))
    })
  ),
  singleCallCase(
    "Geometry.midpoint vector",
    "Geometry",
    "shared",
    new IterationCallback({
      evaluate: () => consume(Geometry.midpoint(vectorA, vectorB)),
      control: () => Number.sum(consume(vectorA), consume(vectorB))
    })
  ),
  singleCallCase(
    "Geometry.centroid points",
    "Geometry",
    "pr117",
    new IterationCallback({ evaluate: () => consume(Geometry.centroid(points)), control: () => consume(vectorA) })
  ),
  singleCallCase(
    "LinearAlgebra.dot vector",
    "LinearAlgebra",
    "shared",
    new IterationCallback({
      evaluate: () => LinearAlgebra.dot(vectorA, vectorB),
      control: () => Number.sum(consume(vectorA), consume(vectorB))
    })
  ),
  singleCallCase(
    "LinearAlgebra.matvec matrix",
    "LinearAlgebra",
    "shared",
    new IterationCallback({
      evaluate: () => consume(LinearAlgebra.matvec(matrix, 4, 4, matrixVector)),
      control: () => Number.sum(consume(matrix), consume(matrixVector))
    })
  ),
  singleCallCase(
    "LinearAlgebra.transpose rectangular",
    "LinearAlgebra",
    "shared",
    new IterationCallback({
      evaluate: () => consume(LinearAlgebra.transpose(rectangularMatrix, 3, 4)),
      control: () => consume(rectangularMatrix)
    })
  ),
  singleCallCase(
    "LinearAlgebra.frobeniusNorm rectangular",
    "LinearAlgebra",
    "shared",
    new IterationCallback({
      evaluate: () => LinearAlgebra.frobeniusNorm(rectangularMatrix, 3, 4),
      control: () => consume(rectangularMatrix)
    })
  ),
  singleCallCase(
    "LinearAlgebra.cholesky matrix",
    "LinearAlgebra",
    "shared",
    new IterationCallback({
      evaluate: () => Option.match(LinearAlgebra.cholesky(matrix, 4), { onNone: () => 0, onSome: consume }),
      control: () => consume(matrix)
    })
  ),
  singleCallCase(
    "LinearAlgebra.forwardSubstitutionLower triangular",
    "LinearAlgebra",
    "shared",
    new IterationCallback({
      evaluate: () =>
        Option.match(LinearAlgebra.forwardSubstitutionLower(lowerTriangularMatrix, 4, matrixRhs), {
          onNone: () => 0,
          onSome: consume
        }),
      control: () => Number.sum(consume(lowerTriangularMatrix), consume(matrixRhs))
    })
  ),
  singleCallCase(
    "LinearAlgebra.backwardSubstitutionUpper triangular",
    "LinearAlgebra",
    "shared",
    new IterationCallback({
      evaluate: () =>
        Option.match(LinearAlgebra.backwardSubstitutionUpper(upperTriangularMatrix, 4, matrixRhs), {
          onNone: () => 0,
          onSome: consume
        }),
      control: () => Number.sum(consume(upperTriangularMatrix), consume(matrixRhs))
    })
  ),
  singleCallCase(
    "LinearAlgebra.solveSpd matrix",
    "LinearAlgebra",
    "shared",
    new IterationCallback({
      evaluate: () => Option.match(LinearAlgebra.solveSpd(matrix, 4, matrixRhs), { onNone: () => 0, onSome: consume }),
      control: () => Number.sum(consume(matrix), consume(matrixRhs))
    })
  ),
  singleCallCase(
    "Complex.multiply ordinary",
    "Complex",
    "shared",
    new IterationCallback({
      evaluate: () => {
        const value = Complex.multiply(complexLeft, complexRight)
        return Number.sum(value.re, value.im)
      },
      control: () => Number.sum(complexLeft.re, complexRight.im)
    })
  ),
  singleCallCase(
    "Complex.exp ordinary",
    "Complex",
    "shared",
    new IterationCallback({
      evaluate: () => {
        const value = Complex.exp(complexLeft)
        return Number.sum(value.re, value.im)
      },
      control: () => Number.sum(complexLeft.re, complexLeft.im)
    })
  ),
  singleCallCase(
    "Complex.sqrt ordinary",
    "Complex",
    "shared",
    new IterationCallback({
      evaluate: () => {
        const value = Complex.sqrt(complexLeft)
        return Number.sum(value.re, value.im)
      },
      control: () => Number.sum(complexLeft.re, complexLeft.im)
    })
  ),
  unaryCase("Special.gamma ordinary", "Special", "shared", positive, new ScalarCallback({ evaluate: Special.gamma })),
  unaryCase("Special.erf ordinary", "Special", "shared", moderate, new ScalarCallback({ evaluate: Special.erf })),
  unaryCase(
    "Special.erfc upper-tail",
    "Special",
    "shared",
    erfcUpperTail,
    new ScalarCallback({ evaluate: Special.erfc })
  ),
  singleCallCase(
    "Special.gammainc ordinary",
    "Special",
    "shared",
    new IterationCallback({ evaluate: () => Special.gammainc(3.75, 2.25), control: () => 6 })
  ),
  unaryCase(
    "Distribution.normalCdf ordinary",
    "Distribution",
    "shared",
    moderate,
    new ScalarCallback({ evaluate: (value) => Distribution.normalCdf(value, 0.5, 1.75) })
  ),
  singleCallCase(
    "Distribution.betaCdf ordinary",
    "Distribution",
    "shared",
    new IterationCallback({ evaluate: () => Distribution.betaCdf(0.375, 2.5, 4.25), control: () => 7.125 })
  ),
  singleCallCase(
    "Distribution.poissonCdf ordinary",
    "Distribution",
    "shared",
    new IterationCallback({ evaluate: () => Distribution.poissonCdf(7, 4.25), control: () => 11.25 })
  ),
  singleCallCase(
    "Statistics.variance reduction",
    "Statistics",
    "shared",
    new IterationCallback({
      evaluate: () => Statistics.variance(statisticValues),
      control: () => consume(statisticValues)
    })
  ),
  singleCallCase(
    "Statistics.mean reduction",
    "Statistics",
    "shared",
    new IterationCallback({
      evaluate: () => Statistics.mean(statisticValues),
      control: () => consume(statisticValues)
    })
  ),
  singleCallCase(
    "Statistics.covariance paired",
    "Statistics",
    "shared",
    new IterationCallback({
      evaluate: () => Statistics.covariance(statisticValues, covarianceValues),
      control: () => Number.sum(consume(statisticValues), consume(covarianceValues))
    })
  ),
  singleCallCase(
    "Statistics.summaryStatistics reduction",
    "Statistics",
    "shared",
    new IterationCallback({
      evaluate: () => {
        const summary = Statistics.summaryStatistics(statisticValues)
        return Number.sum(summary.mean, Number.sum(summary.variance, summary.standardDeviation))
      },
      control: () => consume(statisticValues)
    })
  ),
  singleCallCase(
    "Calculus.derivative callback",
    "Calculus",
    "shared",
    new IterationCallback({ evaluate: () => Calculus.derivative(scalarObjective.evaluate, 2.25), control: () => 2.25 })
  ),
  singleCallCase(
    "Calculus.simpson reduction",
    "Calculus",
    "shared",
    new IterationCallback({
      evaluate: () => Calculus.simpson(sampledCurve, 0.125),
      control: () => consume(sampledCurve)
    })
  ),
  singleCallCase(
    "Calculus.adaptiveSimpson callback",
    "Calculus",
    "shared",
    new IterationCallback({
      evaluate: () => Calculus.adaptiveSimpson(scalarObjective.evaluate, -2, 4, 1e-8, 1e-8, 12),
      control: () => 2
    })
  ),
  singleCallCase(
    "Optimization.bisect callback",
    "Optimization",
    "shared",
    new IterationCallback({
      evaluate: () => Optimization.bisect(rootObjective.evaluate, 0, 2, 1e-10, 64),
      control: () => 2
    })
  ),
  singleCallCase(
    "Optimization.goldenSection callback",
    "Optimization",
    "shared",
    new IterationCallback({
      evaluate: () => Optimization.goldenSection(scalarObjective.evaluate, -3, 5, 1e-10, 64),
      control: () => 2
    })
  )
)

const nanosToNumber = (value: bigint): number => Option.getOrElse(BigInt.toNumber(value), () => 0)

const timed = (evaluate: () => number) =>
  Effect.gen(function*() {
    const started = yield* Clock.currentTimeNanos
    const checksum = yield* Effect.sync(evaluate)
    const finished = yield* Clock.currentTimeNanos
    return new TimedSample({
      elapsedNanos: nanosToNumber(BigInt.subtract(finished, started)),
      checksum
    })
  })

const medianElapsed = (samples: Chunk.Chunk<TimedSample>): number => {
  const ordered = Array.sort(Array.fromIterable(Chunk.map(samples, (sample) => sample.elapsedNanos)), Number.Order)
  const middle = Number.unsafeDivide(Number.decrement(Array.length(ordered)), 2)
  return Option.getOrElse(Array.get(ordered, middle), () => 0)
}

const measure = (benchmark: BenchmarkCase, config: typeof BenchmarkConfig.Type) =>
  Effect.gen(function*() {
    yield* Effect.replicateEffect(Effect.sync(() => benchmark.evaluate(config.iterations)), config.warmups, {
      concurrency: 1,
      discard: true
    })
    yield* Effect.replicateEffect(Effect.sync(() => benchmark.control(config.iterations)), config.warmups, {
      concurrency: 1,
      discard: true
    })
    const elapsed = yield* Effect.replicateEffect(timed(() => benchmark.evaluate(config.iterations)), config.samples, {
      concurrency: 1
    })
    const controls = yield* Effect.replicateEffect(timed(() => benchmark.control(config.iterations)), config.samples, {
      concurrency: 1
    })
    const elapsedChunk = Chunk.fromIterable(elapsed)
    const controlChunk = Chunk.fromIterable(controls)
    const elapsedMedian = medianElapsed(elapsedChunk)
    const controlMedian = medianElapsed(controlChunk)
    const adjusted = Number.max(0, Number.subtract(elapsedMedian, controlMedian))
    const operationCount = Number.multiply(config.iterations, benchmark.operationsPerIteration)
    const checksum = Number.sumAll(Chunk.map(elapsedChunk, (sample) => sample.checksum))
    yield* Effect.succeed(checksum).pipe(
      Effect.filterOrFail(Numeric.isFinite, () => new NonFiniteChecksum({ benchmark: benchmark.name }))
    )
    return yield* Schema.decodeUnknown(BenchmarkResult)({
      name: benchmark.name,
      family: benchmark.family,
      compatibility: benchmark.compatibility,
      iterations: config.iterations,
      operationsPerIteration: benchmark.operationsPerIteration,
      operationCount,
      warmups: config.warmups,
      samples: config.samples,
      medianElapsedNanos: elapsedMedian,
      medianControlNanos: controlMedian,
      adjustedElapsedNanos: adjusted,
      nanosecondsPerOperation: Number.unsafeDivide(adjusted, operationCount),
      checksum
    }, { onExcessProperty: "error" })
  })

const selectedBy = (filter: string) => (benchmark: BenchmarkCase): boolean => {
  const normalized = String.toLowerCase(filter)
  return Boolean.or(
    String.includes(normalized)(String.toLowerCase(benchmark.name)),
    Boolean.or(
      String.includes(normalized)(String.toLowerCase(benchmark.family)),
      String.includes(normalized)(benchmark.compatibility)
    )
  )
}

const loadConfig = Effect.gen(function*() {
  const revision = yield* Config.string("MATH_BENCHMARK_REVISION").pipe(Config.withDefault("working-tree"))
  const filter = yield* Config.string("MATH_BENCHMARK_FILTER").pipe(Config.withDefault(""))
  const iterations = yield* Config.integer("MATH_BENCHMARK_ITERATIONS").pipe(Config.withDefault(25))
  const warmups = yield* Config.integer("MATH_BENCHMARK_WARMUPS").pipe(Config.withDefault(2))
  const samples = yield* Config.integer("MATH_BENCHMARK_SAMPLES").pipe(Config.withDefault(7))
  const outputPath = yield* Config.string("MATH_BENCHMARK_OUTPUT").pipe(Config.withDefault(""))
  return yield* Schema.decodeUnknown(BenchmarkConfig)({ revision, filter, iterations, warmups, samples, outputPath }, {
    onExcessProperty: "error"
  })
})

const program = Effect.gen(function*() {
  const config = yield* loadConfig
  const fileSystem = yield* FileSystem.FileSystem
  const runtime = String.concat("Bun ", String.trim(yield* Command.string(Command.make("bun", "--version"))))
  const gitCommit = String.trim(yield* Command.string(Command.make("git", "rev-parse", "HEAD")))
  const platform = String.trim(yield* Command.string(Command.make("uname", "-sm")))
  const selected = Chunk.filter(cases, selectedBy(config.filter))
  const results = yield* Effect.forEach(selected, (benchmark) => measure(benchmark, config), { concurrency: 1 })
  const report = yield* Schema.decodeUnknown(BenchmarkReport)({
    schemaVersion: 1,
    benchmark: "@scenesystems/effect-math/public-cross-revision",
    revision: config.revision,
    gitCommit,
    runtime,
    platform,
    command: "bun run packages/effect-math/scripts/benchmark.ts",
    clock: "Clock.currentTimeNanos",
    overheadControl: "median matched control subtracted; result clamped to zero",
    filter: config.filter,
    iterations: config.iterations,
    warmups: config.warmups,
    samples: config.samples,
    results
  }, { onExcessProperty: "error" })
  const output = yield* Schema.encode(Schema.parseJson(BenchmarkReport, { space: 2 }))(report)
  yield* Boolean.match(String.isNonEmpty(config.outputPath), {
    onFalse: () => Console.log(output),
    onTrue: () => fileSystem.writeFileString(config.outputPath, String.concat(output, "\n"))
  })
}).pipe(Effect.provide(BunContext.layer))

BunRuntime.runMain(program)
