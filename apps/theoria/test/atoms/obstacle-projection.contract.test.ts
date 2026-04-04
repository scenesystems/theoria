import { BunContext } from "@effect/platform-bun"
import { describe, expect, it } from "@effect/vitest"
import {
  callExpressionTargets,
  identifierNames,
  moduleSpecifiers,
  parseTypeScript,
  readProjectFile
} from "@theoria/source-proof"
import { Effect } from "effect"

const appRootUrl = new URL("../../", import.meta.url)

describe("obstacle projection contract", () => {
  it.effect("keeps obstacle-aware layout on shipped effect-text public APIs", () =>
    Effect.gen(function*() {
      const source = yield* readProjectFile(appRootUrl, "app/web/text/obstacleProjection.ts")
      const sourceFile = parseTypeScript("obstacleProjection.ts", source)
      const specifiers = moduleSpecifiers(sourceFile)
      const effectTextSpecifiers = specifiers.filter((specifier) => specifier.startsWith("effect-text"))
      const callTargets = callExpressionTargets(sourceFile)
      const identifiers = identifierNames(sourceFile)

      expect(effectTextSpecifiers.length).toBeGreaterThan(0)
      expect(
        effectTextSpecifiers.every(
          (specifier) =>
            (specifier === "effect-text" || specifier === "effect-text/Text") &&
            !specifier.includes("/internal") &&
            !specifier.includes("/src/")
        )
      ).toBe(true)
      expect(callTargets.includes("Text.layoutLinesWith")).toBe(true)
      expect(identifiers.includes("preparedTextCore")).toBe(false)
      expect(identifiers.includes("materializeLines")).toBe(false)
    }).pipe(Effect.provide(BunContext.layer)))
})
