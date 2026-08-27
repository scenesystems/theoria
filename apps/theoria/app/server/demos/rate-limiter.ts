import { Clock, Config, Context, Effect, HashMap, Layer, Match, Option, Ref } from "effect"

import type { Lane } from "./policy.js"

type RequestWindow = {
  readonly startedAtMs: number
  readonly used: number
}

type RateLimitDecision = {
  readonly allowed: boolean
  readonly remaining: number
  readonly retryAfterSeconds: number
}

type WindowState = HashMap.HashMap<string, RequestWindow>

const decision = (
  allowed: boolean,
  remaining: number,
  retryAfterSeconds: number
): RateLimitDecision => ({ allowed, remaining, retryAfterSeconds })

const transition = (
  key: string,
  limit: number,
  windowMs: number,
  now: number,
  windows: WindowState
): readonly [RateLimitDecision, WindowState] => {
  const activeWindows = HashMap.filter(
    windows,
    (window) => now - window.startedAtMs < windowMs
  )
  const current = Option.getOrElse(HashMap.get(activeWindows, key), () => ({
    startedAtMs: now,
    used: 0
  }))
  const allowed = current.used < limit
  const next = allowed ? { ...current, used: current.used + 1 } : current
  const retryAfterSeconds = allowed
    ? 0
    : Math.max(1, Math.ceil((windowMs - (now - current.startedAtMs)) / 1_000))

  return [
    decision(allowed, Math.max(0, limit - next.used), retryAfterSeconds),
    HashMap.set(activeWindows, key, next)
  ]
}

export class DemoRateLimiter extends Context.Tag("@theoria/app/server/demos/DemoRateLimiter")<
  DemoRateLimiter,
  {
    readonly check: (lane: Lane, clientId: string) => Effect.Effect<RateLimitDecision>
  }
>() {}

const makeDemoRateLimiter = Effect.gen(function*() {
  const localLimit = Math.max(
    1,
    yield* Config.withDefault(
      Config.integer("THEORIA_LOCAL_REQUESTS_PER_MINUTE"),
      30
    )
  )
  const providerLimit = Math.max(
    1,
    yield* Config.withDefault(
      Config.integer("THEORIA_PROVIDER_REQUESTS_PER_MINUTE"),
      4
    )
  )
  const windowMs = Math.max(
    1_000,
    yield* Config.withDefault(
      Config.integer("THEORIA_RATE_LIMIT_WINDOW_MS"),
      60_000
    )
  )
  const windows = yield* Ref.make(HashMap.empty<string, RequestWindow>())

  const limitFor = (lane: Lane): number =>
    Match.value(lane).pipe(
      Match.when("local", () => localLimit),
      Match.orElse(() => providerLimit)
    )

  return DemoRateLimiter.of({
    check: (lane, clientId) =>
      Clock.currentTimeMillis.pipe(
        Effect.flatMap((now) =>
          Ref.modify(
            windows,
            (state) => transition(`${lane}:${clientId}`, limitFor(lane), windowMs, now, state)
          )
        )
      )
  })
})

export const DemoRateLimiterLive = Layer.effect(DemoRateLimiter, makeDemoRateLimiter)
