/**
 * MIPROv2 lifecycle interruption contract.
 */
import { expect, it } from "@effect/vitest"
import { Example } from "@scenesystems/effect-dsp/Example"
import * as Metric from "@scenesystems/effect-dsp/Metric"
import * as MIPROv2 from "@scenesystems/effect-dsp/MIPROv2"
import * as MockLanguageModel from "@scenesystems/effect-dsp/MockLanguageModel"
import * as Module from "@scenesystems/effect-dsp/Module"
import { ModuleParameters } from "@scenesystems/effect-dsp/ModuleParameters"
import * as Signature from "@scenesystems/effect-dsp/Signature"
import { Array as Arr, Boolean as Bool, Deferred, Effect, Fiber, Option, Ref, Schema, String as Str } from "effect"
import * as LanguageModel from "effect/ai/LanguageModel"
import { encodedSnapshot, expectInterruptedOnly } from "../kit/Interruption.js"
import { assertNoMutation } from "../kit/Mutation.js"

const trainset = Arr.make(
  new Example({ input: { question: "What is the capital of France?" }, labels: Option.some({ answer: "Paris" }) }),
  new Example({ input: { question: "What is the capital of Japan?" }, labels: Option.some({ answer: "Tokyo" }) })
)

it.effect("interruption during Phase 3 keeps the evaluated trial events, emits no completion and leaves the caller unchanged", () =>
  Effect.gen(function*() {
    const module = yield* Module.predict(
      "qa",
      yield* Signature.make("Baseline instruction", { question: Schema.String }, { answer: Schema.String })
    )
    yield* Module.install(module, {
      qa: new ModuleParameters({ instructions: "caller instructions", demos: [], outputStrategy: "structured" })
    })
    const before = yield* encodedSnapshot(module)
    const mock = yield* MockLanguageModel.make(
      MockLanguageModel.map((prompt) =>
        Bool.match(Str.includes("Return only ")(prompt), {
          onFalse: () => ({ answer: "Paris" }),
          onTrue: () => "Proposed instruction"
        })
      )
    )
    const trialSeen = yield* Ref.make(false)
    const blocked = yield* Deferred.make<void>()
    const observed = yield* Ref.make(Arr.empty<MIPROv2.Event>())
    // Scores normally until the first Phase-3 trial is reported, then blocks the next evaluation.
    const metric = Metric.withFeedback(() =>
      Ref.get(trialSeen).pipe(
        Effect.flatMap((seen) =>
          Bool.match(seen, {
            onFalse: () => Effect.succeed(new Metric.Score({ value: 1, feedback: Option.none() })),
            onTrue: () => Deferred.succeed(blocked, undefined).pipe(Effect.andThen(Effect.never))
          })
        )
      )
    )
    const fiber = yield* assertNoMutation(
      module,
      MIPROv2.runWithEvents(
        new MIPROv2.Options({
          module,
          trainset,
          valset: trainset,
          metric,
          numCandidates: 2,
          auto: Option.none(),
          minibatch: false,
          numTrials: 4,
          seed: 9
        }),
        (event) =>
          Ref.update(observed, Arr.append(event)).pipe(
            Effect.andThen(Ref.set(trialSeen, true).pipe(Effect.when(Effect.succeed(event._tag === "TrialEvaluated"))))
          )
      )
    ).pipe(Effect.provideService(LanguageModel.LanguageModel, mock.service), Effect.forkChild)
    yield* Deferred.await(blocked).pipe(
      Effect.raceFirst(Fiber.await(fiber).pipe(Effect.andThen(Effect.die("optimizer exited before a later trial"))))
    )
    yield* Fiber.interrupt(fiber)
    expectInterruptedOnly(yield* Fiber.await(fiber))
    const events = yield* Ref.get(observed)
    const tags = Arr.map(events, (event) => event._tag)
    expect(Arr.isReadonlyArrayNonEmpty(events)).toBe(true)
    expect(Arr.dedupe(tags)).toEqual([
      "Phase1Started",
      "DemoCandidate",
      "Phase1Completed",
      "Phase2Started",
      "InstructionProposed",
      "Phase2Completed",
      "Phase3Started",
      "TrialEvaluated"
    ])
    expect(
      Arr.map(Arr.filter(events, MIPROv2.events.$is("TrialEvaluated")), (trial) => ({
        trial: trial.trial,
        score: trial.score,
        fullValidation: trial.fullValidation
      }))
    ).toEqual([{ trial: 0, score: 1, fullValidation: true }])
    expect(Arr.filter(tags, (tag) => tag === "Phase3Completed" || tag === "FullEvalCompleted")).toEqual([])
    expect(yield* encodedSnapshot(module)).toEqual(before)
  }))
