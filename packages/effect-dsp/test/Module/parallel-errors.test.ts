/**
 * Module.parallel failure-policy contracts.
 */
import * as LanguageModel from "@effect/ai/LanguageModel"
import { describe, expect, it } from "@effect/vitest"
import { Cause, Effect, Exit, Layer, Option, Ref, Schema } from "effect"
import { ParallelExecutionError } from "effect-dsp/Errors"
import * as Module from "effect-dsp/Module"
import * as Signature from "effect-dsp/Signature"
import { MockLanguageModel } from "effect-dsp/test"

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

const failureFromExit = (exit: Exit.Exit<unknown, unknown>) =>
  Exit.match(exit, {
    onSuccess: () => Option.none<unknown>(),
    onFailure: (cause) => Cause.failureOption(cause)
  })

describe("Module.parallel failure policies", () => {
  it.effect("keeps branch failures typed and makes the failure policy explicit", () =>
    Effect.gen(function*() {
      const signature = yield* makeQaSignature()
      const inner = yield* Module.predict("qa-parallel-errors-inner", signature)
      const failFastIndex = yield* Ref.make(0)

      const failFastMock = yield* MockLanguageModel.make(
        MockLanguageModel.fromFunction(() =>
          Ref.updateAndGet(failFastIndex, (index) => index + 1).pipe(
            Effect.flatMap((callIndex) =>
              callIndex === 2
                ? Effect.fail("beta-failed")
                : Effect.succeed({ answer: callIndex === 1 ? "A" : "C" })
            )
          )
        )
      )
      const failFast = yield* Module.parallel({
        name: "qa-parallel-fail-fast",
        module: inner,
        concurrency: 1,
        failurePolicy: "fail-fast"
      })
      const failFastLayer = Layer.succeed(LanguageModel.LanguageModel, failFastMock.service)
      const failFastExit = yield* Effect.exit(
        failFast.forward({
          inputs: [
            { question: "Alpha question" },
            { question: "Beta question" },
            { question: "Gamma question" }
          ]
        }).pipe(Effect.provide(failFastLayer))
      )
      const failFastCalls = yield* Ref.get(failFastMock.calls)

      expect(Exit.isFailure(failFastExit)).toBe(true)
      const failFastFailure = failureFromExit(failFastExit)
      expect(Option.isSome(failFastFailure)).toBe(true)
      if (Option.isSome(failFastFailure)) {
        const failure = failFastFailure.value
        expect(failure).toBeInstanceOf(ParallelExecutionError)
        if (failure instanceof ParallelExecutionError) {
          expect(failure.failurePolicy).toBe("fail-fast")
          expect(failure.failures).toHaveLength(1)
          expect(failure.failures[0]?.branchIndex).toBe(1)
        }
      }
      expect(failFastCalls).toHaveLength(1)

      const collectAllIndex = yield* Ref.make(0)
      const collectAllMock = yield* MockLanguageModel.make(
        MockLanguageModel.fromFunction(() =>
          Ref.updateAndGet(collectAllIndex, (index) => index + 1).pipe(
            Effect.flatMap((callIndex) =>
              callIndex === 1
                ? Effect.succeed({ answer: "A" })
                : Effect.fail("branch-failed")
            )
          )
        )
      )
      const collectAll = yield* Module.parallel({
        name: "qa-parallel-collect-all",
        module: inner,
        concurrency: 2,
        failurePolicy: "collect-all"
      })
      const collectAllLayer = Layer.succeed(LanguageModel.LanguageModel, collectAllMock.service)
      const collectAllExit = yield* Effect.exit(
        collectAll.forward({
          inputs: [
            { question: "Alpha question" },
            { question: "Beta question" },
            { question: "Gamma question" }
          ]
        }).pipe(Effect.provide(collectAllLayer))
      )
      const collectAllCalls = yield* Ref.get(collectAllMock.calls)

      expect(Exit.isFailure(collectAllExit)).toBe(true)
      const collectAllFailure = failureFromExit(collectAllExit)
      expect(Option.isSome(collectAllFailure)).toBe(true)
      if (Option.isSome(collectAllFailure)) {
        const failure = collectAllFailure.value
        expect(failure).toBeInstanceOf(ParallelExecutionError)
        if (failure instanceof ParallelExecutionError) {
          expect(failure.failurePolicy).toBe("collect-all")
          expect(failure.failures).toHaveLength(2)
        }
      }
      expect(collectAllCalls).toHaveLength(1)
    }))
})
