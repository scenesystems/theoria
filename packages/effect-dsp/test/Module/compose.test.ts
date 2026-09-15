/**
 * Module composition graph contracts.
 */
import * as LanguageModel from "@effect/ai/LanguageModel"
import { describe, expect, it } from "@effect/vitest"
import * as Contracts from "@scenesystems/effect-dsp/contracts"
import * as Module from "@scenesystems/effect-dsp/Module"
import * as Signature from "@scenesystems/effect-dsp/Signature"
import { MockLanguageModel } from "@scenesystems/effect-dsp/test"
import * as Trace from "@scenesystems/effect-dsp/Trace"
import { Array as Arr, Effect, HashMap, Layer, Option, Record, Ref, Schema, Tuple } from "effect"

const makeQaSignature = () =>
  Signature.make(
    "Answer questions with concise facts",
    {
      question: Signature.describe(Schema.String, "The question to answer")
    },
    {
      answer: Signature.describe(Schema.String, "A concise factual answer")
    }
  )

const decodeModuleId = Schema.decodeUnknown(Contracts.ModuleId)

describe("Module.compose", () => {
  it.effect("retains the destination demonstration contract on projected children", () =>
    Effect.gen(function*() {
      const signature = yield* makeQaSignature()
      const qa = yield* Module.predict("qa", signature)
      const root = yield* Module.compose(
        new Module.ComposeOptions({
          name: "root",
          signature,
          subModules: Record.singleton("qa", qa),
          forward: ({ input }) => qa.forward(input)
        })
      )
      const qaId = yield* decodeModuleId("qa")
      const node = yield* HashMap.get(root.subModules, qaId)
      const demo = yield* node.demoContract.decode({ input: { question: "Where?" }, output: { answer: "Here" } })
      const invalid = yield* Effect.flip(
        node.demoContract.decode({ input: { question: 42 }, output: { answer: "Here" } })
      )
      expect(demo.input).toEqual({ question: "Where?" })
      expect(invalid._tag).toBe("ParseError")
    }))

  it.effect("builds explicit graph contracts with stable traversal and lineage", () =>
    Effect.gen(function*() {
      const signature = yield* makeQaSignature()
      const qa = yield* Module.predict("qa", signature)
      const pipeline = yield* Module.compose(
        new Module.ComposeOptions({
          name: "qa-pipeline",
          signature,
          subModules: Record.singleton("qa", qa),
          forward: ({ input }) => qa.forward(input)
        })
      )
      const rootGraph = yield* Module.composeGraph(
        new Module.ComposeGraphOptions({
          name: "qa-root",
          signature,
          subModules: Record.singleton("pipeline", pipeline)
        })
      )
      const rootId = yield* decodeModuleId("qa-root")
      const pipelineId = yield* decodeModuleId(pipeline.name)
      const qaId = yield* decodeModuleId(qa.name)
      const traversal = Contracts.stableModuleGraphTraversal(rootGraph)
      const lineage = yield* Contracts.moduleGraphLineage(rootGraph, qaId)

      expect(traversal).toEqual(Arr.make(
        rootId,
        pipelineId,
        qaId
      ))

      expect(lineage.path).toEqual(Arr.make(rootId, pipelineId, qaId))
    }))

  it.effect("rejects graph declarations with duplicate ids mapped to different module values", () =>
    Effect.gen(function*() {
      const signature = yield* makeQaSignature()
      const left = yield* Module.predict("qa", signature)
      const right = yield* Module.predict("qa", signature)
      const error = yield* Effect.flip(Module.composeGraph(
        new Module.ComposeGraphOptions({
          name: "qa-root",
          signature,
          subModules: Record.set(Record.singleton("left", left), "right", right)
        })
      ))

      expect(error._tag).toBe("CompositionError")
      expect(error.message).toContain("share id 'qa'")
    }))

  it.effect("rejects composition graphs with explicit cycle declarations", () =>
    Effect.gen(function*() {
      const signature = yield* makeQaSignature()
      const loopId = yield* decodeModuleId("loop")
      const paramsRef = yield* Ref.make(Contracts.makeDefaultModuleParams(signature.instructions))
      const loopSignature = Contracts.makeModuleNodeSignature(
        signature.description,
        signature.instructions
      )
      const loopNode: Contracts.ModuleNode = {
        moduleId: loopId,
        name: "loop",
        signature: loopSignature,
        demoContract: signature.demoContract,
        params: paramsRef,
        get subModules() {
          return HashMap.make(Tuple.make(loopId, loopNode))
        }
      }
      const loopModule = new Module.Module({
        name: "loop",
        signature,
        params: paramsRef,
        subModules: HashMap.set(HashMap.empty(), loopId, loopNode),
        forward: () => Effect.succeed({ answer: "unreachable" })
      })
      const error = yield* Effect.flip(Module.composeGraph(
        new Module.ComposeGraphOptions({
          name: "qa-root",
          signature,
          subModules: Record.singleton("loop", loopModule)
        })
      ))

      expect(error._tag).toBe("CompositionError")
      expect(error.message).toContain("cycle detected")
    }))

  it.effect("rejects direct and nested children that collide with the root before touching params", () =>
    Effect.gen(function*() {
      const signature = yield* makeQaSignature()
      const child = yield* Module.predict("root", signature)
      const branch = yield* Module.compose(
        new Module.ComposeOptions({
          name: "branch",
          signature,
          subModules: Record.singleton("child", child),
          forward: ({ input }) => child.forward(input)
        })
      )
      const before = yield* Ref.get(child.params)
      yield* Effect.forEach(Arr.make(child, branch), (owned) =>
        Effect.gen(function*() {
          const error = yield* Effect.flip(Module.compose(
            new Module.ComposeOptions({
              name: "root",
              signature,
              subModules: Record.singleton("child", owned),
              forward: ({ input }) => child.forward(input)
            })
          ))
          expect(error.message).toContain("collides with composed module id")
          expect(yield* Ref.get(child.params)).toEqual(before)
        }))
    }))

  it.effect("rejects conflicting identities attached to the same live owner", () =>
    Effect.gen(function*() {
      const signature = yield* makeQaSignature()
      const child = yield* Module.predict("child", signature)
      const renamed = new Module.Module({ ...child, name: "renamed" })
      const error = yield* Effect.flip(Module.composeGraph(
        new Module.ComposeGraphOptions({
          name: "root",
          signature,
          subModules: Record.set(Record.singleton("child", child), "renamed", renamed)
        })
      ))
      expect(error.message).toContain("child id 'renamed'")
    }))

  it.effect("rejects distinct deep owners and direct-versus-deep owners with the same id", () =>
    Effect.gen(function*() {
      const signature = yield* makeQaSignature()
      const leftLeaf = yield* Module.predict("leaf", signature)
      const rightLeaf = yield* Module.predict("leaf", signature)
      const left = yield* Module.compose(
        new Module.ComposeOptions({
          name: "left",
          signature,
          subModules: Record.singleton("leaf", leftLeaf),
          forward: ({ input }) => leftLeaf.forward(input)
        })
      )
      const right = yield* Module.compose(
        new Module.ComposeOptions({
          name: "right",
          signature,
          subModules: Record.singleton("leaf", rightLeaf),
          forward: ({ input }) => rightLeaf.forward(input)
        })
      )
      yield* Effect.forEach(Arr.make(right, rightLeaf), (other) =>
        Effect.gen(function*() {
          const error = yield* Effect.flip(Module.compose(
            new Module.ComposeOptions({
              name: "root",
              signature,
              subModules: Record.set(Record.singleton("left", left), "other", other),
              forward: ({ input }) => left.forward(input)
            })
          ))
          expect(error.message).toContain("share id 'leaf'")
        }))
    }))

  it.effect("validates every deep declared key, moduleId, and name", () =>
    Effect.gen(function*() {
      const signature = yield* makeQaSignature()
      const leaf = yield* Module.predict("leaf", signature)
      const leafId = yield* decodeModuleId("leaf")
      const wrongId = yield* decodeModuleId("wrong")
      const branchId = yield* decodeModuleId("branch")
      const metadata = Contracts.makeModuleNodeSignature(signature.description, signature.instructions)
      yield* Effect.forEach(
        Arr.make(
          Tuple.make(wrongId, leafId, "leaf"),
          Tuple.make(leafId, wrongId, "leaf"),
          Tuple.make(leafId, leafId, "wrong")
        ),
        ([declaredId, moduleId, name]) =>
          Effect.gen(function*() {
            const badNode = new Contracts.ModuleNode({
              moduleId,
              name,
              signature: metadata,
              demoContract: signature.demoContract,
              params: leaf.params,
              subModules: HashMap.empty()
            })
            const branch = new Contracts.ModuleNode({
              moduleId: branchId,
              name: "branch",
              signature: metadata,
              demoContract: signature.demoContract,
              params: yield* Ref.make(Contracts.makeDefaultModuleParams(signature.instructions)),
              subModules: HashMap.make(Tuple.make(declaredId, badNode))
            })
            const parent = new Module.Module({
              name: "parent",
              signature,
              params: yield* Ref.make(Contracts.makeDefaultModuleParams(signature.instructions)),
              subModules: HashMap.make(Tuple.make(branchId, branch)),
              forward: () => Effect.succeed({ answer: "unused" })
            })
            const error = yield* Effect.flip(Module.compose(
              new Module.ComposeOptions({
                name: "root",
                signature,
                subModules: Record.singleton("parent", parent),
                forward: ({ input }) => parent.forward(input)
              })
            ))
            expect(error.message).toContain("child id")
          })
      )
    }))

  it.effect("preserves deterministic trace order with graph lineage through composed runtime", () =>
    Effect.gen(function*() {
      const signature = yield* makeQaSignature()
      const qa = yield* Module.predict("qa", signature)
      const secondary = yield* Module.predict("secondary", signature)
      const pipeline = yield* Module.compose(
        new Module.ComposeOptions({
          name: "qa-pipeline",
          signature,
          subModules: Record.singleton("qa", qa),
          forward: ({ input }) => qa.forward(input)
        })
      )
      const root = yield* Module.compose(
        new Module.ComposeOptions({
          name: "qa-root",
          signature,
          subModules: Record.set(Record.singleton("pipeline", pipeline), "secondary", secondary),
          forward: ({ input }) =>
            Effect.gen(function*() {
              yield* pipeline.forward(input)

              return yield* secondary.forward(input)
            })
        })
      )
      const rootId = yield* decodeModuleId(root.name)
      const pipelineId = yield* decodeModuleId(pipeline.name)
      const qaId = yield* decodeModuleId(qa.name)
      const secondaryId = yield* decodeModuleId(secondary.name)
      const mock = yield* MockLanguageModel.make(
        MockLanguageModel.fixed({ answer: "Paris" })
      )
      const lmLayer = Layer.succeed(LanguageModel.LanguageModel, mock.service)
      const program = Module.discoverModuleGraph(
        rootId,
        root.forward({ question: "What is the capital of France?" }).pipe(
          Effect.provide(lmLayer)
        )
      )
      const traced = yield* Trace.withTracing(program)
      const graph = Tuple.getFirst(traced)
      const entries = Tuple.getSecond(traced)
      const qaLineage = yield* Contracts.moduleGraphLineage(graph, qaId)
      const secondaryLineage = yield* Contracts.moduleGraphLineage(graph, secondaryId)

      expect(Arr.map(entries, (entry) => entry.moduleName)).toEqual(Arr.make(
        "qa",
        "secondary"
      ))
      expect(Contracts.stableModuleGraphTraversal(graph)).toEqual(Arr.make(
        rootId,
        pipelineId,
        qaId,
        secondaryId
      ))

      expect(qaLineage.path).toEqual(Arr.make(rootId, pipelineId, qaId))
      expect(secondaryLineage.path).toEqual(Arr.make(rootId, secondaryId))
    }))

  it.effect("avoids usage double counting for composed execution under nested tracking", () =>
    Effect.gen(function*() {
      const signature = yield* makeQaSignature()
      const qa = yield* Module.predict("qa", signature)
      const secondary = yield* Module.predict("secondary", signature)
      const pipeline = yield* Module.compose(
        new Module.ComposeOptions({
          name: "qa-pipeline",
          signature,
          subModules: Record.singleton("qa", qa),
          forward: ({ input }) => qa.forward(input)
        })
      )
      const root = yield* Module.compose(
        new Module.ComposeOptions({
          name: "qa-root",
          signature,
          subModules: Record.set(Record.singleton("pipeline", pipeline), "secondary", secondary),
          forward: ({ input }) =>
            Effect.gen(function*() {
              yield* pipeline.forward(input)

              return yield* secondary.forward(input)
            })
        })
      )
      const mock = yield* MockLanguageModel.make(
        MockLanguageModel.fixed({ answer: "Paris" })
      )
      const lmLayer = Layer.succeed(LanguageModel.LanguageModel, mock.service)
      const nested = yield* Trace.withUsageTracking(
        Trace.withUsageTracking(
          root.forward({ question: "What is the capital of France?" }).pipe(
            Effect.provide(lmLayer)
          )
        )
      )
      const innerUsage = Tuple.getSecond(Tuple.getFirst(nested))
      const outerUsage = Tuple.getSecond(nested)

      expect(innerUsage.callCount).toBe(2)
      expect(outerUsage.callCount).toBe(2)
      expect(Option.isNone(Option.fromNullable(innerUsage.tokens.inputTokens))).toBe(true)
      expect(Option.isNone(Option.fromNullable(outerUsage.tokens.inputTokens))).toBe(true)
      expect(Option.isNone(Option.fromNullable(innerUsage.tokens.outputTokens))).toBe(true)
      expect(Option.isNone(Option.fromNullable(outerUsage.tokens.outputTokens))).toBe(true)
      expect(Option.isNone(Option.fromNullable(innerUsage.tokens.totalTokens))).toBe(true)
      expect(Option.isNone(Option.fromNullable(outerUsage.tokens.totalTokens))).toBe(true)
    }))
})
