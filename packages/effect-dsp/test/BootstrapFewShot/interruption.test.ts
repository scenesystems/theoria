/**
 * BootstrapFewShot lifecycle interruption contract.
 */
import { expect, it } from "@effect/vitest"
import * as BootstrapFewShot from "@scenesystems/effect-dsp/BootstrapFewShot"
import { Demonstration } from "@scenesystems/effect-dsp/Demonstration"
import { Example } from "@scenesystems/effect-dsp/Example"
import * as Metric from "@scenesystems/effect-dsp/Metric"
import * as MockLanguageModel from "@scenesystems/effect-dsp/MockLanguageModel"
import * as Module from "@scenesystems/effect-dsp/Module"
import { ModuleParameters } from "@scenesystems/effect-dsp/ModuleParameters"
import * as Signature from "@scenesystems/effect-dsp/Signature"
import { Array as Arr, Boolean as Bool, Deferred, Effect, Fiber, Option, Ref, Schema, String as Str } from "effect"
import * as LanguageModel from "effect/ai/LanguageModel"
import { encodedSnapshot, expectInterruptedOnly } from "../kit/Interruption.js"
import { assertNoMutation } from "../kit/Mutation.js"

const Question = Schema.Struct({ question: Schema.String })

it.effect("interruption after one accepted trace keeps partial events, emits no completion and leaves the caller unchanged", () =>
  Effect.gen(function*() {
    const module = yield* Module.predict(
      "qa",
      yield* Signature.make("Answer", Question.fields, { answer: Schema.String })
    )
    yield* Module.install(module, {
      qa: new ModuleParameters({
        instructions: "caller instructions",
        demos: [new Demonstration({ input: { question: "caller" }, output: { answer: "caller demo" } })],
        outputStrategy: "structured"
      })
    })
    const before = yield* encodedSnapshot(module)
    const mock = yield* MockLanguageModel.make(MockLanguageModel.succeed({ answer: "teacher" }))
    const blocked = yield* Deferred.make<void>()
    const observed = yield* Ref.make(Arr.empty<BootstrapFewShot.Event>())
    // Row "a" is accepted; scoring row "b" blocks until the test interrupts the optimizer.
    const metric = Metric.withFeedback((example) =>
      Schema.decodeUnknownEffect(Question)(example.input).pipe(
        Effect.flatMap(({ question }) =>
          Bool.match(Str.Equivalence(question, "a"), {
            onTrue: () => Effect.succeed(new Metric.Score({ value: 1, feedback: Option.none() })),
            onFalse: () => Deferred.succeed(blocked, undefined).pipe(Effect.andThen(Effect.never))
          })
        )
      )
    )
    const fiber = yield* assertNoMutation(
      module,
      BootstrapFewShot.runWithEvents(
        new BootstrapFewShot.Options({
          module,
          trainset: Arr.map(["a", "b"], (question) => new Example({ input: { question } })),
          metric,
          maxRounds: 1,
          maxBootstrappedDemos: 2,
          maxLabeledDemos: 0
        }),
        (event) => Ref.update(observed, Arr.append(event))
      )
    ).pipe(Effect.provideService(LanguageModel.LanguageModel, mock.service), Effect.forkChild)
    yield* Deferred.await(blocked).pipe(
      Effect.raceFirst(Fiber.await(fiber).pipe(Effect.andThen(Effect.die("optimizer exited before scoring row b"))))
    )
    yield* Fiber.interrupt(fiber)
    expectInterruptedOnly(yield* Fiber.await(fiber))
    expect(yield* Ref.get(observed)).toEqual([
      BootstrapFewShot.events.RoundStarted({ round: 1, maxRounds: 1 }),
      BootstrapFewShot.events.TraceAccepted({ moduleName: "qa", score: 1 })
    ])
    expect(Arr.filter(yield* Ref.get(observed), BootstrapFewShot.events.$is("BootstrapCompleted"))).toEqual([])
    expect(yield* encodedSnapshot(module)).toEqual(before)
    expect(yield* Ref.get(mock.calls)).toHaveLength(2)
  }))
