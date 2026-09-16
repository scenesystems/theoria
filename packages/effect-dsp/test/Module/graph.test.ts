/**
 * Public graph traversal and first-preorder lineage contracts.
 */
import { describe, expect, it } from "@effect/vitest"
import * as Contracts from "@scenesystems/effect-dsp/contracts"
import { Array as Arr, Effect, Number as Num, Option, Schema, Tuple } from "effect"

const makeGraph = (children: Iterable<Schema.Array$<typeof Schema.String>["Type"]>) =>
  Effect.gen(function*() {
    const rows = yield* Effect.forEach(children, (row) =>
      Effect.forEach(row, (value) => Schema.decodeUnknown(Contracts.ModuleId)(value)))
    const nodes = yield* Effect.forEach(rows, (row) =>
      Effect.gen(function*() {
        const moduleId = yield* Arr.head(row)
        return new Contracts.ModuleGraphNode({
          moduleId,
          signature: Contracts.makeModuleNodeSignature("graph", "graph"),
          subModuleIds: Arr.drop(row, 1)
        })
      }))
    const root = yield* Arr.head(nodes)
    return new Contracts.ModuleGraph({ rootId: root.moduleId, nodes, edges: Arr.empty() })
  })

describe("ModuleGraph", () => {
  it.effect("walks a deep wire graph without recursive stack growth", () =>
    Effect.gen(function*() {
      const ids = yield* Effect.forEach(Arr.range(0, 3999), (index) =>
        Schema.encode(Schema.NumberFromString)(index).pipe(
          Effect.flatMap((value) => Schema.decodeUnknown(Contracts.ModuleId)(Arr.join(Arr.make("node-", value), "")))
        ))
      const rootId = yield* Arr.head(ids)
      const nodes = Arr.map(ids, (moduleId, index) =>
        new Contracts.ModuleGraphNode({
          moduleId,
          signature: Contracts.makeModuleNodeSignature("chain", "chain"),
          subModuleIds: Option.match(Arr.get(ids, Num.increment(index)), {
            onNone: () => Arr.empty<Contracts.ModuleId>(),
            onSome: (child) => Arr.make(child)
          })
        }))
      const graph = new Contracts.ModuleGraph({ rootId, nodes, edges: Arr.empty() })
      expect(Contracts.stableModuleGraphTraversal(graph)).toEqual(ids)
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
      const target = yield* Schema.decodeUnknown(Contracts.ModuleId)("target")
      const missing = yield* Schema.decodeUnknown(Contracts.ModuleId)("unreachable")
      const projection = Contracts.projectModuleGraph(graph)
      expect(projection.traversal).toEqual(Arr.make("root", "z-first", "deep", "target", "sibling", "a-last"))
      expect((yield* Contracts.moduleGraphLineage(graph, target)).path).toEqual(
        Arr.make("root", "z-first", "deep", "target")
      )
      expect(Option.isNone(Contracts.moduleGraphLineage(graph, missing))).toBe(true)
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
      const target = yield* Schema.decodeUnknown(Contracts.ModuleId)("missing")
      expect(Contracts.stableModuleGraphTraversal(graph)).toEqual(Arr.make("root", "missing"))
      expect((yield* Contracts.moduleGraphLineage(graph, target)).path).toEqual(Arr.make("root", "missing"))
    }))
})
