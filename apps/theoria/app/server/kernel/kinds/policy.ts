import { Config, Context, Effect, Layer, Match } from "effect"

export type Lane = "local" | "provider"

export class ExecutionPolicy extends Context.Tag("@theoria/app/server/entries/ExecutionPolicy")<
  ExecutionPolicy,
  {
    readonly timeoutMillis: (lane: Lane) => number
    readonly withLane: <A, E, R>(
      lane: Lane,
      effect: Effect.Effect<A, E, R>
    ) => Effect.Effect<A, E, R>
  }
>() {}

const makeExecutionPolicy = Effect.gen(function*() {
  const localConcurrency = yield* Config.withDefault(
    Config.integer("THEORIA_LOCAL_CONCURRENCY"),
    8
  )
  const providerConcurrency = yield* Config.withDefault(
    Config.integer("THEORIA_PROVIDER_CONCURRENCY"),
    2
  )
  const localTimeoutMs = yield* Config.withDefault(
    Config.integer("THEORIA_LOCAL_TIMEOUT_MS"),
    5_000
  )
  const providerTimeoutMs = yield* Config.withDefault(
    Config.integer("THEORIA_PROVIDER_TIMEOUT_MS"),
    20_000
  )

  const localSemaphore = yield* Effect.makeSemaphore(Math.max(1, localConcurrency))
  const providerSemaphore = yield* Effect.makeSemaphore(
    Math.max(1, providerConcurrency)
  )

  return ExecutionPolicy.of({
    timeoutMillis: (lane) =>
      Match.value(lane).pipe(
        Match.when("local", () => Math.max(1, localTimeoutMs)),
        Match.orElse(() => Math.max(1, providerTimeoutMs))
      ),
    withLane: (lane, effect) =>
      Match.value(lane).pipe(
        Match.when("local", () => localSemaphore.withPermits(1)(effect)),
        Match.orElse(() => providerSemaphore.withPermits(1)(effect))
      )
  })
})

export const ExecutionPolicyLive = Layer.effect(ExecutionPolicy, makeExecutionPolicy)
