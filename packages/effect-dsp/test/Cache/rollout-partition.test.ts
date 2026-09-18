/**
 * Rollout scopes partition cache keys deterministically: different rollout
 * indices produce different cache entries, and Option.none() produces
 * stable keys without rollout segment.
 */
import { describe, expect, it } from "@effect/vitest"
import { Cache, layerMemory, withRollout } from "@scenesystems/effect-dsp/Cache"
import { Effect, Number as Num, Ref, Schema } from "effect"

describe("Cache rollout partition", () => {
  it.effect("different RolloutRef values produce independent cache entries", () =>
    Effect.gen(function*() {
      const computeCount = yield* Ref.make(0)
      const cache = yield* Cache

      const makeRequest = (answer: string) => ({
        moduleFingerprint: "qa-module",
        runtimeFingerprint: "runtime-v1",
        input: { question: "What is 2+2?" },
        params: { instructions: "Answer concisely", demos: [] },
        outputSchema: Schema.Struct({ answer: Schema.String }),
        compute: Ref.updateAndGet(computeCount, Num.increment).pipe(
          Effect.as({ answer })
        )
      })

      const { value: r0, resolution: res0 } = yield* withRollout(0, cache.resolve(makeRequest("answer-0")))
      const { value: r1, resolution: res1 } = yield* withRollout(1, cache.resolve(makeRequest("answer-1")))
      const { value: r2, resolution: res2 } = yield* withRollout(2, cache.resolve(makeRequest("answer-2")))

      expect(res0).toBe("miss")
      expect(res1).toBe("miss")
      expect(res2).toBe("miss")
      expect(r0).toEqual({ answer: "answer-0" })
      expect(r1).toEqual({ answer: "answer-1" })
      expect(r2).toEqual({ answer: "answer-2" })
      expect(yield* Ref.get(computeCount)).toBe(3)
    }).pipe(Effect.provide(layerMemory)))

  it.effect("same RolloutRef value returns cached entry (hit)", () =>
    Effect.gen(function*() {
      const computeCount = yield* Ref.make(0)
      const cache = yield* Cache

      const request = {
        moduleFingerprint: "qa-module",
        runtimeFingerprint: "runtime-v1",
        input: { question: "What is 2+2?" },
        params: { instructions: "Answer concisely", demos: [] },
        outputSchema: Schema.Struct({ answer: Schema.String }),
        compute: Ref.updateAndGet(computeCount, Num.increment).pipe(
          Effect.as({ answer: "4" })
        )
      }

      yield* withRollout(5, cache.resolve(request))
      const { value, resolution } = yield* withRollout(5, cache.resolve(request))

      expect(value).toEqual({ answer: "4" })
      expect(resolution).toBe("hit")
      expect(yield* Ref.get(computeCount)).toBe(1)
    }).pipe(Effect.provide(layerMemory)))

  it.effect("Option.none() rollout produces deterministic key without rollout segment", () =>
    Effect.gen(function*() {
      const computeCount = yield* Ref.make(0)
      const cache = yield* Cache

      const request = {
        moduleFingerprint: "qa-module",
        runtimeFingerprint: "runtime-v1",
        input: { question: "What is 2+2?" },
        params: { instructions: "Answer concisely", demos: [] },
        outputSchema: Schema.Struct({ answer: Schema.String }),
        compute: Ref.updateAndGet(computeCount, Num.increment).pipe(
          Effect.as({ answer: "4" })
        )
      }

      yield* cache.resolve(request)
      const { value, resolution } = yield* cache.resolve(request)

      expect(value).toEqual({ answer: "4" })
      expect(resolution).toBe("hit")
      expect(yield* Ref.get(computeCount)).toBe(1)
    }).pipe(Effect.provide(layerMemory)))

  it.effect("rollout index 0 and no-rollout produce different keys", () =>
    Effect.gen(function*() {
      const computeCount = yield* Ref.make(0)
      const cache = yield* Cache

      const makeRequest = (answer: string) => ({
        moduleFingerprint: "qa-module",
        runtimeFingerprint: "runtime-v1",
        input: { question: "What is 2+2?" },
        params: { instructions: "Answer concisely", demos: [] },
        outputSchema: Schema.Struct({ answer: Schema.String }),
        compute: Ref.updateAndGet(computeCount, Num.increment).pipe(
          Effect.as({ answer })
        )
      })

      const { value: rNone, resolution: resNone } = yield* cache.resolve(makeRequest("no-rollout"))
      const { value: rZero, resolution: resZero } = yield* withRollout(0, cache.resolve(makeRequest("rollout-0")))

      expect(resNone).toBe("miss")
      expect(resZero).toBe("miss")
      expect(rNone).toEqual({ answer: "no-rollout" })
      expect(rZero).toEqual({ answer: "rollout-0" })
      expect(yield* Ref.get(computeCount)).toBe(2)
    }).pipe(Effect.provide(layerMemory)))
})
