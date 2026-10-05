/**
 * Shared modules must expose one consistent projection at every depth.
 */
import { describe, expect, it } from "@effect/vitest"
import * as Module from "@scenesystems/effect-dsp/Module"
import { make as makeParameters } from "@scenesystems/effect-dsp/ModuleParameters"
import * as Signature from "@scenesystems/effect-dsp/Signature"
import { Array as Arr, Data, Effect, HashMap, Option, Record, Ref, Schema, Tuple } from "effect"

class Modules<S, X, Y, F, O> extends Data.Class<{
  readonly signature: S
  readonly x: X
  readonly y: Y
  readonly first: F
  readonly second: O
}> {}

const makeModules = () =>
  Effect.gen(function*() {
    const signature = yield* Signature.make("Answer", { question: Schema.String }, { answer: Schema.String })
    const x = yield* Module.predict("x", signature)
    const y = yield* Module.predict("y", signature)
    const first = yield* Module.compose(
      new Module.ComposeOptions({
        name: "shared",
        signature,
        subModules: Record.singleton("x", x),
        forward: () => Effect.succeed({ answer: "unused" })
      })
    )
    const other = yield* Module.compose(
      new Module.ComposeOptions({
        name: "shared",
        signature,
        subModules: Record.singleton("y", y),
        forward: () => Effect.succeed({ answer: "unused" })
      })
    )
    const second = new Module.Module({
      name: other.name,
      signature: other.signature,
      params: first.params,
      subModules: other.subModules,
      forward: other.forward
    })
    return new Modules({ signature, x, y, first, second })
  })

