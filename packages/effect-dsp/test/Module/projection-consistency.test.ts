/**
 * Shared live owners must expose one consistent projection at every depth.
 */
import { describe, expect, it } from "@effect/vitest"
import * as Contracts from "@scenesystems/effect-dsp/contracts"
import * as Module from "@scenesystems/effect-dsp/Module"
import * as Signature from "@scenesystems/effect-dsp/Signature"
import { Array as Arr, Data, Effect, HashMap, Record, Ref, Schema, Tuple } from "effect"

const makeOwners = () =>
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
    const second = new Module.Module({ ...other, params: first.params })
    return Data.struct({ signature, x, y, first, second })
  })

describe("shared owner projection consistency", () => {
  it.effect("rejects conflicting direct aliases before changing any owner params", () =>
    Effect.gen(function*() {
      const { signature, x, y, first, second } = yield* makeOwners()
      const distinctX = yield* Module.predict("x", signature)
      const sameIdDifferentOwner = new Module.Module({
        ...first,
        subModules: HashMap.map(first.subModules, (node) =>
          new Contracts.ModuleNode({ ...node, params: distinctX.params }))
      })
      const refs = Arr.make(first.params, x.params, y.params, distinctX.params)
      const before = yield* Effect.forEach(refs, (ref) =>
        Ref.get(ref))
      yield* Effect.forEach(Arr.make(second, sameIdDifferentOwner), (conflicting) =>
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
      const { signature, x, y, first, second } = yield* makeOwners()
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
      const { signature, x, y } = yield* makeOwners()
      const first = yield* Module.compose(
        new Module.ComposeOptions({
          name: "shared",
          signature,
          subModules: Record.set(Record.singleton("x", x), "y", y),
          forward: () => Effect.succeed({ answer: "unused" })
        })
      )
      const second = new Module.Module({
        ...first,
        subModules: HashMap.fromIterable(
          Arr.reverse(
            Arr.map(
              HashMap.toEntries(first.subModules),
              ([id, node]) => Tuple.make(id, new Contracts.ModuleNode({ ...node }))
            )
          )
        )
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
        Tuple.make(root.params, "root params"),
        Tuple.make(left.params, "left params"),
        Tuple.make(right.params, "right params"),
        Tuple.make(first.params, "shared params"),
        Tuple.make(x.params, "x params"),
        Tuple.make(y.params, "y params")
      )
      yield* Effect.forEach(
        expected,
        ([ref, instructions]) => Ref.set(ref, Contracts.makeDefaultModuleParams(instructions))
      )
      const saved = yield* Module.save(root)
      expect(Arr.map(saved.modules, (entry) => entry.params.instructions)).toEqual(
        Arr.make("root params", "left params", "shared params", "x params", "y params", "right params")
      )
      yield* Effect.forEach(expected, ([ref]) => Ref.set(ref, Contracts.makeDefaultModuleParams("changed")))
      yield* Module.load(root, saved)
      yield* Effect.forEach(expected, ([ref, instructions]) =>
        Effect.gen(function*() {
          expect((yield* Ref.get(ref)).instructions).toBe(instructions)
        }))
    }))

  it.effect("rejects changed metadata or demonstration contracts on deep projections of the same Ref", () =>
    Effect.gen(function*() {
      const { signature, first } = yield* makeOwners()
      const otherSignature = yield* Signature.make("Answer", { question: Schema.Number }, { answer: Schema.String })
      const left = yield* Module.compose(
        new Module.ComposeOptions({
          name: "left",
          signature,
          subModules: Record.singleton("shared", first),
          forward: () => Effect.succeed({ answer: "unused" })
        })
      )
      const sharedId = yield* Schema.decodeUnknown(Contracts.ModuleId)("shared")
      const node = yield* HashMap.get(left.subModules, sharedId)
      yield* Effect.forEach(
        Arr.make(
          Tuple.make(
            new Contracts.ModuleNode({
              ...node,
              signature: Contracts.makeModuleNodeSignature("changed description", signature.instructions)
            }),
            "inconsistent signature metadata"
          ),
          Tuple.make(
            new Contracts.ModuleNode({
              ...node,
              signature: Contracts.makeModuleNodeSignature(signature.description, "changed instructions")
            }),
            "inconsistent signature metadata"
          ),
          Tuple.make(
            new Contracts.ModuleNode({ ...node, demoContract: otherSignature.demoContract }),
            "inconsistent demonstration contract"
          )
        ),
        ([projection, message]) =>
          Effect.gen(function*() {
            const right = new Module.Module({
              name: "right",
              signature,
              params: yield* Ref.make(Contracts.makeDefaultModuleParams("right")),
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
