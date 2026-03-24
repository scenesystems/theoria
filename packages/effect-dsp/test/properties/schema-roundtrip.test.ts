/**
 * Schema encode/decode round-trip invariants for Module.SavedState.
 */
import { describe, expect, it } from "@effect/vitest"
import { Array as Arr, Effect, Match, Option, Schema } from "effect"
import { ModuleParams } from "effect-dsp/contracts"
import { Demo } from "effect-dsp/Example"
import * as Module from "effect-dsp/Module"
import fc from "fast-check"

const primitiveUnknownArbitrary = fc.oneof(
  fc.string({ maxLength: 12 }),
  fc.integer({ min: -10, max: 10 }),
  fc.boolean()
)

const unknownRecordArbitrary = fc.dictionary(fc.string({ minLength: 1, maxLength: 8 }), primitiveUnknownArbitrary)

const moduleParamsArbitrary = fc.record({
  instructions: fc.string({ minLength: 1, maxLength: 48 }),
  demos: fc.array(
    fc.record({
      input: unknownRecordArbitrary,
      output: unknownRecordArbitrary
    }),
    { minLength: 0, maxLength: 3 }
  ),
  outputStrategy: fc.option(fc.constantFrom("auto", "text", "structured"), { nil: undefined }),
  temperature: fc.option(fc.double({ min: 0, max: 2, noNaN: true }), { nil: undefined }),
  maxTokens: fc.option(fc.integer({ min: 1, max: 1024 }), { nil: undefined })
})

const toModuleParams = (params: {
  readonly instructions: string
  readonly demos: ReadonlyArray<{ readonly input: Record<string, unknown>; readonly output: Record<string, unknown> }>
  readonly outputStrategy: unknown
  readonly temperature: unknown
  readonly maxTokens: unknown
}): ModuleParams =>
  new ModuleParams({
    instructions: params.instructions,
    demos: Arr.map(params.demos, (demo) => new Demo({ input: demo.input, output: demo.output })),
    ...Option.match(
      Match.value(params.outputStrategy).pipe(
        Match.when("auto", () => Option.some<"auto">("auto")),
        Match.when("text", () => Option.some<"text">("text")),
        Match.when("structured", () => Option.some<"structured">("structured")),
        Match.orElse(() => Option.none<"auto" | "text" | "structured">())
      ),
      {
        onNone: () => ({}),
        onSome: (outputStrategy) => ({ outputStrategy })
      }
    ),
    ...Option.match(
      Match.value(params.temperature).pipe(
        Match.when((value: unknown): value is number => typeof value === "number", (temperature) =>
          Option.some(temperature)),
        Match.orElse(() =>
          Option.none<number>()
        )
      ),
      {
        onNone: () => ({}),
        onSome: (temperature) => ({ temperature })
      }
    ),
    ...Option.match(
      Match.value(params.maxTokens).pipe(
        Match.when(
          (value: unknown): value is number => typeof value === "number",
          (maxTokens) => Option.some(maxTokens)
        ),
        Match.orElse(() => Option.none<number>())
      ),
      {
        onNone: () => ({}),
        onSome: (maxTokens) => ({ maxTokens })
      }
    )
  })

describe("Module.SavedState schema round-trip", () => {
  it.effect("preserves value identity through encode/decode", () =>
    Effect.gen(function*() {
      const samples = fc.sample(
        fc.record({
          modules: fc.array(moduleParamsArbitrary, { minLength: 1, maxLength: 4 }),
          metadata: fc.option(unknownRecordArbitrary, { nil: undefined })
        }),
        { numRuns: 75 }
      )

      yield* Effect.forEach(samples, (sample) =>
        Effect.gen(function*() {
          const modules = Arr.map(sample.modules, (params, index) => ({
            name: `module-${index + 1}`,
            params: toModuleParams(params)
          }))
          const state = new Module.SavedState({
            version: 1,
            modules,
            ...Option.match(Option.fromNullable(sample.metadata), {
              onNone: () => ({}),
              onSome: (metadata) => ({ metadata })
            })
          })
          const encoded = yield* Schema.encode(Module.SavedState)(state)
          const decoded = yield* Schema.decode(Module.SavedState)(encoded)

          expect(decoded).toEqual(state)
        }), { concurrency: 1, discard: true })
    }))
})
