import { describe, expect, it } from "@effect/vitest"
import { Effect, Order, Record as EffectRecord, Schema } from "effect"
import * as Arr from "effect/Array"

import packageJson from "../../package.json" with { type: "json" }
import { TextStability } from "../../src/Text/index.js"

const ExportsRecordSchema = Schema.Record({ key: Schema.String, value: Schema.Unknown })

const exportsRecord = Schema.decodeUnknownSync(ExportsRecordSchema)(packageJson.exports)
const sortStrings = (values: ReadonlyArray<string>): ReadonlyArray<string> => Arr.sort(values, Order.string)

describe("package export contracts", () => {
  it("exposes the canonical public and blocked subpath export set", () => {
    const expectedExportPaths = sortStrings(Arr.make(
      ".",
      "./browser",
      "./react",
      "./Text",
      "./Browser",
      "./React",
      "./Contracts",
      "./Errors",
      "./Experimental",
      "./contracts",
      "./experimental",
      "./internal/*",
      "./Text/internal/*",
      "./Browser/internal/*",
      "./React/internal/*",
      "./experimental/*/internal/*"
    ))

    expect(sortStrings(EffectRecord.keys(exportsRecord))).toStrictEqual(expectedExportPaths)
  })

  it.effect("keeps every internal export path hard-blocked and the experimental lane explicit", () =>
    Effect.gen(function*() {
      const blockedInternalPaths = Arr.make(
        "./internal/*",
        "./Text/internal/*",
        "./Browser/internal/*",
        "./React/internal/*",
        "./experimental/*/internal/*"
      )

      yield* Effect.forEach(
        blockedInternalPaths,
        (path) => Effect.sync(() => expect(exportsRecord[path]).toStrictEqual(null)),
        { discard: true }
      )

      expect(exportsRecord["./Contracts"]).toStrictEqual("./src/contracts/index.ts")
      expect(exportsRecord["./contracts"]).toStrictEqual("./src/contracts/index.ts")
      expect(exportsRecord["."]).toStrictEqual("./src/index.ts")
      expect(exportsRecord["./experimental"]).toStrictEqual("./src/experimental/index.ts")
    }))

  it("marks the Text namespace as provisional", () => {
    expect(TextStability).toStrictEqual("provisional")
  })
})
