import { describe, expect, it } from "@effect/vitest"

import * as Inference from "../../src/index.js"

describe("integration/runtime-boundary", () => {
  it("exposes the package boundary from the root barrel", () => {
    expect(Inference.Contracts).toBeDefined()
    expect(Inference.Runtime).toBeDefined()
    expect(Inference.OpenAiCompatible).toBeDefined()
    expect(Inference.HuggingFace).toBeDefined()
  })
})
