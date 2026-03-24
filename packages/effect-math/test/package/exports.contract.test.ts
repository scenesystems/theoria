import { describe, expect, it } from "@effect/vitest"
import { Effect, Match, Record as EffectRecord, Schema } from "effect"
import * as Arr from "effect/Array"

import packageJson from "../../package.json" with { type: "json" }
import { ExperimentalSeams } from "../../src/experimental/index.js"
import { GeometryDomainModel } from "../../src/Geometry/model.js"

const ExportsRecordSchema = Schema.Record({ key: Schema.String, value: Schema.Unknown })
const ExportValuesSchema = Schema.Array(Schema.Unknown)

const exportsRecord = Schema.decodeUnknownSync(ExportsRecordSchema)(packageJson.exports)

const exportContainsExperimental = (value: unknown): boolean =>
  Match.value(value).pipe(
    Match.when(Match.string, (exportPath) => exportPath.includes("experimental")),
    Match.when(Arr.isArray, (paths) =>
      Schema.decodeUnknownSync(ExportValuesSchema)(paths).some((path) => exportContainsExperimental(path))),
    Match.when(Schema.is(ExportsRecordSchema), (nestedExports) =>
      EffectRecord.values(nestedExports).some((nested) =>
        exportContainsExperimental(nested)
      )),
    Match.orElse(() =>
      false
    )
  )

describe("package export contracts", () => {
  it("exposes the canonical public and blocked subpath export set", () => {
    const expectedExportPaths = Arr.make(
      ".",
      "./contracts",
      "./experimental",
      "./Numeric",
      "./Algebra",
      "./LinearAlgebra",
      "./Calculus",
      "./Special",
      "./Probability",
      "./Statistics",
      "./Optimization",
      "./Geometry",
      "./internal/*",
      "./Numeric/internal/*",
      "./Algebra/internal/*",
      "./LinearAlgebra/internal/*",
      "./Calculus/internal/*",
      "./Special/internal/*",
      "./Probability/internal/*",
      "./Statistics/internal/*",
      "./Optimization/internal/*",
      "./Geometry/internal/*"
    ).sort()

    expect(EffectRecord.keys(exportsRecord).sort()).toStrictEqual(expectedExportPaths)
  })

  it.effect("keeps every internal export path hard-blocked and experimental lane explicit", () =>
    Effect.gen(function*() {
      const blockedInternalPaths = Arr.make(
        "./internal/*",
        "./Numeric/internal/*",
        "./Algebra/internal/*",
        "./LinearAlgebra/internal/*",
        "./Calculus/internal/*",
        "./Special/internal/*",
        "./Probability/internal/*",
        "./Statistics/internal/*",
        "./Optimization/internal/*",
        "./Geometry/internal/*"
      )

      yield* Effect.forEach(
        blockedInternalPaths,
        (path) => Effect.sync(() => expect(exportsRecord[path]).toStrictEqual(null)),
        { discard: true }
      )

      const rootExport = exportsRecord["."]
      const experimentalExport = exportsRecord["./experimental"]

      expect(experimentalExport).toStrictEqual("./src/experimental/index.ts")
      expect(exportContainsExperimental(rootExport)).toStrictEqual(false)
    }))

  it("keeps Geometry provisional and isolates experimental seams", () => {
    expect(GeometryDomainModel.stability).toStrictEqual("provisional")

    const experimentalEntries = Arr.fromIterable(ExperimentalSeams)
    expect(experimentalEntries.length).toBeGreaterThan(0)
    expect(ExperimentalSeams.some((seam) => seam.includes("experimental"))).toStrictEqual(false)
  })
})
