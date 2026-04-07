import { BunContext } from "@effect/platform-bun"
import { describe, expect, it } from "@effect/vitest"
import { Effect } from "effect"

import { moduleSpecifiers, parseTypeScript, readProjectFile } from "@theoria/source-proof"

const repositoryRootUrl = new URL("../../../../", import.meta.url)

describe("package/program-of-thought-governance", () => {
  it.effect("reuses the canonical chain-of-thought, predict, compose, parse, and retry seams instead of introducing a second prompt runtime", () =>
    Effect.gen(function*() {
      const programIndexPath = "packages/effect-dsp/src/Module/programOfThought/index.ts"
      const programRuntimePath = "packages/effect-dsp/src/Module/programOfThought/runtime.ts"
      const chainRuntimePath = "packages/effect-dsp/src/Module/chainOfThought/runtime.ts"

      const programIndexSource = yield* readProjectFile(repositoryRootUrl, programIndexPath)
      const programRuntimeSource = yield* readProjectFile(repositoryRootUrl, programRuntimePath)
      const chainRuntimeSource = yield* readProjectFile(repositoryRootUrl, chainRuntimePath)

      const programIndexImports = moduleSpecifiers(parseTypeScript(programIndexPath, programIndexSource))
      const programRuntimeImports = moduleSpecifiers(parseTypeScript(programRuntimePath, programRuntimeSource))
      const chainRuntimeImports = moduleSpecifiers(parseTypeScript(chainRuntimePath, chainRuntimeSource))

      expect(programIndexImports).toContain("../chainOfThought/index.js")
      expect(programIndexImports).toContain("../compose/index.js")
      expect(chainRuntimeImports).toContain("../predict/index.js")
      expect(programRuntimeImports).toContain("./parse.js")
      expect(programRuntimeImports).toContain("./execution.js")
      expect(programRuntimeSource).toContain("Effect.catchTag(\"ProgramCodeParseError\"")
      expect(programRuntimeSource).toContain("Effect.catchTag(\"ProgramExecutionError\"")
    }).pipe(Effect.provide(BunContext.layer)))
})
