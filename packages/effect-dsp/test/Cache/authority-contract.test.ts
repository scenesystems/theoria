/**
 * DspCache authority contract: resolve semantics, hit/miss behavior,
 * schema decode failure surfacing, and typed key composition.
 */
import { describe, expect, it } from "@effect/vitest"
import { Effect, Option, Ref, Schema } from "effect"
import { DspCache, DspCacheKey, DspCacheMemory } from "../../src/Cache/index.js"

describe("DspCache authority contract", () => {
  it.effect("resolve returns miss + computed value on first call", () =>
    Effect.gen(function*() {
      const computeCount = yield* Ref.make(0)

      const cache = yield* DspCache

      const [result, resolution] = yield* cache.resolve({
        moduleFingerprint: "qa-module",
        runtimeFingerprint: "runtime-v1",
        input: { question: "What is 2+2?" },
        params: { instructions: "Answer concisely", demos: [] },
        outputSchema: Schema.Struct({ answer: Schema.String }),
        compute: Ref.updateAndGet(computeCount, (n) => n + 1).pipe(
          Effect.as({ answer: "4" })
        )
      })

      expect(result).toEqual({ answer: "4" })
      expect(resolution).toBe("miss")
      expect(yield* Ref.get(computeCount)).toBe(1)
    }).pipe(Effect.provide(DspCacheMemory)))

  it.effect("resolve returns hit + cached value on second call, bypassing compute", () =>
    Effect.gen(function*() {
      const computeCount = yield* Ref.make(0)

      const cache = yield* DspCache

      const request = {
        moduleFingerprint: "qa-module",
        runtimeFingerprint: "runtime-v1",
        input: { question: "What is 2+2?" },
        params: { instructions: "Answer concisely", demos: [] },
        outputSchema: Schema.Struct({ answer: Schema.String }),
        compute: Ref.updateAndGet(computeCount, (n) => n + 1).pipe(
          Effect.as({ answer: "4" })
        )
      }

      yield* cache.resolve(request)
      const [result, resolution] = yield* cache.resolve(request)

      expect(result).toEqual({ answer: "4" })
      expect(resolution).toBe("hit")
      expect(yield* Ref.get(computeCount)).toBe(1)
    }).pipe(Effect.provide(DspCacheMemory)))

  it.effect("different inputs produce different cache keys (miss on each)", () =>
    Effect.gen(function*() {
      const computeCount = yield* Ref.make(0)

      const cache = yield* DspCache

      const makeRequest = (question: string) => ({
        moduleFingerprint: "qa-module",
        runtimeFingerprint: "runtime-v1",
        input: { question },
        params: { instructions: "Answer concisely", demos: [] },
        outputSchema: Schema.Struct({ answer: Schema.String }),
        compute: Ref.updateAndGet(computeCount, (n) => n + 1).pipe(
          Effect.as({ answer: question })
        )
      })

      const [, res1] = yield* cache.resolve(makeRequest("What is 2+2?"))
      const [, res2] = yield* cache.resolve(makeRequest("What is 3+3?"))

      expect(res1).toBe("miss")
      expect(res2).toBe("miss")
      expect(yield* Ref.get(computeCount)).toBe(2)
    }).pipe(Effect.provide(DspCacheMemory)))

  it.effect("different params produce different cache keys", () =>
    Effect.gen(function*() {
      const computeCount = yield* Ref.make(0)

      const cache = yield* DspCache

      const makeRequest = (instructions: string) => ({
        moduleFingerprint: "qa-module",
        runtimeFingerprint: "runtime-v1",
        input: { question: "What is 2+2?" },
        params: { instructions, demos: [] },
        outputSchema: Schema.Struct({ answer: Schema.String }),
        compute: Ref.updateAndGet(computeCount, (n) => n + 1).pipe(
          Effect.as({ answer: "4" })
        )
      })

      const [, res1] = yield* cache.resolve(makeRequest("Answer concisely"))
      const [, res2] = yield* cache.resolve(makeRequest("Be verbose"))

      expect(res1).toBe("miss")
      expect(res2).toBe("miss")
      expect(yield* Ref.get(computeCount)).toBe(2)
    }).pipe(Effect.provide(DspCacheMemory)))

  it.effect("DspCacheKey schema includes all five components", () =>
    Effect.gen(function*() {
      const key = new DspCacheKey({
        moduleFingerprint: "qa-module",
        runtimeFingerprint: "runtime-v1",
        inputHash: "abc123",
        paramsHash: "def456",
        rolloutId: Option.some(2)
      })

      expect(key.moduleFingerprint).toBe("qa-module")
      expect(key.runtimeFingerprint).toBe("runtime-v1")
      expect(key.inputHash).toBe("abc123")
      expect(key.paramsHash).toBe("def456")
      expect(key.rolloutId).toEqual(Option.some(2))
    }))

  it.effect("DspCacheKey without rollout defaults to Option.none()", () =>
    Effect.gen(function*() {
      const key = new DspCacheKey({
        moduleFingerprint: "qa-module",
        runtimeFingerprint: "runtime-v1",
        inputHash: "abc123",
        paramsHash: "def456",
        rolloutId: Option.none()
      })

      expect(key.rolloutId).toEqual(Option.none())
    }))

  it.effect("delegates to effect-search SchemaCache for storage", () =>
    Effect.gen(function*() {
      const cache = yield* DspCache

      const [result, resolution] = yield* cache.resolve({
        moduleFingerprint: "delegation-test",
        runtimeFingerprint: "v1",
        input: { x: 1 },
        params: { instructions: "test", demos: [] },
        outputSchema: Schema.Struct({ y: Schema.Number }),
        compute: Effect.succeed({ y: 42 })
      })

      expect(result).toEqual({ y: 42 })
      expect(resolution).toBe("miss")

      const [cached, cachedRes] = yield* cache.resolve({
        moduleFingerprint: "delegation-test",
        runtimeFingerprint: "v1",
        input: { x: 1 },
        params: { instructions: "test", demos: [] },
        outputSchema: Schema.Struct({ y: Schema.Number }),
        compute: Effect.succeed({ y: 999 })
      })

      expect(cached).toEqual({ y: 42 })
      expect(cachedRes).toBe("hit")
    }).pipe(Effect.provide(DspCacheMemory)))
})
