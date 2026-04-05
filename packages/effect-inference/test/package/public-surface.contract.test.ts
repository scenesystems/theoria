import { describe, expect, it } from "@effect/vitest"
import { Order, Record, Schema } from "effect"
import * as Arr from "effect/Array"

import packageJson from "../../package.json" with { type: "json" }
import * as Inference from "../../src/index.js"

const PackageExportsSchema = Schema.Struct({
  exports: Schema.Record({ key: Schema.String, value: Schema.Unknown })
})

const packageExports = Schema.decodeUnknownSync(PackageExportsSchema)(packageJson).exports

describe("package/public-surface", () => {
  it("exports the planned public namespaces and subpaths", () => {
    expect(Arr.sort(Record.keys(Inference), Order.string)).toEqual([
      "Contracts",
      "Errors",
      "Experimental",
      "HuggingFace",
      "OpenAiCompatible",
      "Runtime",
      "Testing"
    ])

    expect(
      Arr.sort(
        Arr.filter(
          Record.keys(packageExports),
          (key) => key !== "./package.json" && key !== "./internal/*"
        ),
        Order.string
      )
    ).toEqual([
      ".",
      "./Contracts",
      "./Errors",
      "./HuggingFace",
      "./OpenAiCompatible",
      "./Runtime",
      "./Testing",
      "./experimental"
    ])

    expect(packageExports["./Experimental"]).toBeUndefined()
    expect(packageExports["./contracts"]).toBeUndefined()
  })
})
