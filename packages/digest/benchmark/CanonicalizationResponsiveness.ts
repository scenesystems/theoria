import { BunRuntime } from "@effect/platform-bun"
import { Array as Arr, Clock, Console, Data, Effect, Number as Num, Option, Ref, Schema } from "effect"

import { canonicalJsonBytes } from "../src/convenience.js"

const POINT_COUNT = 65_536
const WARMUP_SAMPLES = 1
const MEASURED_SAMPLES = 3
const TIMER_DURATION_MS = 1

class Sample extends Data.Class<{
  readonly wallMs: number
  readonly schedulerDelayMs: number
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

const nowMillis: Effect.Effect<number> = Effect.map(Clock.currentTimeNanos, (nanos) => Number(nanos) / 1_000_000)

/**
 * Samples one canonicalization while a one-millisecond sleeper fiber runs
 * beside it. Each time the sleeper wakes it records how late it was, so the
 * sample captures the worst scheduler delay the canonicalization imposed on
 * other timers.
 */
const observe: Effect.Effect<Sample> = Effect.scoped(
  Effect.gen(function*() {
    const probe = yield* Ref.make({ delay: 0, previous: 0 })
    const tick = Effect.gen(function*() {
      yield* Effect.sleep(TIMER_DURATION_MS)
      const now = yield* nowMillis
      yield* Ref.update(probe, (state) => ({
        delay: Math.max(state.delay, now - state.previous - TIMER_DURATION_MS),
        previous: now
      }))
    })
    const started = yield* nowMillis
    yield* Ref.update(probe, (state) => ({ ...state, previous: started }))
    yield* Effect.forkScoped(Effect.forever(tick))
    const bytes = yield* Effect.orDie(canonicalJsonBytes(maximumValid))
    const finished = yield* nowMillis
    const final = yield* Ref.get(probe)
    return new Sample({
      wallMs: finished - started,
      schedulerDelayMs: Math.max(final.delay, finished - final.previous - TIMER_DURATION_MS),
      bytes: bytes.length
    })
  })
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
        bytes: Schema.Number
      })
    ),
    wallMs: Distribution,
    schedulerDelayMs: Distribution
  }),
  { space: 2 }
)

const program = Effect.gen(function*() {
  yield* Effect.forEach(Arr.makeBy(WARMUP_SAMPLES, (index) => index), () => observe, { discard: true })
  const samples = yield* Effect.forEach(Arr.makeBy(MEASURED_SAMPLES, (index) => index), () => observe)
  const report = yield* Schema.encode(Report)({
    workload: {
      pointCount: POINT_COUNT,
      warmupSamples: WARMUP_SAMPLES,
      measuredSamples: MEASURED_SAMPLES,
      timerDurationMs: TIMER_DURATION_MS
    },
    samples,
    wallMs: distribution(Arr.map(samples, ({ wallMs }) => wallMs)),
    schedulerDelayMs: distribution(Arr.map(samples, ({ schedulerDelayMs }) => schedulerDelayMs))
  })
  yield* Console.log(report)
})

BunRuntime.runMain(program)
