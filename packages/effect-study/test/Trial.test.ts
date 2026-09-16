import { expect, it } from "@effect/vitest"
import { Array as Arr, Effect, Either, Schema } from "effect"

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
