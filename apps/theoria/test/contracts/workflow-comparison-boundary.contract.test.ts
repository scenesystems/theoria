import { BunContext } from "@effect/platform-bun"
import { describe, expect, it } from "@effect/vitest"
import { Effect } from "effect"

import { moduleSpecifiers, parseTypeScript, publicExportDocs, readProjectFile } from "@theoria/source-proof"

const appRootUrl = new URL("../../", import.meta.url)
const workflowComparisonContractPath = "app/contracts/workflow/comparison.ts"
const forbiddenWorkflowExports = [
  "WorkflowKindSchema",
  "SessionManifestSchema",
  "NodeExecutionContractSchema",
  "GraphExecutionManifestSchema",
  "GraphExecutionProjectionSchema",
  "EvaluationContractSchema",
  "WorkflowExecutionRecordSchema"
]

describe("Theoria Workflow Comparison Contract Boundary", () => {
  it.effect("imports workflow authority from effect-inference without re-exporting the package-owned family", () =>
    Effect.gen(function*() {
      const source = yield* readProjectFile(appRootUrl, workflowComparisonContractPath)
      const parsed = parseTypeScript(workflowComparisonContractPath, source)
      const imports = moduleSpecifiers(parsed)
      const exportNames = publicExportDocs(parsed).map((doc) => doc.exportName)

      expect(imports).toContain("effect-inference/Contracts")
      expect(imports).not.toContain("effect-dsp/Contracts")
      expect(forbiddenWorkflowExports.some((name) => exportNames.includes(name))).toBe(false)
    }).pipe(Effect.provide(BunContext.layer)))
})
