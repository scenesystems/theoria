import { expect, it } from "@effect/vitest"
import { Effect, Result, Schema } from "effect"

import * as PersistenceError from "@scenesystems/effect-study/PersistenceError"
import * as StudyStorage from "@scenesystems/effect-study/StudyStorage"

it.effect("distinguishes codec failures from backend failures without requiring filesystem paths", () =>
  Effect.gen(function*() {
    const storage = yield* StudyStorage.makeMemory
    const result = yield* storage.appendTrial(Schema.NonEmptyString, "").pipe(Effect.result)
    const failure = yield* Effect.fromResult(Result.flip(result))
    expect(failure.reason).toBe("Codec")
    expect(failure.operation).toBe("write")
    const backend = new PersistenceError.Failure({
      operation: "write",
      reason: "Backend",
      detail: "transaction rejected"
    })
    expect(yield* Schema.decodeEffect(PersistenceError.Failure)(backend)).toEqual(backend)
  }))
