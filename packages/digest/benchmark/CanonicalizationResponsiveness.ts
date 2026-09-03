import { BunRuntime } from "@effect/platform-bun"
import { Array as Arr, Console, Data, Effect, Number as Num, Option, Schema } from "effect"

import { canonicalJsonBytes } from "../src/convenience.js"

const POINT_COUNT = 65_536
const WARMUP_SAMPLES = 1
const MEASURED_SAMPLES = 3
const TIMER_DURATION_MS = 1

class Sample extends Data.Class<{
  readonly wallMs: number
  readonly schedulerDelayMs: number
  readonly peakRssMiB: number
  readonly bytes: number
}> {}

const maximumValid = {
  version: "scene.graph.closed.v1",
  domain: "scene.graph.closed",
  algorithm: "blake3-256",
  points: Arr.makeBy(POINT_COUNT, (index) => index === 0 ? [] : [`point-${String(index).padStart(5, "0")}`]),
  attachments: [],
  edges: [],
  compositions: [],
  children: []
}

const rssMiB = (): number => process.memoryUsage().rss / 1024 / 1024

const observe = Effect.acquireUseRelease(
  Effect.sync(() => {
    const probe = { active: false, previous: 0, delay: 0, peakRssMiB: rssMiB() }
    const handle = setInterval(() => {
      if (!probe.active) return
      const now = performance.now()
      probe.delay = Math.max(probe.delay, now - probe.previous - TIMER_DURATION_MS)
      probe.previous = now
      probe.peakRssMiB = Math.max(probe.peakRssMiB, rssMiB())
    }, TIMER_DURATION_MS)
    return { handle, probe }
  }),
  ({ probe }) =>
    Effect.gen(function*() {
      yield* Effect.sleep(5)
      probe.active = true
      probe.previous = performance.now()
      const started = probe.previous
      const bytes = yield* canonicalJsonBytes(maximumValid)
      const finished = performance.now()
      probe.delay = Math.max(probe.delay, finished - probe.previous - TIMER_DURATION_MS)
      probe.peakRssMiB = Math.max(probe.peakRssMiB, rssMiB())
      probe.active = false
      return new Sample({
        wallMs: finished - started,
        schedulerDelayMs: probe.delay,
        peakRssMiB: probe.peakRssMiB,
        bytes: bytes.length
      })
    }),
  ({ handle }) => Effect.sync(() => clearInterval(handle))
)

const distribution = (values: Arr.NonEmptyReadonlyArray<number>) => {
  const sorted = Arr.sort(values, Num.Order)
  const percentile = (fraction: number): number =>
    Option.getOrElse(
      Arr.get(sorted, Math.ceil(sorted.length * fraction) - 1),
      () => Arr.lastNonEmpty(sorted)
    )
  return {
    min: Arr.headNonEmpty(sorted),
    p50: percentile(0.5),
    p95: percentile(0.95),
    max: Arr.lastNonEmpty(sorted),
    mean: Num.sumAll(sorted) / sorted.length
  }
}

const Distribution = Schema.Struct({
  min: Schema.Number,
  p50: Schema.Number,
  p95: Schema.Number,
  max: Schema.Number,
  mean: Schema.Number
})

const Report = Schema.parseJson(
  Schema.Struct({
    runtime: Schema.String,
    workload: Schema.Struct({
      pointCount: Schema.Number,
      warmupSamples: Schema.Number,
      measuredSamples: Schema.Number,
      timerDurationMs: Schema.Number
    }),
    samples: Schema.Array(
      Schema.Struct({
        wallMs: Schema.Number,
        schedulerDelayMs: Schema.Number,
        peakRssMiB: Schema.Number,
        bytes: Schema.Number
      })
    ),
    wallMs: Distribution,
    schedulerDelayMs: Distribution,
    peakRssMiB: Schema.Number
  }),
  { space: 2 }
)

const program = Effect.gen(function*() {
  yield* Effect.forEach(Arr.makeBy(WARMUP_SAMPLES, (index) => index), () => observe, { discard: true })
  const samples = yield* Effect.forEach(Arr.makeBy(MEASURED_SAMPLES, (index) => index), () => observe)
  const report = yield* Schema.encode(Report)({
    runtime: Option.match(Option.fromNullable(process.versions.bun), {
      onNone: () => "bun",
      onSome: (version) => `bun ${version}`
    }),
    workload: {
      pointCount: POINT_COUNT,
      warmupSamples: WARMUP_SAMPLES,
      measuredSamples: MEASURED_SAMPLES,
      timerDurationMs: TIMER_DURATION_MS
    },
    samples,
    wallMs: distribution(Arr.map(samples, ({ wallMs }) => wallMs)),
    schedulerDelayMs: distribution(Arr.map(samples, ({ schedulerDelayMs }) => schedulerDelayMs)),
    peakRssMiB: Arr.max(Arr.map(samples, ({ peakRssMiB }) => peakRssMiB), Num.Order)
  })
  yield* Console.log(report)
})

BunRuntime.runMain(program)
