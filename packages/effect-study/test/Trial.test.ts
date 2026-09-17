import { expect, it } from "@effect/vitest"
import { Array as Arr, Effect, Either, Equal, Schema } from "effect"

import * as Trial from "@scenesystems/effect-study/Trial"

const Observation = Schema.Struct({ labels: Schema.Array(Schema.String), accepted: Schema.Boolean })
const Result = Trial.Trial(Schema.NumberFromString, Trial.Completed(Observation))

it.effect("round-trips typed inputs and structured observations without a numeric objective", () =>
  Effect.gen(function*() {
    const trial = yield* Schema.decode(Result)({
      trialNumber: 3,
      config: "17",
      state: { _tag: "Completed", value: { labels: Arr.make("a", "b"), accepted: false }, duration: 42 },
      cost: 2.5,
      prior: true
    })
    expect(trial.config).toBe(17)
    expect(trial.state.value).toEqual({ labels: Arr.make("a", "b"), accepted: false })
    const encoded = yield* Schema.encode(Result)(trial)
    expect(encoded.config).toBe("17")
    expect(encoded.cost).toBe(2.5)
    expect(encoded.prior).toBe(true)
    const rejected = yield* Schema.decodeUnknown(Result)({
      trialNumber: 3,
      config: "17",
      state: { _tag: "Completed", value: 0, duration: 42 }
    }).pipe(Effect.either)
    expect(Either.isLeft(rejected)).toBe(true)
  }))

it.effect("owns generic running, completion, failure, and cancellation transitions", () =>
  Effect.sync(() => {
    const running = Trial.makeRunning(5, "input", 100)
    const completed = Trial.complete(running, Observation.make({ labels: Arr.of("ok"), accepted: true }), 145)
    const failed = Trial.fail(running, "rejected", 160)
    const cancelled = Trial.cancel(running)

    expect(completed.state).toEqual({
      _tag: "Completed",
      value: { labels: Arr.of("ok"), accepted: true },
      duration: 45
    })
    expect(failed.state).toEqual({ _tag: "Failed", error: "rejected", duration: 60 })
    expect(cancelled.state).toEqual({ _tag: "Cancelled" })
  }))

it.effect("gives independently constructed trial states structural data equality", () =>
  Effect.sync(() => {
    const first = Trial.complete(Trial.makeRunning(5, "input", 100), "observed", 145)
    const second = Trial.complete(Trial.makeRunning(5, "input", 100), "observed", 145)

    expect(Equal.equals(first, second)).toBe(true)
    expect(Equal.equals(first.state, second.state)).toBe(true)
  }))
