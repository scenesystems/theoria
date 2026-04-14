import { FileSystem, Path } from "@effect/platform"
import { BunContext } from "@effect/platform-bun"
import { describe, expect, it } from "@effect/vitest"
import { Effect, Schema } from "effect"

import packageJson from "../../package.json" with { type: "json" }
import * as Study from "../../src/Study/index.js"

const packageRootUrl = new URL("../../", import.meta.url)

const PackageScriptsSchema = Schema.Struct({
  scripts: Schema.Record({ key: Schema.String, value: Schema.String })
})

const packageScripts = Schema.decodeUnknownSync(PackageScriptsSchema)(packageJson).scripts

describe("package/readme-surface", () => {
  it.effect("documents only the shipped benchmark envelope and recovery guarantees", () =>
    Effect.gen(function*() {
      const fileSystem = yield* FileSystem.FileSystem
      const path = yield* Path.Path
      const root = yield* path.fromFileUrl(packageRootUrl).pipe(Effect.orDie)
      const readme = yield* fileSystem.readFileString(path.join(root, "README.md")).pipe(Effect.orDie)

      expect(typeof Study.snapshot).toBe("function")
      expect(typeof Study.resumeFromStorage).toBe("function")
      expect(packageScripts.bench).toBe("bun run benchmark/run.ts")

      expect(readme).toContain("## Benchmark envelope")
      expect(readme).toContain("bun run bench")
      expect(readme).toContain("sampler")
      expect(readme).toContain("engine")
      expect(readme).toContain("objective")
      expect(readme).toContain("mean-of-seeds")
      expect(readme).toContain("worst-seed observations")
      expect(readme).toContain("StudySnapshot.samplerMetrics")
      expect(readme).toContain("UI-bound ask/tell")
      expect(readme).toContain("snapshot + resume")
      expect(readme).toContain("### Study service seams")
      expect(readme).toContain("SamplerEngine")
      expect(readme).toContain("SnapshotCodec")
      expect(readme).toContain("StudyKernel")
      expect(readme).toContain("publish:check")
      expect(readme).toContain("release-snapshots:stamp")
    }).pipe(Effect.provide(BunContext.layer)))
})
