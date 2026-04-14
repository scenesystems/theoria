import { BunContext } from "@effect/platform-bun"
import { describe, expect, it } from "@effect/vitest"
import { Array as Arr, Effect } from "effect"

import {
  listTypeScriptFilesInDir,
  moduleSpecifiers,
  parseTypeScript,
  publicExportDocs,
  readProjectFile
} from "@theoria/source-proof"

const repositoryRootUrl = new URL("../../../../", import.meta.url)
const interopContractPath = "packages/effect-dsp/src/contracts/WorkflowInterop.ts"
const workflowContractSpecifiers = Arr.make("effect-inference/Contracts", "effect-inference/contracts")
const forbiddenWorkflowExports = Arr.make(
  "WorkflowKindSchema",
  "SessionManifestSchema",
  "NodeExecutionContractSchema",
  "GraphExecutionManifestSchema",
  "GraphExecutionProjectionSchema",
  "EvaluationContractSchema",
  "WorkflowExecutionRecordSchema"
)

describe("package/workflow-interop-governance", () => {
  it.effect("routes workflow-family imports through the canonical contracts interop seam only", () =>
    Effect.gen(function*() {
      const contractFiles = yield* listTypeScriptFilesInDir(repositoryRootUrl, "packages/effect-dsp/src/contracts")
      const importOwners = yield* Effect.forEach(contractFiles, (file) =>
        Effect.gen(function*() {
          const source = yield* readProjectFile(repositoryRootUrl, file.relative)
          const parsed = parseTypeScript(file.relative, source)
          const imports = moduleSpecifiers(parsed)

          return Arr.some(workflowContractSpecifiers, (specifier) => imports.includes(specifier))
            ? file.relative
            : null
        }))

      expect(importOwners.filter((owner) => owner !== null)).toEqual([interopContractPath])
    }).pipe(Effect.provide(BunContext.layer)))

  it.effect("keeps the contracts barrel pointed at workflow interop without re-exporting workflow-family ownership", () =>
    Effect.gen(function*() {
      const barrelSource = yield* readProjectFile(repositoryRootUrl, "packages/effect-dsp/src/contracts/index.ts")
      const interopSource = yield* readProjectFile(repositoryRootUrl, interopContractPath)
      const interopExports = publicExportDocs(parseTypeScript(interopContractPath, interopSource)).map(
        (doc) => doc.exportName
      )

      expect(barrelSource).toContain("./WorkflowInterop.js")
      expect(barrelSource).toContain("WorkflowGraphInputSchema")
      expect(barrelSource).toContain("WorkflowGraphProjection")
      expect(barrelSource).not.toContain("WorkflowModuleGraphInputSchema")
      expect(barrelSource).not.toContain("WorkflowModuleGraphProjection")
      expect(Arr.some(forbiddenWorkflowExports, (exportName) => interopExports.includes(exportName))).toBe(false)
      expect(interopExports).toEqual([
        "WorkflowGraphInputSchema",
        "WorkflowGraphInput",
        "WorkflowNodeLineage",
        "WorkflowGraphProjection",
        "WorkflowInteropOwnership"
      ])
    }).pipe(Effect.provide(BunContext.layer)))
})
