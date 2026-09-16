import { describe, expect, it } from "@effect/vitest"
import { Effect, Option } from "effect"

import * as Contracts from "../../src/contracts/index.js"
import { makeHuggingFaceRoutedModelRef } from "../../src/internal/huggingFace.js"

describe("HuggingFace chat model references", () => {
  it.effect("encodes chat selection policies without appending an auto suffix", () =>
    Effect.sync(() => {
      expect(makeHuggingFaceRoutedModelRef("org/model", Option.none())).toBe("org/model")
      expect(makeHuggingFaceRoutedModelRef("org/model", Option.some("auto"))).toBe("org/model")
      expect(makeHuggingFaceRoutedModelRef("org/model", Option.some("fastest"))).toBe("org/model:fastest")
      expect(makeHuggingFaceRoutedModelRef("org/model", Option.some("cheapest"))).toBe("org/model:cheapest")
      expect(makeHuggingFaceRoutedModelRef("org/model", Option.some("preferred"))).toBe("org/model:preferred")
      expect(makeHuggingFaceRoutedModelRef("org/model", Option.some(Contracts.explicitProviderSelection("together"))))
        .toBe("org/model:together")
    }))
})
