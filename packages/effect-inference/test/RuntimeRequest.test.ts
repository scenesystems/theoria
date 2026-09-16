import { describe, expect, it } from "@effect/vitest"
import { Effect } from "effect"

import * as RuntimeRequest from "@scenesystems/effect-inference/RuntimeRequest"

describe("RuntimeRequest", () => {
  it.effect("decodes model intent and maps malformed routes to checked configuration errors", () =>
    Effect.gen(function*() {
      const request = yield* RuntimeRequest.decodeUnknown({
        model: { modelRef: "meta-llama/Llama-3.3-70B-Instruct" },
        role: "task",
        capabilities: { streaming: true, usageReporting: false }
      })
      const error = yield* RuntimeRequest.decodeUnknown({
        model: { modelRef: "model" },
        route: { family: "unknown" }
      }).pipe(Effect.flip)

      expect(request.model.modelRef).toContain("Llama")
      expect(error._tag).toBe("effect-inference/InvalidRuntimeConfig")
    }))
})
