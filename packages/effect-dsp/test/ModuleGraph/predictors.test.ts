import { describe, expect, it } from "@effect/vitest"
import { Array as Arr, Chunk, Effect, Record, Schema } from "effect"
import * as Module from "../../src/Module.js"
import * as ModuleGraph from "../../src/ModuleGraph.js"
import * as ParameterSet from "../../src/ParameterSet.js"
import * as Signature from "../../src/Signature.js"

describe("predictor ownership", () => {
  it.effect("retains declaration paths, deduplicates shared owners, and excludes frozen subtrees", () =>
    Effect.gen(function*() {
      const signature = yield* Signature.make("Answer", { question: Schema.String }, { answer: Schema.String })
      const shared = yield* Module.predict("shared", signature)
      const frozen = yield* Module.predict("frozen", signature)
      const root = yield* Module.compose(
        new Module.ComposeOptions({
          name: "qa",
          signature,
          subModules: { first: shared, second: shared, excluded: Module.freeze(frozen) },
          forward: ({ input }) => shared.forward(input)
        })
      )
      const predictors = Chunk.toArray(ModuleGraph.predictors(root))
      expect(Arr.map(predictors, (value) => [value.id, value.ownership, Chunk.toArray(value.aliases)])).toEqual([
        ["qa.excluded", "frozen", []],
        ["qa.first", "shared", ["qa.second"]]
      ])
      expect(Record.keys(yield* ParameterSet.snapshot(root, { optimizable: true }))).toEqual(["qa.first"])
      expect(Record.keys(yield* ParameterSet.snapshot(root))).toEqual(["qa.excluded", "qa.first"])
    }))
})
