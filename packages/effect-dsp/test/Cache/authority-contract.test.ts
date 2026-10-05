/**
 * DspCache authority contract: resolve semantics, hit/miss behavior,
 * schema decode failure surfacing, and typed key composition.
 */
import { describe, expect, it } from "@effect/vitest"
import { ContentDigest, Utf8 } from "@scenesystems/digest"
import { Cache, Key, key, KeyRequest, layerMemory, Request } from "@scenesystems/effect-dsp/Cache"
import { Effect, Option, Ref, Schema } from "effect"

describe("Cache authority contract", () => {
  it.effect("identifies the selected input and parameter wire representations, not incidental fields", () =>
    Effect.gen(function*() {
      const input = { value: 42, incidental: "not identity" }
      const request = {
        moduleFingerprint: "wire-v1",
        runtimeFingerprint: "runtime-v1",
        inputSchema: Schema.Struct({ value: Schema.FiniteFromString }),
        paramsSchema: Schema.FiniteFromString,
        input,
        params: 11
      }
      const actual = yield* key(new KeyRequest(request))
      const inputDigest = yield* ContentDigest.fromBytes("blake3-256", yield* Utf8.encode("{\"value\":\"42\"}"))
      const paramsDigest = yield* ContentDigest.fromBytes("blake3-256", yield* Utf8.encode("\"11\""))
      expect(actual.inputHash).toBe(ContentDigest.toString(inputDigest))
      expect(actual.paramsHash).toBe(ContentDigest.toString(paramsDigest))
      const changed = { value: 42, incidental: "changed" }
      expect(yield* key(new KeyRequest({ ...request, input: changed })))
        .toEqual(actual)
      expect((yield* key(new KeyRequest({ ...request, paramsSchema: Schema.Finite }))).paramsHash)
        .not.toBe(actual.paramsHash)
    }))

  it.effect("resolve returns miss + computed value on first call", () =>
    Effect.gen(function*() {
      const computeCount = yield* Ref.make(0)

      const cache = yield* Cache

      const { value, resolution } = yield* cache.resolve(
        new Request({
          moduleFingerprint: "qa-module",
          runtimeFingerprint: "runtime-v1",
          input: { question: "What is 2+2?" },
          inputSchema: Schema.Struct({ question: Schema.String }),
          paramsSchema: Schema.Struct({ instructions: Schema.String, demos: Schema.Array(Schema.Never) }),
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
        inputSchema: Schema.Struct({ question: Schema.String }),
        paramsSchema: Schema.Struct({ instructions: Schema.String, demos: Schema.Array(Schema.Never) }),
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
          inputSchema: Schema.Struct({ question: Schema.String }),
          paramsSchema: Schema.Struct({ instructions: Schema.String, demos: Schema.Array(Schema.Never) }),
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
          inputSchema: Schema.Struct({ question: Schema.String }),
          paramsSchema: Schema.Struct({ instructions: Schema.String, demos: Schema.Array(Schema.Never) }),
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

  it.effect("Key schema includes all five components", () =>
    Effect.gen(function*() {
      const key = new Key({
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

  it.effect("Key without rollout defaults to Option.none()", () =>
    Effect.gen(function*() {
      const key = new Key({
        moduleFingerprint: "qa-module",
        runtimeFingerprint: "runtime-v1",
        inputHash: "abc123",
        paramsHash: "def456",
        rolloutId: Option.none()
      })

      expect(key.rolloutId).toEqual(Option.none())
    }))

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
          inputSchema: Schema.Struct({ x: Schema.Finite }),
          paramsSchema: Schema.Struct({ instructions: Schema.String, demos: Schema.Array(Schema.Never) }),
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
          inputSchema: Schema.Struct({ x: Schema.Finite }),
          paramsSchema: Schema.Struct({ instructions: Schema.String, demos: Schema.Array(Schema.Never) }),
          compute: Effect.succeed({ y: 999 })
        })
      )

      expect(cached).toEqual({ y: 42 })
      expect(cachedRes).toBe("hit")
    }).pipe(Effect.provide(layerMemory)))
})
