/**
 * Compare one-shot and batch-prepared TPE density scoring, including preparation
 * in every batch. Run with `bun run packages/effect-search/scripts/benchmark-density.ts`.
 * Each case has 24 probes, 5 warmups, and 7 measured samples of 100 batches.
 * Run without concurrent CPU workloads; output reports raw median nanoseconds.
 */
import { BunRuntime } from "@effect/platform-bun"
import { Array as Arr, BigInt, Boolean as Bool, Clock, Console, Data, Effect, Number as Num, Schema } from "effect"

import {
  buildContinuousParzen,
  ContinuousKernel,
  ContinuousParzen,
  logDensity
} from "../src/internal/tpe/continuousParzen.js"
import { prepareLogDensity } from "../src/internal/tpe/continuousParzen/density.js"

class DensityCase extends Data.Class<{
  readonly name: string
  readonly model: ContinuousParzen
}> {}

class DensityMismatch extends Data.TaggedError("DensityMismatch")<{
  readonly name: string
  readonly expected: number
  readonly actual: number
}> {
  override get message(): string {
    return `${this.name}: expected checksum ${this.expected}, got ${this.actual}`
  }
}

const candidates = 24
const iterations = 100
const warmups = 5
const samples = 7
const cases = Arr.append(
  Arr.map(Arr.make(0, 7, 31, 127), (count) =>
    new DensityCase({
      name: `central-${Num.increment(count)}-kernels`,
      model: buildContinuousParzen(
        Bool.match(Num.Equivalence(count, 0), {
          onTrue: () => Arr.empty<number>(),
          onFalse: () =>
            Arr.makeBy(count, (index) => Num.sum(Num.negate(2), Num.unsafeDivide(Num.multiply(5, index), count)))
        }),
        Num.negate(2),
        3
      )
    })),
  new DensityCase({
    name: "asymmetric-tail-mixture",
    model: new ContinuousParzen({
      low: 9,
      high: 12,
      kernels: Arr.make(
        new ContinuousKernel({ mean: 0, sigma: 1, weight: 0.7 }),
        new ContinuousKernel({ mean: 20, sigma: 2, weight: 0.3 })
      )
    })
  })
)

const time = (batch: () => number) =>
  Effect.gen(function*() {
    const start = yield* Clock.currentTimeNanos
    const checksum = yield* Effect.sync(() => Arr.reduce(Arr.range(1, iterations), 0, (sum) => Num.sum(sum, batch())))
    const end = yield* Clock.currentTimeNanos
    const elapsedNanos = yield* BigInt.toNumber(BigInt.subtract(end, start))
    return { elapsedNanos, checksum }
  })

const measure = (batch: () => number) =>
  Effect.gen(function*() {
    yield* Effect.replicateEffect(time(batch), warmups, { discard: true })
    const measured = yield* Effect.replicateEffect(time(batch), samples)
    const ordered = Arr.sort(Arr.map(measured, (sample) => sample.elapsedNanos), Num.Order)
    const median = yield* Arr.get(ordered, 3)
    const first = yield* Arr.head(measured)
    return { medianBatchNanos: Num.unsafeDivide(median, iterations), checksum: first.checksum }
  })

const Result = Schema.Struct({
  name: Schema.String,
  kernels: Schema.Number,
  candidates: Schema.Number,
  iterations: Schema.Number,
  warmups: Schema.Number,
  samples: Schema.Number,
  oneShotBatchNanos: Schema.Number,
  preparedBatchNanos: Schema.Number,
  speedup: Schema.Number,
  checksum: Schema.Number
})

BunRuntime.runMain(Effect.gen(function*() {
  const results = yield* Effect.forEach(cases, (entry) =>
    Effect.gen(function*() {
      const model = entry.model
      const probes = Arr.makeBy(candidates, (index) =>
        Num.sum(model.low, Num.multiply(Num.subtract(model.high, model.low), Num.unsafeDivide(index, 23))))
      const oneShot = yield* measure(() =>
        Arr.reduce(probes, 0, (sum, x) => Num.sum(sum, logDensity(model, x)))
      )
      const prepared = yield* measure(() => {
        const density = prepareLogDensity(model)
        return Arr.reduce(probes, 0, (sum, x) => Num.sum(sum, density(x)))
      })
      yield* Effect.fail(
        new DensityMismatch({ name: entry.name, expected: oneShot.checksum, actual: prepared.checksum })
      )
        .pipe(Effect.unless(() => Num.Equivalence(oneShot.checksum, prepared.checksum)))
      return {
        name: entry.name,
        kernels: Arr.length(model.kernels),
        candidates,
        iterations,
        warmups,
        samples,
        oneShotBatchNanos: oneShot.medianBatchNanos,
        preparedBatchNanos: prepared.medianBatchNanos,
        speedup: Num.unsafeDivide(oneShot.medianBatchNanos, prepared.medianBatchNanos),
        checksum: prepared.checksum
      }
    }))
  yield* Console.log(yield* Schema.encode(Schema.parseJson(Schema.Array(Result), { space: 2 }))(results))
}))
