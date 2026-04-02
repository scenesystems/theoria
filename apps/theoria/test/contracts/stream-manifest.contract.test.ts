import { describe, expect, it } from "@effect/vitest"
import { Effect, Option } from "effect"

import {
  decodeStreamManifest,
  EffectMathManifest,
  EffectSearchManifest,
  encodeStreamManifest
} from "../../app/contracts/stream-manifest.js"

describe("StreamManifest Contract", () => {
  it.effect("round-trips the effect-search manifest", () =>
    Effect.gen(function*() {
      const encoded = encodeStreamManifest(new EffectSearchManifest({ trialBudget: 45 }))
      const decoded = Option.getOrNull(decodeStreamManifest(encoded))

      expect(decoded?._tag).toBe("effect-search")
      if (decoded !== null && decoded._tag === "effect-search") {
        expect(decoded.trialBudget).toBe(45)
      }
    }))

  it.effect("round-trips the effect-math manifest", () =>
    Effect.gen(function*() {
      const encoded = encodeStreamManifest(new EffectMathManifest({ alpha: 0.05, d: 0.65, n: 48 }))
      const decoded = Option.getOrNull(decodeStreamManifest(encoded))

      expect(decoded?._tag).toBe("effect-math")
      if (decoded !== null && decoded._tag === "effect-math") {
        expect(decoded.d).toBe(0.65)
        expect(decoded.n).toBe(48)
        expect(decoded.alpha).toBe(0.05)
      }
    }))
})
