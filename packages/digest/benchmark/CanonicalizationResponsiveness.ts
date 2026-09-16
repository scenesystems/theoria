import { BunRuntime } from "@effect/platform-bun"
import {
  Array as Arr,
  Boolean as B,
  Clock,
  Console,
  Deferred,
  Duration,
  Effect,
  Iterable,
  Number as Num,
  Option,
  Ref,
  Schema,
  String as Str
} from "effect"

import * as CanonicalJson from "@scenesystems/digest/CanonicalJson"

const POINT_COUNT = 65_536
const WARMUP_SAMPLES = 1
const MEASURED_SAMPLES = 3
const TIMER_DURATION = Duration.millis(1)

class Sample extends Schema.Class<Sample>("CanonicalizationResponsivenessSample")({
  wallMs: Schema.Number,
  schedulerDelayMs: Schema.Number,
  bytes: Schema.Number
}) {}

class Probe extends Schema.Class<Probe>("CanonicalizationResponsivenessProbe")({
  delay: Schema.DurationFromSelf,
  previous: Schema.DurationFromSelf
}) {}

class Distribution extends Schema.Class<Distribution>("CanonicalizationResponsivenessDistribution")({
  min: Schema.Number,
  p50: Schema.Number,
  p95: Schema.Number,
  max: Schema.Number,
  mean: Schema.Number
}) {}

class Workload extends Schema.Class<Workload>("CanonicalizationResponsivenessWorkload")({
  pointCount: Schema.Number,
  warmupSamples: Schema.Number,
  measuredSamples: Schema.Number,
  timerDurationMs: Schema.Number
}) {}

class Report extends Schema.Class<Report>("CanonicalizationResponsivenessReport")({
  workload: Workload,
  samples: Schema.NonEmptyArray(Sample),
  wallMs: Distribution,
  schedulerDelayMs: Distribution
}) {}

const ReportJson = Schema.parseJson(Report, { space: 2 })

const MaximumValid = Schema.Struct({
  version: Schema.Literal("scene.graph.closed.v1"),
  domain: Schema.Literal("scene.graph.closed"),
  algorithm: Schema.Literal("blake3-256"),
  points: Schema.Array(Schema.Array(Schema.String)),
  attachments: Schema.Array(Schema.Unknown),
  edges: Schema.Array(Schema.Unknown),
  compositions: Schema.Array(Schema.Unknown),
  children: Schema.Array(Schema.Unknown)
})

const encodeNumber = Schema.encodeSync(Schema.NumberFromString)

const maximumValid = Schema.decodeSync(MaximumValid)({
  version: "scene.graph.closed.v1",
  domain: "scene.graph.closed",
  algorithm: "blake3-256",
  points: Arr.makeBy(POINT_COUNT, (index) =>
    B.match(Num.Equivalence(index, 0), {
      onTrue: () => Arr.empty<string>(),
      onFalse: () => Arr.of(Str.concat("point-", Str.padStart(5, "0")(encodeNumber(index))))
    })),
  attachments: Arr.empty(),
  edges: Arr.empty(),
  compositions: Arr.empty(),
  children: Arr.empty()
})

const currentTime = Effect.map(Clock.currentTimeNanos, Duration.nanos)

const schedulerDelay = (current: Duration.Duration, previous: Duration.Duration): Duration.Duration =>
  Duration.subtract(Duration.subtract(current, previous), TIMER_DURATION)

/**
 * Samples one canonicalization while a one-millisecond sleeper fiber runs
 * beside it. Each time the sleeper wakes it records how late it was, so the
 * sample captures the worst scheduler delay the canonicalization imposed on
 * other timers.
 */
const observe: Effect.Effect<Sample> = Effect.scoped(
  Effect.gen(function*() {
    const probe = yield* Ref.make(new Probe({ delay: Duration.zero, previous: Duration.zero }))
    const timerStarted = yield* Deferred.make<void>()
    const tick = Effect.gen(function*() {
      yield* Effect.sleep(TIMER_DURATION)
      const now = yield* currentTime
      yield* Ref.update(probe, (state) =>
        new Probe({
          delay: Duration.max(state.delay, schedulerDelay(now, state.previous)),
          previous: now
        }))
    })
    const started = yield* currentTime
    yield* Ref.set(probe, new Probe({ delay: Duration.zero, previous: started }))
    const timer = Deferred.succeed(timerStarted, undefined).pipe(Effect.zipRight(Effect.forever(tick)))
    yield* Effect.forkScoped(timer)
    yield* Deferred.await(timerStarted)
    const bytes = yield* Effect.orDie(CanonicalJson.encodeBytes(maximumValid))
    const finished = yield* currentTime
    const final = yield* Ref.get(probe)
    return new Sample({
      wallMs: Duration.toMillis(Duration.subtract(finished, started)),
      schedulerDelayMs: Duration.toMillis(Duration.max(final.delay, schedulerDelay(finished, final.previous))),
      bytes: Iterable.size(bytes)
    })
  })
)

const distribution = (values: Arr.NonEmptyReadonlyArray<number>) => {
  const sorted = Arr.sort(values, Num.Order)
  const percentile = (fraction: number): number =>
    Option.getOrElse(
      Arr.findFirst(sorted, (_value, index) =>
        Num.greaterThanOrEqualTo(Num.increment(index), Num.multiply(Arr.length(sorted), fraction))),
      () =>
        Arr.lastNonEmpty(sorted)
    )
  return new Distribution({
    min: Arr.headNonEmpty(sorted),
    p50: percentile(0.5),
    p95: percentile(0.95),
    max: Arr.lastNonEmpty(sorted),
    mean: Num.unsafeDivide(Num.sumAll(sorted), Arr.length(sorted))
  })
}

const program = Effect.gen(function*() {
  yield* Effect.forEach(Arr.makeBy(WARMUP_SAMPLES, (index) => index), () => observe, { discard: true })
  const samples = yield* Effect.forEach(Arr.makeBy(MEASURED_SAMPLES, (index) => index), () => observe)
  const report = yield* Schema.encode(ReportJson)(
    new Report({
      workload: new Workload({
        pointCount: POINT_COUNT,
        warmupSamples: WARMUP_SAMPLES,
        measuredSamples: MEASURED_SAMPLES,
        timerDurationMs: Duration.toMillis(TIMER_DURATION)
      }),
      samples,
      wallMs: distribution(Arr.map(samples, ({ wallMs }) => wallMs)),
      schedulerDelayMs: distribution(Arr.map(samples, ({ schedulerDelayMs }) => schedulerDelayMs))
    })
  )
  yield* Console.log(report)
})

BunRuntime.runMain(program)
