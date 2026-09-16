/**
 * Bootstrap demonstration equality and capacity preserve lazy evaluation.
 */
import { describe, expect, it } from "@effect/vitest"
import { Demonstration } from "@scenesystems/effect-dsp/Demonstration"
import { Example } from "@scenesystems/effect-dsp/Example"
import * as Signature from "@scenesystems/effect-dsp/Signature"
import { Array as Arr, Effect, MutableRef, Number, Option, Schema, String } from "effect"
import {
  labeledTrainset,
  mergeAcceptedDemos,
  roundInstructions
} from "../../src/internal/bootstrapFewShot/runtime/demos.js"

describe("bootstrap demonstration helpers", () => {
  it.effect("compares outputs only for matching inputs while capacity remains", () =>
    Effect.gen(function*() {
      const reads = MutableRef.make(0)
      const signature = yield* Signature.make("Nested demos", {
        facts: Schema.Struct({ questions: Schema.Array(Schema.String) })
      }, {
        answer: Schema.String.annotations({
          equivalence: () => (left, right) => {
            MutableRef.increment(reads)
            return String.Equivalence(left, right)
          }
        })
      })
      const makeDemo = (question: string) =>
        new Demonstration({
          input: { facts: { questions: Arr.make(question) } },
          output: { answer: "Paris" }
        })
      const existing = makeDemo("France")
      const different = makeDemo("Another question")
      const duplicate = makeDemo("France")

      const distinct = yield* mergeAcceptedDemos({
        existing: Arr.make(existing),
        accepted: Arr.make(different),
        maxBootstrappedDemos: 2,
        contract: signature.demonstrationCodec
      })
      expect(distinct.added).toBe(1)
      expect(Arr.length(distinct.demos)).toBe(2)
      expect(MutableRef.get(reads)).toBe(0)

      const deduped = yield* mergeAcceptedDemos({
        existing: Arr.make(existing),
        accepted: Arr.make(duplicate),
        maxBootstrappedDemos: 2,
        contract: signature.demonstrationCodec
      })
      expect(deduped.added).toBe(0)
      expect(Arr.length(deduped.demos)).toBe(1)
      expect(Number.greaterThan(MutableRef.get(reads), 0)).toBe(true)
      MutableRef.set(reads, 0)

      const merged = yield* mergeAcceptedDemos({
        existing: Arr.make(existing),
        accepted: Arr.make(duplicate),
        maxBootstrappedDemos: 1,
        contract: signature.demonstrationCodec
      })
      expect(merged.added).toBe(0)
      expect(Arr.length(merged.demos)).toBe(1)
      expect(MutableRef.get(reads)).toBe(0)
    }))

  it.effect("filters unlabeled examples, normalizes limits, and retains round markers", () =>
    Effect.gen(function*() {
      const first = new Example({ input: { question: "France" }, output: { answer: "Paris" } })
      const second = new Example({ input: { question: "Japan" }, output: { answer: "Tokyo" } })
      const rows = Arr.make(new Example({ input: { question: "Unlabeled" } }), first, second)
      expect(labeledTrainset(rows, Option.some(1.8))).toEqual(Arr.make(first))
      expect(labeledTrainset(rows, Option.some(0))).toEqual(Arr.make(first, second))
      expect(roundInstructions("Answer briefly", 3)).toBe("Answer briefly\n\n[bootstrap-round:3]")
    }))
})
