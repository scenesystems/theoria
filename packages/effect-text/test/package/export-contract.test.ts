import { describe, expect, it } from "@effect/vitest"
import { Effect, Match, Record as EffectRecord, Schema } from "effect"
import * as Arr from "effect/Array"

import packageJson from "../../package.json" with { type: "json" }
import { TextStability } from "../../src/Text/index.js"

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
      "./Text",
      "./Contracts",
      "./Errors",
      "./Experimental",
      "./contracts",
      "./experimental",
      "./internal/*"
    ).sort()

    expect(EffectRecord.keys(exportsRecord).sort()).toStrictEqual(expectedExportPaths)
  })

  it.effect("keeps the internal boundary blocked and the experimental lane explicit", () =>
    Effect.gen(function*() {
      expect(exportsRecord["./internal/*"]).toStrictEqual(null)
      expect(exportsRecord["./experimental"]).toStrictEqual("./src/experimental/index.ts")
      expect(exportContainsExperimental(exportsRecord["."])).toStrictEqual(false)
    }))

  it("marks the Text namespace as provisional", () => {
    expect(TextStability).toStrictEqual("provisional")
  })
})
