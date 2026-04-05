import { FileSystem, Path } from "@effect/platform"
import { BunContext } from "@effect/platform-bun"
import { describe, expect, it } from "@effect/vitest"
import { Effect } from "effect"

import { moduleSpecifiers, parseTypeScript } from "@theoria/source-proof"

const exampleRuntimePath = "examples/shared/live-provider-runtime.ts"
const packageRootUrl = new URL("../../", import.meta.url)

describe("integration/inference-runtime-boundary", () => {
  it.effect("keeps the example runtime wrapped around effect-inference instead of local provider clients", () =>
    Effect.gen(function*() {
      const fileSystem = yield* FileSystem.FileSystem
      const path = yield* Path.Path
      const root = yield* path.fromFileUrl(packageRootUrl).pipe(Effect.orDie)
      const source = yield* fileSystem.readFileString(path.join(root, exampleRuntimePath)).pipe(Effect.orDie)
      const parsed = parseTypeScript(exampleRuntimePath, source)
      const imports = moduleSpecifiers(parsed)

      expect(imports).toContain("effect-inference/Runtime")
      expect(imports).toContain("effect-inference/Errors")
      expect(source).toContain("resolveLiveTextProviderRuntime")
      expect(source).toContain("liveTextProviderLayer")
      expect(imports).not.toContain("@effect/ai-openai/OpenAiClient")
      expect(imports).not.toContain("@effect/ai-anthropic/AnthropicClient")
      expect(imports).not.toContain("@effect/ai-openrouter/OpenRouterClient")
    }).pipe(Effect.provide(BunContext.layer)))
})
