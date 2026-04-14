import { FileSystem, Path } from "@effect/platform"
import { BunContext } from "@effect/platform-bun"
import { describe, expect, it } from "@effect/vitest"
import { Array as Arr, Effect, Order, Record, Schema } from "effect"

import { benchProgram } from "../../benchmark/main.js"
import { benchmarkSuitePlan } from "../../benchmark/plans.js"
import { BenchmarkSuitePlanSchema } from "../../benchmark/schema.js"
import packageJson from "../../package.json" with { type: "json" }

const packageRootUrl = new URL("../../", import.meta.url)

const PackageScriptsSchema = Schema.Struct({
  scripts: Schema.Record({ key: Schema.String, value: Schema.String })
})

const packageScripts = Schema.decodeUnknownSync(PackageScriptsSchema)(packageJson).scripts

describe("performance/perf-harness-contract", () => {
  it.effect("ships one canonical bench command and package-owned suite plan", () =>
    Effect.gen(function*() {
      const fileSystem = yield* FileSystem.FileSystem
      const path = yield* Path.Path
      const root = yield* path.fromFileUrl(packageRootUrl).pipe(Effect.orDie)
      const benchmarkFiles = yield* fileSystem.readDirectory(path.join(root, "benchmark")).pipe(Effect.orDie)
      const decodedPlan = yield* Schema.decodeUnknown(BenchmarkSuitePlanSchema)(benchmarkSuitePlan, {
        onExcessProperty: "error"
      })

      expect(packageScripts.bench).toBe("bun run benchmark/run.ts")
      expect(Arr.sort(Record.keys(decodedPlan), Order.string)).toEqual(["engine", "objective", "sampler"])
      expect(decodedPlan.sampler.seeds.length).toBeGreaterThan(1)
      expect(decodedPlan.engine.seeds.length).toBeGreaterThan(1)
      expect(decodedPlan.objective.seeds.length).toBeGreaterThan(1)
      expect(Arr.sort(benchmarkFiles, Order.string)).toContain("run.ts")
      expect(Arr.sort(benchmarkFiles, Order.string)).toContain("harness.ts")
      expect(Arr.sort(benchmarkFiles, Order.string)).toContain("validation.ts")
      expect(typeof benchProgram).toBe("object")
    }).pipe(Effect.provide(BunContext.layer)))
})
