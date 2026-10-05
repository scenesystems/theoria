/**
 * DspCache authority contract: resolve semantics, hit/miss behavior,
 * schema decode failure surfacing, and typed key composition.
 */
import { describe, expect, it } from "@effect/vitest"
import { Cache, layerMemory, Request } from "@scenesystems/effect-dsp/Cache"
import { Effect, Ref, Schema } from "effect"

describe("Cache authority contract", () => {
  it.effect("resolve returns miss + computed value on first call", () =>
    Effect.gen(function*() {
      const computeCount = yield* Ref.make(0)

      const cache = yield* Cache

      const { value, resolution } = yield* cache.resolve(
        new Request({
          moduleFingerprint: "qa-module",
          runtimeFingerprint: "runtime-v1",
          input: { question: "What is 2+2?" },
          params: { instructions: "Answer concisely", demos: [] },
          outputSchema: Schema.Struct({ answer: Schema.String }),
          compute: Ref.updateAndGet(computeCount, (n) => n + 1).pipe(
            Effect.as({ answer: "4" })
          )
        })
      )

      expect(value).toEqual({ answer: "4" })
      expect(resolution).toBe("miss")
      expect(yield* Ref.get(computeCount)).toBe(1)
    }).pipe(Effect.provide(layerMemory)))

  it.effect("resolve returns hit + cached value on second call, bypassing compute", () =>
    Effect.gen(function*() {
      const computeCount = yield* Ref.make(0)

      const cache = yield* Cache

      const request = new Request({
        moduleFingerprint: "qa-module",
        runtimeFingerprint: "runtime-v1",
        input: { question: "What is 2+2?" },
        params: { instructions: "Answer concisely", demos: [] },
        outputSchema: Schema.Struct({ answer: Schema.String }),
        compute: Ref.updateAndGet(computeCount, (n) => n + 1).pipe(
          Effect.as({ answer: "4" })
        )
      })

      yield* cache.resolve(request)
      const { value, resolution } = yield* cache.resolve(request)

      expect(value).toEqual({ answer: "4" })
      expect(resolution).toBe("hit")
      expect(yield* Ref.get(computeCount)).toBe(1)
    }).pipe(Effect.provide(layerMemory)))

  it.effect("different inputs produce different cache keys (miss on each)", () =>
    Effect.gen(function*() {
      const computeCount = yield* Ref.make(0)

      const cache = yield* Cache

      const makeRequest = (question: string) =>
        new Request({
          moduleFingerprint: "qa-module",
          runtimeFingerprint: "runtime-v1",
          input: { question },
          params: { instructions: "Answer concisely", demos: [] },
          outputSchema: Schema.Struct({ answer: Schema.String }),
          compute: Ref.updateAndGet(computeCount, (n) => n + 1).pipe(
            Effect.as({ answer: question })
          )
        })

      const { resolution: res1 } = yield* cache.resolve(makeRequest("What is 2+2?"))
      const { resolution: res2 } = yield* cache.resolve(makeRequest("What is 3+3?"))

      expect(res1).toBe("miss")
      expect(res2).toBe("miss")
      expect(yield* Ref.get(computeCount)).toBe(2)
    }).pipe(Effect.provide(layerMemory)))

  it.effect("different params produce different cache keys", () =>
    Effect.gen(function*() {
      const computeCount = yield* Ref.make(0)

      const cache = yield* Cache

      const makeRequest = (instructions: string) =>
        new Request({
          moduleFingerprint: "qa-module",
          runtimeFingerprint: "runtime-v1",
          input: { question: "What is 2+2?" },
          params: { instructions, demos: [] },
          outputSchema: Schema.Struct({ answer: Schema.String }),
          compute: Ref.updateAndGet(computeCount, (n) => n + 1).pipe(
            Effect.as({ answer: "4" })
          )
        })

      const { resolution: res1 } = yield* cache.resolve(makeRequest("Answer concisely"))
      const { resolution: res2 } = yield* cache.resolve(makeRequest("Be verbose"))

      expect(res1).toBe("miss")
      expect(res2).toBe("miss")
      expect(yield* Ref.get(computeCount)).toBe(2)
    }).pipe(Effect.provide(layerMemory)))

  it.effect("delegates to effect-search Cache for storage", () =>
    Effect.gen(function*() {
      const cache = yield* Cache

      const { value, resolution } = yield* cache.resolve(
        new Request({
          moduleFingerprint: "delegation-test",
          runtimeFingerprint: "v1",
          input: { x: 1 },
          params: { instructions: "test", demos: [] },
          outputSchema: Schema.Struct({ y: Schema.Finite }),
          compute: Effect.succeed({ y: 42 })
        })
      )

      expect(value).toEqual({ y: 42 })
      expect(resolution).toBe("miss")

      const { value: cached, resolution: cachedRes } = yield* cache.resolve(
        new Request({
          moduleFingerprint: "delegation-test",
          runtimeFingerprint: "v1",
          input: { x: 1 },
          params: { instructions: "test", demos: [] },
          outputSchema: Schema.Struct({ y: Schema.Finite }),
          compute: Effect.succeed({ y: 999 })
        })
      )

      expect(cached).toEqual({ y: 42 })
      expect(cachedRes).toBe("hit")
    }).pipe(Effect.provide(layerMemory)))
})
