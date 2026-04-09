import { BunContext } from "@effect/platform-bun"
import { describe, expect, it } from "@effect/vitest"
import { Effect } from "effect"

import { moduleSpecifiers, parseTypeScript, readProjectFile } from "@theoria/source-proof"

const appRootUrl = new URL("../../", import.meta.url)
const providerRuntimePath = "app/server/capability/effect-dsp.ts"

describe("server/inference-runtime-boundary", () => {
  it.effect("keeps the DSP provider runtime on the effect-inference substrate", () =>
    Effect.gen(function*() {
      const source = yield* readProjectFile(appRootUrl, providerRuntimePath)
      const parsed = parseTypeScript(providerRuntimePath, source)
      const imports = moduleSpecifiers(parsed)

      expect(imports).toContain("effect-inference/Runtime")
      expect(imports).not.toContain("@effect/ai-openai/OpenAiClient")
      expect(imports).not.toContain("@effect/ai-anthropic/AnthropicClient")
      expect(imports).not.toContain("@effect/ai-openrouter/OpenRouterClient")
    }).pipe(Effect.provide(BunContext.layer)))
})
