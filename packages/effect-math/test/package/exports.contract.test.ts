import { describe, expect, it } from "@effect/vitest"
import { Effect, Record as EffectRecord, Schema } from "effect"
import * as Arr from "effect/Array"

import packageJson from "../../package.json" with { type: "json" }
import { ExperimentalSeams } from "../../src/experimental/index.js"
import { GeometryDomainModel } from "../../src/Geometry/model.js"

const ExportsRecordSchema = Schema.Record({ key: Schema.String, value: Schema.Unknown })

const exportsRecord = Schema.decodeUnknownSync(ExportsRecordSchema)(packageJson.exports)

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
      "./Complex",
      "./Distribution",
      "./Distribution/internal/*",
      "./internal/*",
      "./Numeric/internal/*",
      "./Algebra/internal/*",
      "./LinearAlgebra/internal/*",
      "./Calculus/internal/*",
      "./Special/internal/*",
      "./Probability/internal/*",
      "./Statistics/internal/*",
      "./Optimization/internal/*",
      "./Geometry/internal/*",
      "./Complex/internal/*"
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
        "./Geometry/internal/*",
        "./Complex/internal/*",
        "./Distribution/internal/*"
      )

      yield* Effect.forEach(
        blockedInternalPaths,
        (path) => Effect.sync(() => expect(exportsRecord[path]).toStrictEqual(null)),
        { discard: true }
      )

      const rootExport = exportsRecord["."]
      const experimentalExport = exportsRecord["./experimental"]

      expect(rootExport).toStrictEqual("./src/index.ts")
      expect(experimentalExport).toStrictEqual("./src/experimental/index.ts")
    }))

  it("keeps Geometry provisional and isolates experimental seams", () => {
    expect(GeometryDomainModel.stability).toStrictEqual("provisional")

    const experimentalEntries = Arr.fromIterable(ExperimentalSeams)
    expect(experimentalEntries.length).toBeGreaterThan(0)
    expect(experimentalEntries.sort()).toStrictEqual(["Machine", "Persistence", "VariantSchema"].sort())
  })
})
