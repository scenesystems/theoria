import type { Scope } from "effect"
import { Config, Context, Effect, Layer, Match, Ref, Schema, Stream } from "effect"

export type Lane = "local" | "provider"

export class LaneAtCapacity extends Schema.TaggedError<LaneAtCapacity>()(
  "LaneAtCapacity",
  { lane: Schema.Literal("local", "provider") }
) {}

export class ExecutionTimedOut extends Schema.TaggedError<ExecutionTimedOut>()(
  "ExecutionTimedOut",
  { lane: Schema.Literal("local", "provider") }
) {}

type LaneGate = {
  readonly available: Ref.Ref<number>
}

const gateTransition = (available: number): readonly [boolean, number] =>
  available > 0 ? [true, available - 1] : [false, available]

const acquireGate = (lane: Lane, gate: LaneGate): Effect.Effect<void, LaneAtCapacity> =>
  Ref.modify(gate.available, gateTransition).pipe(
    Effect.flatMap((acquired) => acquired ? Effect.void : Effect.fail(new LaneAtCapacity({ lane })))
  )

const releaseGate = (gate: LaneGate): Effect.Effect<void> => Ref.update(gate.available, (available) => available + 1)

export class ExecutionPolicy extends Context.Tag("@theoria/app/server/demos/ExecutionPolicy")<
  ExecutionPolicy,
  {
    readonly timeoutMillis: (lane: Lane) => number
    readonly acquireLane: (lane: Lane) => Effect.Effect<void, LaneAtCapacity, Scope.Scope>
    readonly withLane: <A, E, R>(
      lane: Lane,
      effect: Effect.Effect<A, E, R>
    ) => Effect.Effect<A, E | LaneAtCapacity, R>
    readonly timeoutStream: <A, E, R>(
      lane: Lane,
      stream: Stream.Stream<A, E, R>
    ) => Stream.Stream<A, E | ExecutionTimedOut, R>
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
    120_000
  )

  const localGate: LaneGate = {
    available: yield* Ref.make(Math.max(1, localConcurrency))
  }
  const providerGate: LaneGate = {
    available: yield* Ref.make(Math.max(1, providerConcurrency))
  }

  const gateFor = (lane: Lane): LaneGate =>
    Match.value(lane).pipe(
      Match.when("local", () => localGate),
      Match.orElse(() => providerGate)
    )

  const timeoutMillis = (lane: Lane): number =>
    Match.value(lane).pipe(
      Match.when("local", () => Math.max(1, localTimeoutMs)),
      Match.orElse(() => Math.max(1, providerTimeoutMs))
    )

  return ExecutionPolicy.of({
    timeoutMillis,
    acquireLane: (lane) => {
      const gate = gateFor(lane)

      return Effect.acquireRelease(
        acquireGate(lane, gate),
        () => releaseGate(gate)
      )
    },
    withLane: (lane, effect) =>
      Effect.acquireUseRelease(
        acquireGate(lane, gateFor(lane)),
        () => effect,
        () => releaseGate(gateFor(lane))
      ),
    timeoutStream: (lane, stream) =>
      stream.pipe(
        Stream.interruptWhen(
          Effect.sleep(timeoutMillis(lane)).pipe(
            Effect.zipRight(Effect.fail(new ExecutionTimedOut({ lane })))
          )
        )
      )
  })
})

export const ExecutionPolicyLive = Layer.effect(ExecutionPolicy, makeExecutionPolicy)
