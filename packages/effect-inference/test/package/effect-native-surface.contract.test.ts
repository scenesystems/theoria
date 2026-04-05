import { FileSystem, Path } from "@effect/platform"
import { BunContext } from "@effect/platform-bun"
import { describe, expect, it } from "@effect/vitest"
import { Effect } from "effect"
import type { Layer } from "effect"

import * as Contracts from "../../src/contracts/index.js"
import * as Errors from "../../src/Errors/index.js"
import * as HuggingFace from "../../src/HuggingFace/index.js"
import * as OpenAiCompatible from "../../src/OpenAiCompatible/index.js"
import * as Runtime from "../../src/Runtime/index.js"

const packageRootUrl = new URL("../../", import.meta.url)

const assertEffect = <A, E, R>(_: Effect.Effect<A, E, R>): true => true
const assertLayer = <A, E, R>(_: Layer.Layer<A, E, R>): true => true

describe("package/effect-native-surface", () => {
  it.effect("keeps stable runtime entrypoints Layer-or-Effect based and free of Promise-first public APIs", () =>
    Effect.gen(function*() {
      expect(
        assertEffect(Runtime.decodeDesiredRuntimeDescriptor({ artifact: { modelRef: "openai/gpt-4o-mini" } }))
      ).toBe(true)
      expect(
        assertEffect(
          Runtime.decodeResolvedRouteDescriptor({
            route: {
              family: "OpenAiCompatible",
              serveMode: "hosted-api",
              authMethod: "api-key",
              baseUrl: "https://api.openai.com/v1"
            },
            selectionReason: "testing-static-resolution",
            schemaVersion: Contracts.ResolvedRouteProvenanceVersion
          })
        )
      ).toBe(true)
      expect(assertEffect(Runtime.decodeResolvedRuntimeDescriptor({ responseModel: "gpt-4o-mini" }))).toBe(true)
      expect(
        assertEffect(
          Runtime.decodeRuntimeEvidence({
            desired: { artifact: { modelRef: "openai/gpt-4o-mini" } },
            resolvedRoute: {
              route: {
                family: "OpenAiCompatible",
                serveMode: "hosted-api",
                authMethod: "api-key",
                baseUrl: "https://api.openai.com/v1"
              },
              selectionReason: "testing-static-resolution",
              schemaVersion: Contracts.ResolvedRouteProvenanceVersion
            },
            resolvedRuntime: { responseModel: "gpt-4o-mini" },
            capabilities: {
              textGeneration: true,
              embeddings: false,
              streaming: true,
              toolCalling: true,
              structuredOutput: "strict",
              usageReporting: true,
              multimodalInput: false
            }
          })
        )
      ).toBe(true)
      expect(assertLayer(Runtime.RuntimeResolverLive)).toBe(true)
      expect(
        assertLayer(
          OpenAiCompatible.OpenAiCompatibleLive({
            model: "meta-llama/Llama-3.1-8B-Instruct",
            baseUrl: "http://127.0.0.1:11434/v1"
          })
        )
      ).toBe(true)
      expect(
        assertLayer(
          OpenAiCompatible.OpenAiCompatibleEmbeddingsLive({
            model: "text-embedding-3-small",
            baseUrl: "http://127.0.0.1:11434/v1"
          })
        )
      ).toBe(true)
      expect(
        assertLayer(
          HuggingFace.HuggingFaceRoutedEmbeddingsLive({
            model: "BAAI/bge-base-en-v1.5",
            route: {
              family: "HuggingFace",
              serveMode: "routed-marketplace",
              authMethod: "hf-token",
              baseUrl: "https://router.huggingface.co/v1"
            }
          })
        )
      ).toBe(true)
      expect(
        assertLayer(
          Runtime.layer(
            new Runtime.RuntimeResolverApi({
              resolve: () =>
                Effect.fail(
                  new Errors.RuntimeResolverNotImplemented({
                    feature: "test-layer"
                  })
                )
            })
          )
        )
      ).toBe(true)

      const fileSystem = yield* FileSystem.FileSystem
      const path = yield* Path.Path
      const root = decodeURIComponent(packageRootUrl.pathname)
      const srcRoot = path.join(root, "src")
      const entries = yield* fileSystem.readDirectory(srcRoot, { recursive: true }).pipe(Effect.orDie)
      const stablePublicEntries = entries.filter(
        (entry) => entry.endsWith(".ts") && !entry.startsWith("experimental/") && !entry.includes("/internal/")
      )
      const contents = yield* Effect.forEach(
        stablePublicEntries,
        (entry) => fileSystem.readFileString(path.join(srcRoot, entry)).pipe(Effect.orDie),
        { concurrency: "unbounded" }
      )
      const promiseFirstFindings = stablePublicEntries.filter((entry, index) =>
        /Promise<|runPromise\b|async\s+/.test(contents[index] ?? "")
      )

      expect(promiseFirstFindings).toEqual([])
    }).pipe(Effect.provide(BunContext.layer)))
})
