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
import { Array as Arr, Effect, HashMap, Layer, Option, Ref, Schema, Tuple } from "effect"

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
  it.effect("builds explicit graph contracts with stable traversal and lineage", () =>
    Effect.gen(function*() {
      const signature = yield* makeQaSignature()
      const qa = yield* Module.predict("qa", signature)
      const pipeline = yield* Module.compose({
        name: "qa-pipeline",
        signature,
        subModules: { qa },
        forward: ({ input }) => qa.forward(input)
      })
      const rootGraph = yield* Module.composeGraph({
        name: "qa-root",
        signature,
        subModules: { pipeline }
      })
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
      const error = yield* Effect.flip(Module.composeGraph({
        name: "qa-root",
        signature,
        subModules: {
          left,
          right
        }
      }))

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
      const loopNode = Contracts.makeModuleNode({
        moduleId: loopId,
        name: "loop",
        signature: loopSignature,
        params: paramsRef,
        subModules: HashMap.empty()
      })
      const loopModule = {
        name: "loop",
        signature: {
          description: signature.description,
          instructions: signature.instructions
        },
        params: paramsRef,
        subModules: HashMap.set(HashMap.empty(), loopId, loopNode)
      }
      const error = yield* Effect.flip(Module.composeGraph({
        name: "qa-root",
        signature,
        subModules: { loop: loopModule }
      }))

      expect(error._tag).toBe("CompositionError")
      expect(error.message).toContain("cycle detected")
    }))

  it.effect("preserves deterministic trace order with graph lineage through composed runtime", () =>
    Effect.gen(function*() {
      const signature = yield* makeQaSignature()
      const qa = yield* Module.predict("qa", signature)
      const secondary = yield* Module.predict("secondary", signature)
      const pipeline = yield* Module.compose({
        name: "qa-pipeline",
        signature,
        subModules: { qa },
        forward: ({ input }) => qa.forward(input)
      })
      const root = yield* Module.compose({
        name: "qa-root",
        signature,
        subModules: {
          pipeline,
          secondary
        },
        forward: ({ input }) =>
          Effect.gen(function*() {
            yield* pipeline.forward(input)

            return yield* secondary.forward(input)
          })
      })
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
      const pipeline = yield* Module.compose({
        name: "qa-pipeline",
        signature,
        subModules: { qa },
        forward: ({ input }) => qa.forward(input)
      })
      const root = yield* Module.compose({
        name: "qa-root",
        signature,
        subModules: {
          pipeline,
          secondary
        },
        forward: ({ input }) =>
          Effect.gen(function*() {
            yield* pipeline.forward(input)

            return yield* secondary.forward(input)
          })
      })
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
