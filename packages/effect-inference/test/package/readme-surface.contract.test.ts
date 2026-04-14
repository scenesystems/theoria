import { FileSystem, Path } from "@effect/platform"
import { BunContext } from "@effect/platform-bun"
import { describe, expect, it } from "@effect/vitest"
import { Effect } from "effect"

const packageRootUrl = new URL("../../", import.meta.url)

describe("package/readme-surface", () => {
  it.effect("documents only the shipped route families, helper entrypoints, and example files", () =>
    Effect.gen(function*() {
      const fileSystem = yield* FileSystem.FileSystem
      const path = yield* Path.Path
      const root = yield* path.fromFileUrl(packageRootUrl).pipe(Effect.orDie)
      const readme = yield* fileSystem.readFileString(path.join(root, "README.md")).pipe(Effect.orDie)

      expect(readme).toContain("## How Do I Keep Runtime Provenance?")
      expect(readme).toContain("HuggingFace.resolveLiveRuntimeConfig")
      expect(readme).toContain("HuggingFace.resolveLiveRuntimeFromConfig")
      expect(readme).toContain("HuggingFace.languageModelLayer")
      expect(readme).toContain("HuggingFace.embeddingModelLayer")
      expect(readme).toContain("LanguageModel.generateText")
      expect(readme).toContain("EmbeddingModel.EmbeddingModel")
      expect(readme).toContain("Runtime.resolveLiveTextProviderRuntime")
      expect(readme).toContain("Runtime.RuntimeEvidence.fromResolution")
      expect(readme).toContain("EFFECT_INFERENCE_RUN_LIVE_EXAMPLES")
      expect(readme).toContain("bun run --filter 'effect-inference' examples:verify")
      expect(readme).toContain("OpenAiCompatible")
      expect(readme).toContain("OpenAiResponses")
      expect(readme).toContain("AnthropicMessages")
      expect(readme).toContain("HuggingFace")
      expect(readme).toContain("effect-inference/Testing")
      expect(readme).toContain("examples/01-openai-compatible-static-runtime.ts")
      expect(readme).toContain("examples/02-hugging-face-routed-runtime.ts")
      expect(readme).toContain("examples/03-runtime-config-decoding.ts")
      expect(readme).toContain("examples/04-hugging-face-endpoint-runtime.ts")
    }).pipe(Effect.provide(BunContext.layer)))
})
