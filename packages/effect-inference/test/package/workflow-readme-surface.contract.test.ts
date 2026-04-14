import { FileSystem, Path } from "@effect/platform"
import { BunContext } from "@effect/platform-bun"
import { describe, expect, it } from "@effect/vitest"
import { Effect } from "effect"

import * as Contracts from "../../src/contracts/index.js"

const packageRootUrl = new URL("../../", import.meta.url)

describe("package/workflow-readme-surface", () => {
  it.effect("documents only the shipped workflow and score contract surface", () =>
    Effect.gen(function*() {
      const fileSystem = yield* FileSystem.FileSystem
      const path = yield* Path.Path
      const root = yield* path.fromFileUrl(packageRootUrl).pipe(Effect.orDie)
      const readme = yield* fileSystem.readFileString(path.join(root, "README.md")).pipe(Effect.orDie)
      const example = yield* fileSystem.readFileString(path.join(root, "examples/05-workflow-contracts.ts")).pipe(
        Effect.orDie
      )

      expect(Contracts.WorkflowKindSchema).toBeDefined()
      expect(Contracts.SessionManifestSchema).toBeDefined()
      expect(Contracts.WorkflowExecutionRecordSchema).toBeDefined()
      expect(Contracts.ScoreProfileSchema).toBeDefined()
      expect(Contracts.WorkflowEvaluationReportSchema).toBeDefined()

      expect(readme).toContain("## How Do I Read Stored Workflow Evidence?")
      expect(readme).toContain("effect-inference/Contracts")
      expect(readme).toContain("WorkflowExecutionRecordSchema")
      expect(readme).toContain("WorkflowEvaluationReportSchema")
      expect(readme).toContain("ScoreProfile")
      expect(readme).toContain("WorkflowStateLane")
      expect(readme).not.toContain("WorkflowVocabulary")
      expect(readme).toContain("examples/05-workflow-contracts.ts")
      expect(readme).toContain("stored workflow evidence")
      expect(readme).toContain("runtime provenance")

      expect(example).toContain("WorkflowExecutionRecordSchema")
      expect(example).toContain("WorkflowEvaluationReportSchema")
      expect(example).toContain("aggregateScore")
    }).pipe(Effect.provide(BunContext.layer)))
})
