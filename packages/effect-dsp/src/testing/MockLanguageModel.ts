/**
 * Deterministic `LanguageModel` test harness — fixed, mapped, sequenced, and
 * failing response strategies for unit tests.
 *
 * @since 0.1.0
 */
import type * as LanguageModel from "@effect/ai/LanguageModel"
import { Effect, Layer, Ref } from "effect"

import { MockCall, MockLanguageModelRuntime, ResponseStrategy } from "./mockLanguageModel/model.js"
import { MockLanguageModelService } from "./mockLanguageModel/service.js"

export { MockCall, MockLanguageModelRuntime, ResponseStrategy }

/**
 * Public API for creating deterministic `LanguageModel` test services.
 *
 * @example
 * ```ts
 * import { MockLanguageModel } from "effect-dsp/testing"
 * import * as LanguageModel from "@effect/ai/LanguageModel"
 * import { Effect, Layer } from "effect"
 *
 * const testLayer = MockLanguageModel.layer(
 *   LanguageModel.LanguageModel,
 *   MockLanguageModel.fixed({ answer: "Paris" })
 * )
 * ```
 *
 * @since 0.1.0
 * @category constructors
 */
export const MockLanguageModel = {
  fixed: (response: unknown): ResponseStrategy => ResponseStrategy.Fixed({ response }),
  map: (resolve: (prompt: string) => unknown): ResponseStrategy => ResponseStrategy.Map({ resolve }),
  sequence: (responses: ReadonlyArray<unknown>): ResponseStrategy => ResponseStrategy.Sequence({ responses }),
  fromFunction: (
    resolve: (prompt: string) => Effect.Effect<unknown, unknown, never>
  ): ResponseStrategy => ResponseStrategy.Function({ resolve }),
  failing: (error: unknown): ResponseStrategy => ResponseStrategy.Failing({ error }),
  make: (strategy: ResponseStrategy): Effect.Effect<MockLanguageModelRuntime> =>
    Effect.gen(function*() {
      const calls = yield* Ref.make<ReadonlyArray<MockCall>>([])
      const sequenceIndex = yield* Ref.make(0)
      const service = yield* MockLanguageModelService.make(strategy, calls, sequenceIndex)

      return new MockLanguageModelRuntime({
        service,
        calls
      })
    }),
  layer: (
    tag: typeof LanguageModel.LanguageModel,
    strategy: ResponseStrategy
  ) =>
    Layer.effect(
      tag,
      MockLanguageModel.make(strategy).pipe(
        Effect.map((runtime) => runtime.service)
      )
    )
}
