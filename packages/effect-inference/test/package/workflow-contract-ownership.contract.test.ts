import { BunContext } from "@effect/platform-bun"
import { describe, expect, it } from "@effect/vitest"
import { Array as Arr, Effect, Record } from "effect"

import {
  listTypeScriptFilesInDir,
  moduleSpecifiers,
  parseTypeScript,
  publicExportDocs,
  readProjectFile
} from "@theoria/source-proof"

import * as Contracts from "../../src/contracts/index.js"

const repositoryRootUrl = new URL("../../../../", import.meta.url)

const workflowContractExports = [
  "WorkflowKindSchema",
  "WorkflowNodeKindSchema",
  "WorkflowEdgeKindSchema",
  "WorkflowLoopPolicySchema",
  "WorkflowStateLaneSchema",
  "GraphVariantSchema",
  "OptimizationKnobKindSchema",
  "EvaluationProfileFamilySchema",
  "SessionManifestSchema",
  "NodeExecutionContractSchema",
  "GraphExecutionManifestSchema",
  "GraphExecutionProjectionSchema",
  "EvaluationContractSchema",
  "WorkflowExecutionRecordSchema",
  "ScoreComponentKindSchema",
  "ScoreWeightsSchema",
  "ScoreProfileSchema",
  "ScoreComponentResultSchema",
  "ScoreLossSummarySchema",
  "WorkflowEvaluationReportSchema"
]

const forbiddenDuplicateExports = [
  "WorkflowKindSchema",
  "SessionManifestSchema",
  "NodeExecutionContractSchema",
  "GraphExecutionManifestSchema",
  "GraphExecutionProjectionSchema",
  "EvaluationContractSchema",
  "WorkflowExecutionRecordSchema",
  "ScoreComponentKindSchema",
  "ScoreWeightsSchema",
  "ScoreProfileSchema",
  "ScoreComponentResultSchema",
  "ScoreLossSummarySchema",
  "WorkflowEvaluationReportSchema"
]

const forbiddenWorkflowModuleSpecifiers = [
  "effect-inference/Contracts",
  "effect-inference/contracts",
  "../../effect-inference/src/contracts/index.js",
  "../../../effect-inference/src/contracts/index.js"
]

describe("package/workflow-contract-ownership", () => {
  it.effect("exports the reusable workflow and score family from effect-inference/contracts", () =>
    Effect.gen(function*() {
      const exportedKeys = Record.keys(Contracts)

      expect(Arr.every(workflowContractExports, (key) => Arr.some(exportedKeys, (exportedKey) => exportedKey === key)))
        .toBe(
          true
        )
    }))

  it.effect("keeps effect-dsp/contracts and app demo contracts free of duplicate workflow-family exports", () =>
    Effect.gen(function*() {
      const effectDspContractFiles = yield* listTypeScriptFilesInDir(
        repositoryRootUrl,
        "packages/effect-dsp/src/contracts"
      )
      const appDemoContractFiles = yield* listTypeScriptFilesInDir(repositoryRootUrl, "apps/theoria/app/contracts/demo")
      const filesToInspect = [...effectDspContractFiles, ...appDemoContractFiles]

      const duplicateExports = yield* Effect.forEach(filesToInspect, (file) =>
        Effect.gen(function*() {
          const source = yield* readProjectFile(repositoryRootUrl, file.relative)
          const parsed = parseTypeScript(file.relative, source)
          const exportNames = publicExportDocs(parsed).map((doc) => doc.exportName)
          const imports = moduleSpecifiers(parsed)

          return {
            file: file.relative,
            exportsWorkflowFamily: forbiddenDuplicateExports.some((name) => exportNames.includes(name)),
            reexportsWorkflowContracts: forbiddenWorkflowModuleSpecifiers.some((specifier) =>
              imports.includes(specifier)
            )
          }
        }))

      expect(duplicateExports.some((entry) => entry.exportsWorkflowFamily)).toBe(false)
      expect(duplicateExports.some((entry) => entry.reexportsWorkflowContracts)).toBe(false)
    }).pipe(Effect.provide(BunContext.layer)))
})
