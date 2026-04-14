/**
 * RolloutRef partitions DspCache keys deterministically: different rollout
 * indices produce different cache entries, and Option.none() produces
 * stable keys without rollout segment.
 */
import { describe, expect, it } from "@effect/vitest"
import { Effect, Ref, Schema } from "effect"
import { DspCache, DspCacheMemory } from "../../src/Cache/index.js"
import { withRollout } from "../../src/Cache/refs.js"

const AnswerSchema = Schema.Struct({ answer: Schema.String })

const QaRolloutRequest = {
  make: ({
    computeCount,
    answer
  }: {
    computeCount: Ref.Ref<number>
    answer: string
  }) => ({
    moduleFingerprint: "qa-module",
    runtimeFingerprint: "runtime-v1",
    input: { question: "What is 2+2?" },
    params: { instructions: "Answer concisely", demos: [] },
    outputSchema: AnswerSchema,
    compute: Ref.updateAndGet(computeCount, (n) => n + 1).pipe(
      Effect.as({ answer })
    )
  })
}

describe("DspCache rollout partition", () => {
  it.effect("different RolloutRef values produce independent cache entries", () =>
    Effect.gen(function*() {
      const computeCount = yield* Ref.make(0)
      const cache = yield* DspCache

      const [r0, res0] = yield* withRollout(
        0,
        cache.resolve(QaRolloutRequest.make({ computeCount, answer: "answer-0" }))
      )
      const [r1, res1] = yield* withRollout(
        1,
        cache.resolve(QaRolloutRequest.make({ computeCount, answer: "answer-1" }))
      )
      const [r2, res2] = yield* withRollout(
        2,
        cache.resolve(QaRolloutRequest.make({ computeCount, answer: "answer-2" }))
      )

      expect(res0).toBe("miss")
      expect(res1).toBe("miss")
      expect(res2).toBe("miss")
      expect(r0).toEqual({ answer: "answer-0" })
      expect(r1).toEqual({ answer: "answer-1" })
      expect(r2).toEqual({ answer: "answer-2" })
      expect(yield* Ref.get(computeCount)).toBe(3)
    }).pipe(Effect.provide(DspCacheMemory)))

  it.effect("same RolloutRef value returns cached entry (hit)", () =>
    Effect.gen(function*() {
      const computeCount = yield* Ref.make(0)
      const cache = yield* DspCache

      const request = QaRolloutRequest.make({ computeCount, answer: "4" })

      yield* withRollout(5, cache.resolve(request))
      const [result, resolution] = yield* withRollout(5, cache.resolve(request))

      expect(result).toEqual({ answer: "4" })
      expect(resolution).toBe("hit")
      expect(yield* Ref.get(computeCount)).toBe(1)
    }).pipe(Effect.provide(DspCacheMemory)))

  it.effect("Option.none() rollout produces deterministic key without rollout segment", () =>
    Effect.gen(function*() {
      const computeCount = yield* Ref.make(0)
      const cache = yield* DspCache

      const request = QaRolloutRequest.make({ computeCount, answer: "4" })

      yield* cache.resolve(request)
      const [result, resolution] = yield* cache.resolve(request)

      expect(result).toEqual({ answer: "4" })
      expect(resolution).toBe("hit")
      expect(yield* Ref.get(computeCount)).toBe(1)
    }).pipe(Effect.provide(DspCacheMemory)))

  it.effect("rollout index 0 and no-rollout produce different keys", () =>
    Effect.gen(function*() {
      const computeCount = yield* Ref.make(0)
      const cache = yield* DspCache

      const [rNone, resNone] = yield* cache.resolve(
        QaRolloutRequest.make({ computeCount, answer: "no-rollout" })
      )
      const [rZero, resZero] = yield* withRollout(
        0,
        cache.resolve(QaRolloutRequest.make({ computeCount, answer: "rollout-0" }))
      )

      expect(resNone).toBe("miss")
      expect(resZero).toBe("miss")
      expect(rNone).toEqual({ answer: "no-rollout" })
      expect(rZero).toEqual({ answer: "rollout-0" })
      expect(yield* Ref.get(computeCount)).toBe(2)
    }).pipe(Effect.provide(DspCacheMemory)))
})
