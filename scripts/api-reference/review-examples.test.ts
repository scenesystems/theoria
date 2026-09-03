import { describe, expect, it } from "@effect/vitest"
import { Effect, HashMap } from "effect"

import { exampleDiagnostics } from "./review-examples.js"

const supported = HashMap.make([
  "@scenesystems/digest",
  `${process.cwd()}/packages/digest/src/index.ts`
])

describe("API documentation examples", () => {
  it.effect("strictly compiles a canonical public import", () =>
    Effect.sync(() => {
      expect(exampleDiagnostics(process.cwd(), [{
        owner: "digest#encodeUtf8",
        package: "@scenesystems/digest",
        language: "ts",
        code: "import { encodeUtf8 } from \"@scenesystems/digest\"\nconst encoding = encodeUtf8(\"value\")"
      }], supported)).toEqual([])
    }))

  it.effect("attributes compiler diagnostics to the owning export", () =>
    Effect.sync(() => {
      expect(exampleDiagnostics(process.cwd(), [{
        owner: "digest#encodeUtf8",
        package: "@scenesystems/digest",
        language: "ts",
        code: "import { encodeUtf8 } from \"@scenesystems/digest\"\nconst bytes: string = encodeUtf8(\"value\")"
      }], supported)).toEqual([
        expect.stringContaining("digest#encodeUtf8:2:7 TS2322")
      ])
    }))

  it.effect("rejects relative, internal, and context-free examples", () =>
    Effect.sync(() => {
      const diagnostics = exampleDiagnostics(process.cwd(), [{
        owner: "digest#bad",
        package: "@scenesystems/digest",
        language: "ts",
        code:
          "import { hidden } from \"@scenesystems/digest/internal/hidden\"\nimport { local } from \"./local.js\"\nvoid hidden\nvoid local"
      }], supported)
      expect(diagnostics).toContain("digest#bad: @example imports a private, relative, or Node module")
      expect(diagnostics).toContain(
        "digest#bad: @example imports unsupported path @scenesystems/digest/internal/hidden"
      )
      expect(diagnostics).toContain("digest#bad: @example has no canonical Theoria package import")
    }))
})
