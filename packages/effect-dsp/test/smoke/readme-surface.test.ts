import { FileSystem, Path } from "@effect/platform"
import { BunContext } from "@effect/platform-bun"
import { describe, expect, it } from "@effect/vitest"
import { Effect } from "effect"
import * as Dsp from "effect-dsp"
import * as Contracts from "effect-dsp/contracts"
import * as Experimental from "effect-dsp/experimental"
import * as ModuleNamespace from "effect-dsp/Module"
import * as OptimizerNamespace from "effect-dsp/Optimizer"
import { MockLanguageModel } from "effect-dsp/test"

const packageRootUrl = new URL("../../", import.meta.url)

describe("package/readme-surface", () => {
  it.effect("documents only the shipped module, optimizer, and public subpath surfaces", () =>
    Effect.gen(function*() {
      const fileSystem = yield* FileSystem.FileSystem
      const path = yield* Path.Path
      const root = yield* path.fromFileUrl(packageRootUrl).pipe(Effect.orDie)
      const readme = yield* fileSystem.readFileString(path.join(root, "README.md")).pipe(Effect.orDie)

      expect(typeof Dsp.Module.predict).toBe("function")
      expect(typeof ModuleNamespace.parallel).toBe("function")
      expect(typeof OptimizerNamespace.copro).toBe("function")
      expect(typeof OptimizerNamespace.coproStream).toBe("function")
      expect(typeof Contracts.OptimizationObjectiveSurface.fromTraceEntry).toBe("function")
      expect(Contracts.ArtifactEnvelopeSchema).toBeDefined()
      expect(typeof MockLanguageModel.layer).toBe("function")
      expect(Experimental._experimental).toBe(true)

      expect(readme).toContain("examples/19-copro-mock.ts")
      expect(readme).toContain("`copro`, `coproStream`")
      expect(readme).toContain("effect-search-compatible study envelopes")
      expect(readme).toContain("effect-dsp/contracts")
      expect(readme).toContain("effect-dsp/test")
      expect(readme).toContain("effect-dsp/experimental")
      expect(readme).toContain("Trace.withTracing")
      expect(readme).toContain("Trace.withUsageTracking")
      expect(readme).toContain("Contracts.OptimizationObjectiveSurface.fromTraceEntry")
      expect(readme).toContain("Contracts.ArtifactEnvelopeSchema")
      expect(readme).not.toContain("TraceRef")
      expect(readme).not.toContain("UsageRef")
      expect(readme).not.toContain("| `COPRO`             | `dspy.COPRO`")
    }).pipe(Effect.provide(BunContext.layer)))
})
