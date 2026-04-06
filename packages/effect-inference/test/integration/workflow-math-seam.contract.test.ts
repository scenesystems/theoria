import { BunContext } from "@effect/platform-bun"
import { describe, expect, it } from "@effect/vitest"
import { Chunk, Effect, Schema } from "effect"

import { moduleSpecifiers, parseTypeScript, readProjectFile } from "@theoria/source-proof"
import { lossSummary, weightedMean } from "effect-math/Statistics"

import * as Contracts from "../../src/contracts/index.js"

import { renderSensitiveProfile, workflowEvaluationReport } from "./workflowFixtures.js"

const repositoryRootUrl = new URL("../../../../", import.meta.url)
const workflowEvaluationReportPath = "packages/effect-inference/src/contracts/WorkflowEvaluationReport.ts"

describe("integration/workflow-math-seam", () => {
  it.effect("builds aggregate score and loss summary from effect-math public kernels while keeping report schemas plain", () =>
    Effect.gen(function*() {
      const profile = yield* Schema.decodeUnknown(Contracts.ScoreProfileSchema)(renderSensitiveProfile)
      const aggregateScore = weightedMean(
        Chunk.make(0.9, 0.88, 0.875),
        Chunk.make(0.4, 0.15, 0.05)
      )
      const summary = lossSummary(Chunk.make(0.1, 0.28))
      const report = yield* Schema.decodeUnknown(Contracts.WorkflowEvaluationReportSchema)({
        ...workflowEvaluationReport,
        profile,
        aggregateScore,
        lossSummary: {
          count: summary.count,
          mean: summary.mean,
          minimum: summary.min,
          maximum: summary.max,
          variance: summary.variance,
          standardDeviation: summary.standardDeviation
        }
      })
      const contractSource = yield* readProjectFile(repositoryRootUrl, workflowEvaluationReportPath)
      const contractImports = moduleSpecifiers(parseTypeScript(workflowEvaluationReportPath, contractSource))

      expect(report.aggregateScore).toBe(aggregateScore)
      expect(report.lossSummary.mean).toBe(summary.mean)
      expect(report.lossSummary.standardDeviation).toBe(summary.standardDeviation)
      expect(contractImports.some((specifier) => specifier.startsWith("effect-math"))).toBe(false)
    }).pipe(Effect.provide(BunContext.layer)))
})
