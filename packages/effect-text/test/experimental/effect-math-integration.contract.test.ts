import { FileSystem } from "@effect/platform"
import { BunContext } from "@effect/platform-bun"
import { describe, expect, it } from "@effect/vitest"
import { Effect } from "effect"
import { Sampler } from "effect-search"
import * as Arr from "effect/Array"

import { listTypeScriptFilesInDir, moduleSpecifiers, parseTypeScript } from "@theoria/source-proof"

import { scoreCalibrationReportSync } from "../../src/experimental/Calibration/internal/scoring.js"
import { Experimental } from "../../src/index.js"
import {
  calibrationServices,
  canonicalCalibrationCases,
  defaultCalibrationProfile,
  defaultSearchDescriptor
} from "./fixtures.js"

const packageRootUrl = new URL("../../", import.meta.url)

const manualScore = (
  report: Experimental.Calibration.CalibrationReportType,
  objective: Experimental.Calibration.CalibrationObjectiveMetadataType
): number =>
  report.results.reduce(
    (total, result) =>
      total +
      (result.lineMismatchCount * objective.scoreWeights.lineMismatchCount) +
      (Math.abs(result.lineCountDelta) * objective.scoreWeights.lineCountError) +
      (Math.abs(result.maxLineWidthDelta) * objective.scoreWeights.maxLineWidthError),
    0
  )

describe("Experimental.Calibration effect-math integration contracts", () => {
  const parsedSourceFiles = Effect.gen(function*() {
    const fileSystem = yield* FileSystem.FileSystem
    const sourceFiles = yield* listTypeScriptFilesInDir(packageRootUrl, "src")

    return yield* Effect.forEach(sourceFiles, (file) =>
      fileSystem.readFileString(file.absolute).pipe(
        Effect.orDie,
        Effect.map((source) => ({
          path: file.relative,
          specifiers: moduleSpecifiers(parseTypeScript(file.relative, source))
        }))
      ))
  })

  it.effect("effect-math-backed calibration imports stay confined to the experimental calibration lane", () =>
    Effect.gen(function*() {
      const sourceFiles = yield* parsedSourceFiles
      const effectMathImporters = Arr.filter(
        sourceFiles,
        (file) => Arr.some(file.specifiers, (specifier) => specifier === "effect-math")
      )

      expect(effectMathImporters.length).toBeGreaterThan(0)
      expect(
        Arr.every(
          effectMathImporters,
          (file) => file.path.startsWith("src/experimental/Calibration/")
        )
      ).toBe(true)
    }).pipe(Effect.provide(BunContext.layer)))

  it.effect("effect-math-backed loss aggregation matches the released scorer on the canonical corpus", () =>
    Effect.gen(function*() {
      const optimized = yield* Experimental.Calibration.optimizeProfile({
        cases: canonicalCalibrationCases,
        services: calibrationServices,
        trials: 1,
        sampler: Sampler.grid(),
        searchDescriptor: defaultSearchDescriptor
      })

      expect(optimized.optimization.bestScore).toBe(
        manualScore(optimized.bestReport, optimized.optimization.objective)
      )
    }))

  it.effect("calibration scoring stays cache-backed without mutating public report objects", () =>
    Effect.gen(function*() {
      const report = yield* Experimental.Calibration.evaluateProfile(
        defaultCalibrationProfile,
        canonicalCalibrationCases
      ).pipe(Effect.provide(calibrationServices))
      const firstScore = scoreCalibrationReportSync(report, Experimental.Calibration.DefaultCalibrationObjective)
      const secondScore = scoreCalibrationReportSync(report, Experimental.Calibration.DefaultCalibrationObjective)

      expect(firstScore).toEqual(secondScore)
      expect(Object.getOwnPropertySymbols(report)).toEqual([])
    }))

  it.effect("effect-math imports stay out of stable Text, Contracts, Errors, and stable experimental barrels", () =>
    Effect.gen(function*() {
      const sourceFiles = yield* parsedSourceFiles
      const publicLeakPaths = Arr.filter(
        sourceFiles,
        (file) =>
          Arr.some(file.specifiers, (specifier) => specifier === "effect-math") &&
          (
            file.path.startsWith("src/Text/") ||
            file.path.startsWith("src/contracts/") ||
            file.path.startsWith("src/Errors/") ||
            file.path === "src/experimental/index.ts" ||
            file.path === "src/experimental/Calibration/index.ts" ||
            file.path === "src/experimental/Calibration/evaluation.ts" ||
            file.path === "src/experimental/Calibration/search.ts"
          )
      )

      expect(publicLeakPaths.map((file) => file.path)).toEqual([])
    }).pipe(Effect.provide(BunContext.layer)))
})
