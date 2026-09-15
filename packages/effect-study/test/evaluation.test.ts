import { expect, it } from "@effect/vitest"
import {
  Array as Arr,
  Context,
  Deferred,
  Effect,
  Either,
  Fiber,
  Layer,
  Number as Num,
  Ref,
  Schema,
  TestClock
} from "effect"

import * as Evaluation from "../src/Evaluation.js"

class Rejected extends Schema.TaggedError<Rejected>()("Rejected", { input: Schema.Number }) {}
class Prefix extends Context.Tag("study-test/Prefix")<Prefix, string>() {}

const Observation = Schema.Struct({ prefix: Schema.String, config: Schema.Number, trialNumber: Schema.Number })

it.effect("evaluates fixed inputs with typed services and preserves input order across concurrent completion", () =>
  Effect.gen(function*() {
    const fastFinished = yield* Deferred.make<void>()
    const fiber = yield* Evaluation.run(
      Arr.make(3, 1),
      (config, trialNumber) =>
        Effect.gen(function*() {
          const prefix = yield* Prefix
          yield* Effect.sleep(Num.multiply(config, 100))
          yield* Deferred.succeed(fastFinished, undefined).pipe(Effect.when(() => Num.Equivalence(config, 1)))
          return Observation.make({ prefix, config, trialNumber })
        }),
      { concurrency: 2 }
    ).pipe(Effect.provide(Layer.succeed(Prefix, "fixed")), Effect.fork)
    yield* TestClock.adjust("100 millis")
    yield* Deferred.await(fastFinished)
    yield* TestClock.adjust("200 millis")
    const trials = yield* Fiber.join(fiber)
    expect(Arr.map(trials, (trial) => trial.state.value)).toEqual(Arr.make(
      { prefix: "fixed", config: 3, trialNumber: 0 },
      { prefix: "fixed", config: 1, trialNumber: 1 }
    ))
    expect(Arr.map(trials, (trial) => trial.state.duration)).toEqual(Arr.make(300, 100))
  }))

it.effect("propagates typed evaluator failure and interrupts sibling evaluation resources", () =>
  Effect.gen(function*() {
    const started = yield* Deferred.make<void>()
    const finalized = yield* Ref.make(false)
    const result = yield* Evaluation.run(
      Arr.make(0, 1),
      (input) =>
        Effect.if(Num.Equivalence(input, 0), {
          onTrue: () => Deferred.await(started).pipe(Effect.zipRight(Effect.fail(new Rejected({ input })))),
          onFalse: () =>
            Effect.acquireUseRelease(
              Deferred.succeed(started, undefined),
              () => Effect.never,
              () => Ref.set(finalized, true)
            )
        }),
      { concurrency: 2 }
    ).pipe(Effect.either)
    expect(result).toEqual(Either.left(new Rejected({ input: 0 })))
    expect(yield* Ref.get(finalized)).toBe(true)
  }))
