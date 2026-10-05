import { expect, it } from "@effect/vitest"
import { Deferred, Effect, Fiber, Record, Schema } from "effect"
import * as Module from "../../src/Module.js"
import { withInstructions } from "../../src/ModuleParameters.js"
import * as ParameterSet from "../../src/ParameterSet.js"
import * as Signature from "../../src/Signature.js"
import { assertNoMutation } from "../kit/Mutation.js"

it.effect("discards an interrupted overlay and installs only on explicit request", () =>
  Effect.gen(function*() {
    const signature = yield* Signature.make("Answer", { question: Schema.String }, { answer: Schema.String })
    const leaf = yield* Module.predict("generate", signature)
    const before = yield* ParameterSet.snapshot(leaf)
    const candidate = Record.map(before, (parameters) => withInstructions(parameters, "candidate"))
    const entered = yield* Deferred.make<void>()
    const fiber = yield* assertNoMutation(
      leaf,
      Effect.gen(function*() {
        expect(yield* ParameterSet.snapshot(leaf)).toEqual(candidate)
        yield* Deferred.succeed(entered, void 0)
        return yield* Effect.never
      }).pipe(Module.withParameters(candidate))
    ).pipe(Effect.forkChild)
    yield* Deferred.await(entered)
    yield* Fiber.interrupt(fiber)
    expect(yield* ParameterSet.snapshot(leaf)).toEqual(before)
    expect(yield* ParameterSet.snapshot(Module.bound(leaf, candidate))).toEqual(candidate)
    yield* Module.install(leaf, candidate)
    expect(yield* ParameterSet.snapshot(leaf)).toEqual(candidate)
  }))
