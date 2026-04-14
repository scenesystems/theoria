import { FileSystem, Path } from "@effect/platform"
import { BunContext } from "@effect/platform-bun"
import { describe, expect, it } from "@effect/vitest"
import { Effect } from "effect"

const packageRootUrl = new URL("../../", import.meta.url)

describe("package/release-notes-surface", () => {
  it.effect("keeps the changeset aligned with the shipped v0.2 module, optimizer, and public-evidence story", () =>
    Effect.gen(function*() {
      const fileSystem = yield* FileSystem.FileSystem
      const path = yield* Path.Path
      const root = yield* path.fromFileUrl(packageRootUrl).pipe(Effect.orDie)
      const workspaceRoot = path.dirname(path.dirname(root))
      const changeset = yield* fileSystem.readFileString(
        path.join(workspaceRoot, ".changeset/effect-dsp-modules-and-workflow-interop.md")
      ).pipe(Effect.orDie)

      expect(changeset).toContain("Module.programOfThought")
      expect(changeset).toContain("Module.multiChainComparison")
      expect(changeset).toContain("Module.parallel")
      expect(changeset).toContain("Optimizer.copro")
      expect(changeset).toContain("effect-dsp/contracts")
      expect(changeset).toContain("public-evidence")
      expect(changeset).toContain("workflow-interop")
      expect(changeset).not.toContain("TraceRef")
      expect(changeset).not.toContain("UsageRef")
    }).pipe(Effect.provide(BunContext.layer)))
})
