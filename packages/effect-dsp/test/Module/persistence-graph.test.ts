/**
 * Live shared-owner persistence and validation atomicity.
 */
import { describe, expect, it } from "@effect/vitest"
import { Demonstration } from "@scenesystems/effect-dsp/Demonstration"
import * as Module from "@scenesystems/effect-dsp/Module"
import { ModuleParameters } from "@scenesystems/effect-dsp/ModuleParameters"
import * as Signature from "@scenesystems/effect-dsp/Signature"
import { Array as Arr, Effect, Record, Ref, Schema, Tuple } from "effect"

const makeSignature = () => Signature.make("Answer", { question: Schema.String }, { answer: Schema.String })
const params = (instructions: string) => new ModuleParameters({ instructions, demos: Arr.empty() })

describe("graph parameter persistence", () => {
  it.effect("round-trips every distinct Ref through projected diamonds and direct shared children", () =>
    Effect.gen(function*() {
      const signature = yield* makeSignature()
      const leaf = yield* Module.predict("shared", signature)
      const extra = yield* Module.predict("z-extra", signature)
      const left = yield* Module.compose(
        new Module.ComposeOptions({
          name: "a-left",
          signature,
          subModules: Record.singleton("leaf", leaf),
          forward: ({ input }) => leaf.forward(input)
        })
      )
      const right = yield* Module.compose(
        new Module.ComposeOptions({
          name: "b-right",
          signature,
          subModules: Record.set(Record.singleton("leaf", leaf), "extra", extra),
          forward: ({ input }) => leaf.forward(input)
        })
      )
      const root = yield* Module.compose(
        new Module.ComposeOptions({
          name: "root",
          signature,
          subModules: Record.set(Record.set(Record.singleton("right", right), "left", left), "shared", leaf),
          forward: ({ input }) => left.forward(input)
        })
      )
      const expected = Arr.make(
        Tuple.make(leaf.params, params("shared value")),
        Tuple.make(extra.params, params("extra value"))
      )
      yield* Effect.forEach(expected, ([ref, value]) => Ref.set(ref, value))
      const saved = yield* Module.save(root)
      expect(saved.parameters).toEqual({
        "root.left.leaf": params("shared value"),
        "root.right.extra": params("extra value")
      })
      yield* Effect.forEach(expected, ([ref]) => Ref.set(ref, params("mutated")))
      yield* Module.load(root, saved)
      yield* Effect.forEach(expected, ([ref, value]) =>
        Effect.gen(function*() {
          expect(yield* Ref.get(ref)).toEqual(value)
        }))
    }))

  it.effect("keeps every target unchanged when a predictor path is unknown, missing, or invalid", () =>
    Effect.gen(function*() {
      const signature = yield* makeSignature()
      const leaf = yield* Module.predict("leaf", signature)
      const root = yield* Module.compose(
        new Module.ComposeOptions({
          name: "root",
          signature,
          subModules: Record.singleton("leaf", leaf),
          forward: ({ input }) => leaf.forward(input)
        })
      )
      const originalRoot = yield* Ref.get(root.params)
      const originalLeaf = yield* Ref.get(leaf.params)
      yield* Effect.forEach(
        Arr.make(
          { parameters: { "root.leaf": params("changed leaf"), stranger: params("bad") } },
          { parameters: {} },
          { parameters: { "root.leaf": { instructions: 42, demos: Arr.empty() } } }
        ),
        (invalid) =>
          Effect.gen(function*() {
            const error = yield* Effect.flip(Module.load(root, invalid))
            expect(error._tag).toBe("SaveLoadError")
            expect(yield* Ref.get(root.params)).toBe(originalRoot)
            expect(yield* Ref.get(leaf.params)).toBe(originalLeaf)
          })
      )
    }))

  it.effect("validates all destination demos before loading any ref, preserving nested encoded values", () =>
    Effect.gen(function*() {
      const signature = yield* makeSignature()
      const childSignature = yield* Signature.make("Count", {
        facts: Schema.Struct({ count: Schema.FiniteFromString })
      }, { result: Schema.Struct({ count: Schema.FiniteFromString }) })
      const leaf = yield* Module.predict("leaf", childSignature)
      const root = yield* Module.compose(
        new Module.ComposeOptions({
          name: "root",
          signature,
          subModules: { leaf },
          forward: () => Effect.succeed({ answer: "unused" })
        })
      )
      const originalRoot = yield* Ref.get(root.params)
      const originalLeaf = yield* Ref.get(leaf.params)
      const invalidDemos = Arr.make(
        new Demonstration({ input: { facts: { count: 7 } }, output: { result: { count: "3" } } }),
        new Demonstration({
          input: { facts: { count: "007", provenance: "source-A" } },
          output: { result: { count: "3" } }
        }),
        new Demonstration({ input: { facts: { count: "007" } }, output: { result: { count: "3", extra: true } } })
      )
      yield* Effect.forEach(invalidDemos, (demo) =>
        Effect.gen(function*() {
          const failure = yield* Module.load(
            root,
            new Module.SavedState({
              parameters: {
                "root.leaf": new ModuleParameters({ instructions: "invalid child", demos: Arr.make(demo) })
              }
            })
          ).pipe(Effect.flip)
          expect(failure._tag).toBe("SaveLoadError")
          expect(failure.message).toContain("leaf")
          expect(yield* Ref.get(root.params)).toBe(originalRoot)
          expect(yield* Ref.get(leaf.params)).toBe(originalLeaf)
        }))
      const valid = new Demonstration({ input: { facts: { count: "007" } }, output: { result: { count: "03" } } })
      yield* Module.load(
        root,
        new Module.SavedState({
          parameters: {
            "root.leaf": new ModuleParameters({ instructions: "valid child", demos: Arr.make(valid) })
          }
        })
      )
      expect(yield* Ref.get(root.params)).toBe(originalRoot)
      expect((yield* Ref.get(leaf.params)).demos).toEqual(Arr.make(valid))
    }))

  it.effect("rejects a non-predictor root path before installing any leaf", () =>
    Effect.gen(function*() {
      const signature = yield* makeSignature()
      const leaf = yield* Module.predict("leaf", signature)
      const root = yield* Module.compose(
        new Module.ComposeOptions({
          name: "root",
          signature,
          subModules: { leaf },
          forward: ({ input }) => leaf.forward(input)
        })
      )
      const before = yield* Ref.get(leaf.params)
      const error = yield* Effect.flip(Module.load(
        root,
        new Module.SavedState({
          parameters: { root: params("not a predictor"), "root.leaf": params("replacement") }
        })
      ))
      expect(error.message).toBe("Saved state contains unknown predictor path 'root'")
      expect(yield* Ref.get(leaf.params)).toBe(before)
    }))
})
