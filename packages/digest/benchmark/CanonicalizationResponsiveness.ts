import { Array as Arr, Data, Effect, Number as Num } from "effect"

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

const distribution = (values: ReadonlyArray<number>) => {
  const sorted = Arr.sort(values, Num.Order)
  const percentile = (fraction: number): number =>
    sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * fraction) - 1)]!
  return {
    min: sorted[0],
    p50: percentile(0.5),
    p95: percentile(0.95),
    max: sorted[sorted.length - 1],
    mean: Arr.reduce(sorted, 0, (total, value) => total + value) / sorted.length
  }
}

const program = Effect.gen(function*() {
  yield* Effect.forEach(Arr.makeBy(WARMUP_SAMPLES, (index) => index), () => observe, { discard: true })
  const samples = yield* Effect.forEach(Arr.makeBy(MEASURED_SAMPLES, (index) => index), () => observe)
  const bunVersion = Reflect.get(process.versions, "bun")
  yield* Effect.sync(() =>
    console.log(JSON.stringify(
      {
        runtime: typeof bunVersion === "string" ? `bun ${bunVersion}` : `node ${process.version}`,
        workload: {
          pointCount: POINT_COUNT,
          warmupSamples: WARMUP_SAMPLES,
          measuredSamples: MEASURED_SAMPLES,
          timerDurationMs: TIMER_DURATION_MS
        },
        samples,
        wallMs: distribution(Arr.map(samples, ({ wallMs }) => wallMs)),
        schedulerDelayMs: distribution(Arr.map(samples, ({ schedulerDelayMs }) => schedulerDelayMs)),
        peakRssMiB: Math.max(...Arr.map(samples, ({ peakRssMiB }) => peakRssMiB))
      },
      null,
      2
    ))
  )
})

Effect.runPromise(program)
