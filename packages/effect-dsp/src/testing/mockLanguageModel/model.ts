import * as AiError from "@effect/ai/AiError"
import type * as LanguageModel from "@effect/ai/LanguageModel"
import type { Effect, Ref } from "effect"
import { Data, Option, Schema } from "effect"

const MethodSchema = Schema.Literal("generateText", "generateObject")

export type Method = typeof MethodSchema.Type

export const mockError = (method: string, description: string, cause?: unknown): AiError.UnknownError =>
  new AiError.UnknownError({
    module: "MockLanguageModel",
    method,
    description,
    ...Option.match(Option.fromNullable(cause), {
      onNone: () => ({}),
      onSome: (value) => ({ cause: value })
    })
  })

/**
 * A recorded method call against the mock language model — captures the method
 * (`generateText` or `generateObject`) and the rendered prompt text.
 *
 * @since 0.1.0
 * @category models
 */
export class MockCall extends Schema.Class<MockCall>("MockCall")({
  method: MethodSchema,
  prompt: Schema.String
}) {}

class FixedResponseStrategy extends Data.TaggedClass("Fixed")<{
  readonly response: unknown
}> {}

class MappedResponseStrategy extends Data.TaggedClass("Map")<{
  readonly resolve: (prompt: string) => unknown
}> {}

class SequenceResponseStrategy extends Data.TaggedClass("Sequence")<{
  readonly responses: ReadonlyArray<unknown>
}> {}

class FunctionResponseStrategy extends Data.TaggedClass("Function")<{
  readonly resolve: (prompt: string) => Effect.Effect<unknown, unknown, never>
}> {}

class FailingResponseStrategy extends Data.TaggedClass("Failing")<{
  readonly error: unknown
}> {}

/**
 * Discriminated union of response strategies that determine mock behavior. Each
 * variant controls how the mock resolves a prompt to a response.
 *
 * @since 0.1.0
 * @category models
 */
export type ResponseStrategy =
  | FixedResponseStrategy
  | MappedResponseStrategy
  | SequenceResponseStrategy
  | FunctionResponseStrategy
  | FailingResponseStrategy

/**
 * Tagged-enum constructors for response strategy variants.
 *
 * @since 0.1.0
 * @category constructors
 */
export const ResponseStrategy = Data.taggedEnum<ResponseStrategy>()

/**
 * Runtime handle returned by `MockLanguageModel.make` — provides the mock
 * service and a ref of recorded calls for assertions.
 *
 * @since 0.1.0
 * @category models
 */
export class MockLanguageModelRuntime extends Data.TaggedClass("MockLanguageModelRuntime")<{
  readonly service: LanguageModel.Service
  readonly calls: Ref.Ref<ReadonlyArray<MockCall>>
}> {}
