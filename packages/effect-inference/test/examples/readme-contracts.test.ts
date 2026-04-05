import { FileSystem, Path } from "@effect/platform"
import { BunContext } from "@effect/platform-bun"
import { describe, expect, it } from "@effect/vitest"
import { Effect } from "effect"

const packageRootUrl = new URL("../../", import.meta.url)

describe("examples/readme-contracts", () => {
  it.effect("keeps the shipped example programs present at the documented paths", () =>
    Effect.gen(function*() {
      const fileSystem = yield* FileSystem.FileSystem
      const path = yield* Path.Path
      const root = yield* path.fromFileUrl(packageRootUrl).pipe(Effect.orDie)
      const examples = [
        "examples/01-openai-compatible-static-runtime.ts",
        "examples/02-hugging-face-routed-runtime.ts",
        "examples/03-runtime-config-decoding.ts",
        "examples/04-hugging-face-endpoint-runtime.ts"
      ]
      const contents = yield* Effect.forEach(
        examples,
        (relativePath) => fileSystem.readFileString(path.join(root, relativePath)).pipe(Effect.orDie),
        { concurrency: "unbounded" }
      )
      const routedExample = contents[1]
      const configExample = contents[2]
      const endpointExample = contents[3]

      expect(contents.every((source) => source.includes("export const program"))).toBe(true)
      expect(routedExample).toContain("HuggingFace.resolveLiveRuntimeFromConfig")
      expect(routedExample).toContain("LanguageModel.generateText")
      expect(configExample).toContain("Runtime.resolveLiveTextProviderRuntime")
      expect(configExample).toContain("LanguageModel.generateText")
      expect(endpointExample).toContain("HuggingFace.resolveLiveRuntimeFromConfig")
      expect(endpointExample).toContain("EmbeddingModel.EmbeddingModel")
    }).pipe(Effect.provide(BunContext.layer)))
})
