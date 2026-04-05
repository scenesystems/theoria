import { FileSystem, Path } from "@effect/platform"
import { BunContext } from "@effect/platform-bun"
import { describe, expect, it } from "@effect/vitest"
import { Effect } from "effect"

import { moduleSpecifiers, parseTypeScript } from "@theoria/source-proof"

const appRootUrl = new URL("../../", import.meta.url)
const providerRuntimePath = "app/server/demos/effect-dsp/provider.ts"

describe("server/inference-runtime-boundary", () => {
  it.effect("keeps the DSP provider runtime on the effect-inference substrate", () =>
    Effect.gen(function*() {
      const fileSystem = yield* FileSystem.FileSystem
      const path = yield* Path.Path
      const root = yield* path.fromFileUrl(appRootUrl).pipe(Effect.orDie)
      const source = yield* fileSystem.readFileString(path.join(root, providerRuntimePath)).pipe(Effect.orDie)
      const parsed = parseTypeScript(providerRuntimePath, source)
      const imports = moduleSpecifiers(parsed)

      expect(imports).toContain("../../../../../../packages/effect-inference/src/Runtime/index.js")
      expect(imports).not.toContain("@effect/ai-openai/OpenAiClient")
      expect(imports).not.toContain("@effect/ai-anthropic/AnthropicClient")
      expect(imports).not.toContain("@effect/ai-openrouter/OpenRouterClient")
    }).pipe(Effect.provide(BunContext.layer)))
})
