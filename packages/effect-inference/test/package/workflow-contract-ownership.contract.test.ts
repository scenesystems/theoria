import { BunContext } from "@effect/platform-bun"
import { describe, expect, it } from "@effect/vitest"
import { Array as Arr, Effect, Option, Record } from "effect"

import {
  listTypeScriptFilesInDir,
  moduleSpecifiers,
  parseTypeScript,
  publicExportDocs,
  readProjectFile
} from "@theoria/source-proof"

import * as Contracts from "../../src/contracts/index.js"

const repositoryRootUrl = new URL("../../../../", import.meta.url)
const appWorkflowComparisonContractPath = "apps/theoria/app/contracts/workflow/comparison.ts"

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

const workflowContractModuleSpecifiers = ["effect-inference/Contracts", "effect-inference/contracts"]

describe("package/workflow-contract-ownership", () => {
  it.effect("exports the reusable workflow and score family from effect-inference/contracts", () =>
    Effect.gen(function*() {
      const exportedKeys = Record.keys(Contracts)

      expect(Arr.every(workflowContractExports, (key) => Arr.some(exportedKeys, (exportedKey) => exportedKey === key)))
        .toBe(
          true
        )
    }))

  it.effect("keeps app demo contracts on selector and fixture roles over the package-owned workflow family", () =>
    Effect.gen(function*() {
      const appContractFiles = yield* Effect.all([
        listTypeScriptFilesInDir(repositoryRootUrl, "apps/theoria/app/contracts/demo"),
        listTypeScriptFilesInDir(repositoryRootUrl, "apps/theoria/app/contracts/workflow")
      ]).pipe(Effect.map(([demoFiles, workflowFiles]) => Arr.appendAll(demoFiles, workflowFiles)))

      const contractUsage = yield* Effect.forEach(appContractFiles, (file) =>
        Effect.gen(function*() {
          const source = yield* readProjectFile(repositoryRootUrl, file.relative)
          const parsed = parseTypeScript(file.relative, source)
          const exportNames = publicExportDocs(parsed).map((doc) => doc.exportName)
          const imports = moduleSpecifiers(parsed)

          return {
            file: file.relative,
            exportsWorkflowFamily: forbiddenDuplicateExports.some((name) => exportNames.includes(name)),
            importsWorkflowContracts: workflowContractModuleSpecifiers.some((specifier) => imports.includes(specifier))
          }
        }))

      expect(contractUsage.some((entry) => entry.exportsWorkflowFamily)).toBe(false)
      expect(
        Arr.filterMap(
          contractUsage,
          (entry) => entry.importsWorkflowContracts ? Option.some(entry.file) : Option.none()
        )
      ).toEqual([appWorkflowComparisonContractPath])
    }).pipe(Effect.provide(BunContext.layer)))
})
