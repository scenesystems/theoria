/**
 * BootstrapFewShot teacher/student layer routing contracts.
 */
import * as LanguageModel from "@effect/ai/LanguageModel"
import { describe, expect, it } from "@effect/vitest"
import { Effect, Layer, Ref } from "effect"
import { ModuleParams } from "effect-dsp/contracts"
import { Example } from "effect-dsp/Example"
import * as Metric from "effect-dsp/Metric"
import * as Module from "effect-dsp/Module"
import * as Optimizer from "effect-dsp/Optimizer"
import { MockLanguageModel } from "effect-dsp/test"
import { conciseFactsQaSignature } from "../../helpers/qa-signatures.js"

describe("Optimizer.bootstrapFewShot teacher/student", () => {
  it.effect("uses teacher layer for bootstrap traces while leaving student/default LM for inference", () =>
    Effect.gen(function*() {
      const signature = yield* conciseFactsQaSignature
      const module = yield* Module.predict("qa", signature)
      const initialParams = yield* Ref.get(module.params)

      yield* Ref.set(
        module.params,
        new ModuleParams({
          instructions: initialParams.instructions,
          demos: initialParams.demos,
          outputStrategy: "structured"
        })
      )

      const teacher = yield* MockLanguageModel.make(
        MockLanguageModel.fixed({ answer: "Paris" })
      )
      const student = yield* MockLanguageModel.make(
        MockLanguageModel.fixed({ answer: "London" })
      )

      const teacherLayer = Layer.succeed(LanguageModel.LanguageModel, teacher.service)
      const studentLayer = Layer.succeed(LanguageModel.LanguageModel, student.service)

      const optimized = yield* Optimizer.bootstrapFewShot({
        module,
        trainset: [
          new Example({
            input: { question: "What is the capital of France?" },
            output: { answer: "Paris" }
          })
        ],
        metric: Metric.exactMatch("answer"),
        maxRounds: 2,
        maxBootstrappedDemos: 1,
        threshold: 1,
        fallbackToLabeledFewShot: false,
        teacher: teacherLayer
      }).pipe(Effect.provide(studentLayer))

      const paramsAfterBootstrap = yield* Ref.get(optimized.params)
      const teacherCallsAfterBootstrap = yield* Ref.get(teacher.calls)
      const studentCallsAfterBootstrap = yield* Ref.get(student.calls)

      expect(paramsAfterBootstrap.demos).toHaveLength(1)
      expect(paramsAfterBootstrap.demos[0]?.output).toEqual({ answer: "Paris" })
      expect(teacherCallsAfterBootstrap).toHaveLength(1)
      expect(studentCallsAfterBootstrap).toHaveLength(0)

      const studentInference = yield* optimized.forward({
        question: "What is the capital of France?"
      }).pipe(Effect.provide(studentLayer))

      const teacherCallsAfterInference = yield* Ref.get(teacher.calls)
      const studentCallsAfterInference = yield* Ref.get(student.calls)

      expect(studentInference).toEqual({ answer: "London" })
      expect(teacherCallsAfterInference).toHaveLength(1)
      expect(studentCallsAfterInference).toHaveLength(1)
    }))
})
