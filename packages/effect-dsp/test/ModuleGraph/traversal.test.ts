/**
 * Public traversal and first-preorder lineage contracts.
 */
import { describe, expect, it } from "@effect/vitest"
import * as Module from "@scenesystems/effect-dsp/Module"
import * as ModuleGraph from "@scenesystems/effect-dsp/ModuleGraph"
import { Array as Arr, Effect, Number as Num, Option, Schema, Tuple } from "effect"

const makeGraph = (children: ReadonlyArray<Schema.Array$<typeof Schema.String>["Type"]>) =>
  Effect.gen(function*() {
    const rows = yield* Effect.forEach(children, (row) =>
      Effect.forEach(row, (value) => Schema.decodeUnknown(Module.Id)(value)))
    const nodes = yield* Effect.forEach(rows, (row) =>
      Effect.gen(function*() {
        const moduleId = yield* Arr.head(row)
        return new ModuleGraph.Node({
          moduleId,
          signature: new Module.NodeSignature({ description: "graph", instructions: "graph" }),
          subModuleIds: Arr.drop(row, 1)
        })
      }))
    const root = yield* Arr.head(nodes)
    return new ModuleGraph.ModuleGraph({ rootId: root.moduleId, nodes, edges: Arr.empty() })
  })

describe("ModuleGraph", () => {
  it.effect("walks a deep wire graph without recursive stack growth", () =>
    Effect.gen(function*() {
      const ids = yield* Effect.forEach(Arr.range(0, 3999), (index) =>
        Schema.encode(Schema.NumberFromString)(index).pipe(
          Effect.flatMap((value) => Schema.decodeUnknown(Module.Id)(Arr.join(Arr.make("node-", value), "")))
        ))
      const rootId = yield* Arr.head(ids)
      const nodes = Arr.map(ids, (moduleId, index) =>
        new ModuleGraph.Node({
          moduleId,
          signature: new Module.NodeSignature({ description: "chain", instructions: "chain" }),
          subModuleIds: Option.match(Arr.get(ids, Num.increment(index)), {
            onNone: () => Arr.empty<Module.Id>(),
            onSome: (child) => Arr.make(child)
          })
        }))
      const graph = new ModuleGraph.ModuleGraph({ rootId, nodes, edges: Arr.empty() })
      expect(ModuleGraph.traversal(graph)).toEqual(ids)
    }))

  it.effect("selects the first longer path rather than a later shortest path in stored order", () =>
    Effect.gen(function*() {
      const graph = yield* makeGraph(Arr.make(
        Arr.make("root", "z-first", "target", "a-last"),
        Arr.make("z-first", "deep", "sibling"),
        Arr.make("deep", "target"),
        Arr.make("target", "deep"),
        Arr.make("sibling", "target"),
        Arr.make("a-last", "target"),
        Arr.make("unreachable")
      ))
      const target = yield* Schema.decodeUnknown(Module.Id)("target")
      const missing = yield* Schema.decodeUnknown(Module.Id)("unreachable")
      const projection = ModuleGraph.project(graph)
      expect(projection.traversal).toEqual(Arr.make("root", "z-first", "deep", "target", "sibling", "a-last"))
      expect((yield* ModuleGraph.lineage(graph, target)).path).toEqual(
        Arr.make("root", "z-first", "deep", "target")
      )
      expect(Option.isNone(ModuleGraph.lineage(graph, missing))).toBe(true)
      expect(Arr.map(projection.lineages, (lineage) => Tuple.make(lineage.targetId, lineage.path))).toEqual(Arr.make(
        Tuple.make("root", Arr.make("root")),
        Tuple.make("z-first", Arr.make("root", "z-first")),
        Tuple.make("deep", Arr.make("root", "z-first", "deep")),
        Tuple.make("target", Arr.make("root", "z-first", "deep", "target")),
        Tuple.make("sibling", Arr.make("root", "z-first", "sibling")),
        Tuple.make("a-last", Arr.make("root", "a-last"))
      ))
    }))

  it.effect("includes missing endpoints and uses the last duplicate node record", () =>
    Effect.gen(function*() {
      const graph = yield* makeGraph(Arr.make(
        Arr.make("root", "stale"),
        Arr.make("root", "missing")
      ))
      const target = yield* Schema.decodeUnknown(Module.Id)("missing")
      expect(ModuleGraph.traversal(graph)).toEqual(Arr.make("root", "missing"))
      expect((yield* ModuleGraph.lineage(graph, target)).path).toEqual(Arr.make("root", "missing"))
    }))
})
