import { expect, it } from "@effect/vitest"
import * as Module from "@scenesystems/effect-dsp/Module"
import { withInstructions } from "@scenesystems/effect-dsp/ModuleParameters"
import * as Signature from "@scenesystems/effect-dsp/Signature"
import { Array as Arr, Chunk, Deferred, Effect, Exit, Fiber, Ref, Schema } from "effect"
import * as LanguageModel from "effect/ai/LanguageModel"
import * as Response from "effect/ai/Response"
import { dataset } from "./Data.js"
import { recordingLm } from "./Lm.js"
import { countingMetric, failingOn, scriptedMetric } from "./Metric.js"
import { assertNoMutation } from "./Mutation.js"

it.effect("datasets replay stable ids and metrics count successful and failed attempts", () =>
  Effect.gen(function*() {
    const rows = yield* dataset(3, { labeled: true, seed: 7 })
    expect(rows).toEqual(yield* dataset(3, { labeled: true, seed: 7 }))
    expect(Arr.map(rows, (row) => row.input.id)).toEqual(["example-7-0", "example-7-1", "example-7-2"])
    expect(Arr.map(yield* dataset(2, { labeled: false, seed: 7 }), (row) => row.output)).toEqual([undefined, undefined])
    const counted = yield* countingMetric(scriptedMetric({ "example-7-0": 0.2, "example-7-1": 0.9 }))
    const results = yield* Effect.forEach(rows, (row) => counted.metric.score({}, row.output).pipe(Effect.exit))
    expect(yield* Ref.get(counted.calls)).toBe(3)
    expect(Arr.map(results, Exit.isSuccess)).toEqual([true, true, false])
    const score = yield* counted.metric.score({}, { id: "example-7-1" })
    expect(score.score).toBe(0.9)
    expect(Exit.isFailure(yield* failingOn(["example-7-0"]).score({}, { id: "example-7-0" }).pipe(Effect.exit))).toBe(
      true
    )
  }))

it.effect("records provider options in order before returning scripted text", () =>
  Effect.gen(function*() {
    const recorder = yield* recordingLm((_options, index) =>
      Effect.succeed([
        Response.TextPart.make({ text: `answer-${index}`, metadata: {} })
      ])
    )
    const replies = yield* Effect.forEach(["first", "second"], (prompt) =>
      LanguageModel.generateText({ prompt }).pipe(Effect.provide(recorder.layer)))
    expect(Arr.map(replies, (reply) =>
      reply.text)).toEqual(["answer-0", "answer-1"])
    const requests = Chunk.toReadonlyArray(yield* Ref.get(recorder.requests))
    expect(requests).toHaveLength(2)
    expect(Arr.map(requests, (request) => request.prompt)).not.toEqual([requests[1]?.prompt, requests[0]?.prompt])
  }))

it.effect("mutation guard checks reachable child refs on checked failure and interruption", () =>
  Effect.gen(function*() {
    const signature = yield* Signature.make("original", { question: Schema.String }, { answer: Schema.String })
    const child = yield* Module.predict("child", signature)
    const root = yield* Module.compose(
      new Module.ComposeOptions({
        name: "root",
        signature,
        subModules: { child },
        forward: ({ input }) => child.forward(input)
      })
    )
    const original = yield* Ref.get(child.params)
    const mutate = Ref.set(child.params, withInstructions(original, "changed"))
    const failed = yield* assertNoMutation(root, mutate.pipe(Effect.andThen(Effect.fail("checked")))).pipe(Effect.exit)
    expect(Exit.hasDies(failed)).toBe(true)
    yield* Ref.set(child.params, original)
    const started = yield* Deferred.make<void>()
    const fiber = yield* assertNoMutation(
      root,
      mutate.pipe(Effect.andThen(Deferred.succeed(started, undefined)), Effect.andThen(Effect.never))
    )
      .pipe(Effect.forkScoped)
    yield* Deferred.await(started)
    yield* Fiber.interrupt(fiber)
    const interrupted = yield* Fiber.await(fiber)
    expect(Exit.hasDies(interrupted)).toBe(true)
    yield* Ref.set(child.params, original)
    expect(yield* assertNoMutation(root, Effect.succeed("unchanged"))).toBe("unchanged")
  }))
