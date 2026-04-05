import { describe, expect, it } from "@effect/vitest"

import type * as Contracts from "../../src/contracts/index.js"
import * as OpenAiCompatible from "../../src/OpenAiCompatible/index.js"

const runtimeFlavors: ReadonlyArray<Contracts.RuntimeFlavor> = ["vllm", "tgi", "ollama", "lm-studio"]

describe("Runtime/open-model-route-selection", () => {
  it.each(runtimeFlavors)(
    "keeps %s self-hosted runtimes on the stable OpenAiCompatible lane by default",
    (runtimeFlavorHint) => {
      const desired = OpenAiCompatible.withOpenAiCompatibleRoute(
        {
          artifact: {
            modelRef: `local/${runtimeFlavorHint}`
          }
        },
        {
          baseUrl: `http://127.0.0.1/${runtimeFlavorHint}/v1`,
          serveMode: "local-runtime",
          authMethod: "none",
          runtimeFlavorHint
        }
      )

      const resolution = OpenAiCompatible.makeOpenAiCompatibleResolution(
        desired,
        desired.route?.baseUrl ?? "http://127.0.0.1/v1"
      )

      expect(resolution.resolvedRoute.route.family).toBe("OpenAiCompatible")
      expect(resolution.resolvedRoute.runtimeFlavor).toBe(runtimeFlavorHint)
      expect(resolution.capabilities.textGeneration).toBe(true)
    }
  )
})