describe("shared module projection consistency", () => {
  it.effect("rejects conflicting direct aliases before changing any predictor parameters", () =>
    Effect.gen(function*() {
      const { signature, x, y, first, second } = yield* makeModules()
      const distinctX = yield* Module.predict("x", signature)
      const sameIdDifferentPredictor = new Module.Module({
        name: first.name,
        signature: first.signature,
        params: first.params,
        subModules: HashMap.map(first.subModules, (module) =>
          new Module.Structure({
            id: module.id,
            name: module.name,
            signature: module.signature,
            signatureDigest: module.signatureDigest,
            demonstrationCodec: module.demonstrationCodec,
            parameters: distinctX.params,
            subModules: module.subModules
          })),
        forward: first.forward
      })
      const refs = Arr.make(first.params, x.params, y.params, distinctX.params)
      const before = yield* Effect.forEach(refs, (ref) => Ref.get(ref))
      yield* Effect.forEach(Arr.make(second, sameIdDifferentPredictor), (conflicting) =>
        Effect.gen(function*() {
          const error = yield* Effect.flip(Module.compose(
            new Module.ComposeOptions({
              name: "root",
              signature,
              subModules: Record.set(Record.singleton("first", first), "second", conflicting),
              forward: () => Effect.succeed({ answer: "unused" })
            })
          ))
          expect(error._tag).toBe("CompositionError")
          expect(error.moduleName).toBe("shared")
          expect(error.message).toContain("inconsistent child declarations")
          expect(yield* Effect.forEach(refs, (ref) => Ref.get(ref))).toEqual(before)
        }))
    }))

  it.effect("rejects conflicting deep projections rather than losing one branch during persistence", () =>
    Effect.gen(function*() {
      const { signature, x, y, first, second } = yield* makeModules()
      const left = yield* Module.compose(
        new Module.ComposeOptions({
          name: "left",
          signature,
          subModules: Record.singleton("shared", first),
          forward: () => Effect.succeed({ answer: "unused" })
        })
      )
      const right = yield* Module.compose(
        new Module.ComposeOptions({
          name: "right",
          signature,
          subModules: Record.singleton("shared", second),
          forward: () => Effect.succeed({ answer: "unused" })
        })
      )
      const refs = Arr.make(left.params, right.params, first.params, x.params, y.params)
      const before = yield* Effect.forEach(refs, (ref) => Ref.get(ref))
      const error = yield* Effect.flip(Module.compose(
        new Module.ComposeOptions({
          name: "root",
          signature,
          subModules: Record.set(Record.singleton("left", left), "right", right),
          forward: () => Effect.succeed({ answer: "unused" })
        })
      ))
      expect(error._tag).toBe("CompositionError")
      expect(error.moduleName).toBe("shared")
      expect(error.message).toContain("inconsistent child declarations")
      expect(yield* Effect.forEach(refs, (ref) => Ref.get(ref))).toEqual(before)
    }))

  it.effect("accepts separately projected ordered declarations and persists every valid Ref", () =>
    Effect.gen(function*() {
      const { signature, x, y } = yield* makeModules()
      const first = yield* Module.compose(
        new Module.ComposeOptions({
          name: "shared",
          signature,
          subModules: Record.set(Record.singleton("x", x), "y", y),
          forward: () => Effect.succeed({ answer: "unused" })
        })
      )
      const second = new Module.Module({
        name: first.name,
        signature: first.signature,
        params: first.params,
        subModules: HashMap.fromIterable(
          Arr.reverse(
            Arr.map(
              HashMap.toEntries(first.subModules),
              ([id, module]) =>
                Tuple.make(
                  id,
                  new Module.Structure({
                    id: module.id,
                    name: module.name,
                    signature: module.signature,
                    signatureDigest: module.signatureDigest,
                    demonstrationCodec: module.demonstrationCodec,
                    parameters: module.parameters,
                    subModules: module.subModules
                  })
                )
            )
          )
        ),
        forward: first.forward
      })
      const left = yield* Module.compose(
        new Module.ComposeOptions({
          name: "left",
          signature,
          subModules: Record.singleton("shared", first),
          forward: () => Effect.succeed({ answer: "unused" })
        })
      )
      const right = yield* Module.compose(
        new Module.ComposeOptions({
          name: "right",
          signature,
          subModules: Record.singleton("shared", second),
          forward: () => Effect.succeed({ answer: "unused" })
        })
      )
      const root = yield* Module.compose(
        new Module.ComposeOptions({
          name: "root",
          signature,
          subModules: Record.set(Record.set(Record.singleton("left", left), "right", right), "shared", second),
          forward: () => Effect.succeed({ answer: "unused" })
        })
      )
      const expected = Arr.make(
        Tuple.make(x.params, "x params"),
        Tuple.make(y.params, "y params")
      )
      yield* Effect.forEach(
        expected,
        ([ref, instructions]) => Ref.set(ref, makeParameters(instructions))
      )
      const saved = yield* Module.save(root)
      expect(Arr.map(Record.values(saved.parameters), (entry) => entry.instructions)).toEqual(
        Arr.make("x params", "y params")
      )
      yield* Effect.forEach(expected, ([ref]) => Ref.set(ref, makeParameters("changed")))
      yield* Module.load(root, saved)
      yield* Effect.forEach(expected, ([ref, instructions]) =>
        Effect.gen(function*() {
          expect((yield* Ref.get(ref)).instructions).toBe(instructions)
        }))
    }))

  it.effect("rejects changed metadata or demonstration contracts on deep projections of the same Ref", () =>
    Effect.gen(function*() {
      const { signature, first } = yield* makeModules()
      const otherSignature = yield* Signature.make("Answer", { question: Schema.Finite }, { answer: Schema.String })
      const left = yield* Module.compose(
        new Module.ComposeOptions({
          name: "left",
          signature,
          subModules: Record.singleton("shared", first),
          forward: () => Effect.succeed({ answer: "unused" })
        })
      )
      const sharedId = yield* Schema.decodeEffect(Module.Id)("shared")
      const module = Option.getOrThrow(HashMap.get(left.subModules, sharedId))
      yield* Effect.forEach(
        Arr.make(
          Tuple.make(
            new Module.Structure({
              id: module.id,
              name: module.name,
              signatureDigest: module.signatureDigest,
              demonstrationCodec: module.demonstrationCodec,
              parameters: module.parameters,
              subModules: module.subModules,
              signature: new Signature.Text({
                description: "changed description",
                instructions: signature.instructions
              })
            }),
            "inconsistent signature metadata"
          ),
          Tuple.make(
            new Module.Structure({
              id: module.id,
              name: module.name,
              signatureDigest: module.signatureDigest,
              demonstrationCodec: module.demonstrationCodec,
              parameters: module.parameters,
              subModules: module.subModules,
              signature: new Signature.Text({
                description: signature.description,
                instructions: "changed instructions"
              })
            }),
            "inconsistent signature metadata"
          ),
          Tuple.make(
            new Module.Structure({
              id: module.id,
              name: module.name,
              signature: module.signature,
              signatureDigest: otherSignature.digest,
              demonstrationCodec: otherSignature.demonstrationCodec,
              parameters: module.parameters,
              subModules: module.subModules
            }),
            "inconsistent demonstration contract"
          )
        ),
        ([projection, message]) =>
          Effect.gen(function*() {
            const right = new Module.Module({
              name: "right",
              signature,
              params: yield* Ref.make(makeParameters("right")),
              subModules: HashMap.make(Tuple.make(sharedId, projection)),
              forward: () => Effect.succeed({ answer: "unused" })
            })
            const before = yield* Ref.get(first.params)
            const error = yield* Effect.flip(Module.compose(
              new Module.ComposeOptions({
                name: "root",
                signature,
                subModules: Record.set(Record.singleton("left", left), "right", right),
                forward: () => Effect.succeed({ answer: "unused" })
              })
            ))
            expect(error._tag).toBe("CompositionError")
            expect(error.moduleName).toBe("shared")
            expect(error.message).toContain(message)
            expect(yield* Ref.get(first.params)).toEqual(before)
          })
      )
    }))
})
