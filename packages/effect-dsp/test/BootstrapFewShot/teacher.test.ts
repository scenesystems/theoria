/**
 * BootstrapFewShot teacher/student layer routing contracts.
 */
import { describe, expect, it } from "@effect/vitest"
import * as BootstrapFewShot from "@scenesystems/effect-dsp/BootstrapFewShot"
import { Example } from "@scenesystems/effect-dsp/Example"
import * as Metric from "@scenesystems/effect-dsp/Metric"
import * as MockLanguageModel from "@scenesystems/effect-dsp/MockLanguageModel"
import * as Module from "@scenesystems/effect-dsp/Module"
import { ModuleParameters } from "@scenesystems/effect-dsp/ModuleParameters"
import * as Signature from "@scenesystems/effect-dsp/Signature"
import * as ModelBinder from "@scenesystems/effect-lm/ModelBinder"
import { Boolean as Bool, Effect, Layer, Option, Record, Ref, Schema } from "effect"
import * as LanguageModel from "effect/ai/LanguageModel"

const makeQaSignature = () =>
  Signature.make(
    "Answer questions with concise facts",
    {
      question: Signature.describe(Schema.String, "The question to answer")
    },
    {
      answer: Signature.describe(Schema.String, "A concise factual answer")
    }
  )

describe("BootstrapFewShot.run teacher/student", () => {
  it.effect("uses teacher layer for bootstrap traces while leaving student/default LM for inference", () =>
    Effect.gen(function*() {
      const signature = yield* makeQaSignature()
      const module = yield* Module.predict("qa", signature)
      const initialParameters = yield* Ref.get(module.parameters)

      yield* Ref.set(
        module.parameters,
        new ModuleParameters({
          instructions: initialParameters.instructions,
          demos: initialParameters.demos,
          outputStrategy: "structured"
        })
      )

      const teacher = yield* MockLanguageModel.make(
        MockLanguageModel.succeed({ answer: "Paris" })
      )
      const student = yield* MockLanguageModel.make(
        MockLanguageModel.succeed({ answer: "London" })
      )

      const studentLayer = Layer.succeed(LanguageModel.LanguageModel, student.service)

      const optimized = yield* BootstrapFewShot.run(
        new BootstrapFewShot.Options({
          module,
          trainset: [
            new Example({
              input: { question: "What is the capital of France?" },
              labels: Option.some({ answer: "Paris" })
            })
          ],
          metric: Metric.exactMatch("answer"),
          maxRounds: 2,
          maxBootstrappedDemos: 1,
          metricThreshold: Option.some(1),
          maxLabeledDemos: 0
        })
      ).pipe(
        ModelBinder.withBinder(
          new ModelBinder.Binder({
            bind: (request) => (effect) =>
              effect.pipe(
                Effect.provideService(
                  LanguageModel.LanguageModel,
                  Bool.match(request.role === "teacher", {
                    onFalse: () => student.service,
                    onTrue: () => teacher.service
                  })
                )
              )
          })
        ),
        Effect.provide(studentLayer)
      )

      const parametersAfterBootstrap = Option.getOrThrow(Record.get(optimized.parameters, "qa"))
      const teacherCallsAfterBootstrap = yield* Ref.get(teacher.calls)
      const studentCallsAfterBootstrap = yield* Ref.get(student.calls)

      expect(parametersAfterBootstrap.demos).toHaveLength(1)
      expect(parametersAfterBootstrap.demos[0]?.output).toEqual({ answer: "Paris" })
      expect(teacherCallsAfterBootstrap).toHaveLength(1)
      expect(studentCallsAfterBootstrap).toHaveLength(0)

      const studentInference = yield* optimized.program.forward({
        question: "What is the capital of France?"
      }).pipe(Effect.provide(studentLayer))

      const teacherCallsAfterInference = yield* Ref.get(teacher.calls)
      const studentCallsAfterInference = yield* Ref.get(student.calls)

      expect(studentInference).toEqual({ answer: "London" })
      expect(teacherCallsAfterInference).toHaveLength(1)
      expect(studentCallsAfterInference).toHaveLength(1)
    }))
})
