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
const appWorkflowAuthorityContractPaths = [
  "apps/theoria/app/contracts/study/workflow/evidence-presentation.ts",
  "apps/theoria/app/contracts/study/workflow/evidence.ts",
  "apps/theoria/app/contracts/study/workflow/execution.ts",
  "apps/theoria/app/contracts/study/workflow/frozen.ts",
  "apps/theoria/app/contracts/study/workflow/runtime-plan.ts",
  "apps/theoria/app/contracts/study/workflow/scenario.ts",
  "apps/theoria/app/contracts/study/workflow/step.ts",
  "apps/theoria/app/contracts/study/workflow/view-presentation.ts",
  "apps/theoria/app/contracts/study/workflow/workflow-hookup.ts"
]

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

  it.effect("keeps app workflow authority on the study/workflow contract seams only", () =>
    Effect.gen(function*() {
      const appContractFiles = yield* listTypeScriptFilesInDir(
        repositoryRootUrl,
        "apps/theoria/app/contracts/study/workflow"
      )

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
      ).toEqual(appWorkflowAuthorityContractPaths)
    }).pipe(Effect.provide(BunContext.layer)))
})
