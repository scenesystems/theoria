import { describe, expect, it } from "@effect/vitest"
import { Effect } from "effect"
import { empty, merge, ModelSettings } from "../src/ModelSettings.js"

describe("ModelSettings.merge", () => {
  it.effect("preserves omitted base fields and lets zero override a nonzero temperature", () =>
    Effect.gen(function*() {
      const base = new ModelSettings({ temperature: 0.7, maxTokens: 73, topP: 0.9, stop: ["END"], seed: 17 })
      expect(merge(base, new ModelSettings({ temperature: 0, maxTokens: undefined }))).toEqual(
        new ModelSettings({ temperature: 0, maxTokens: 73, topP: 0.9, stop: ["END"], seed: 17 })
      )
      expect(merge(base, empty)).toEqual(base)
      expect(base.temperature).toBe(0.7)
    }))
})
