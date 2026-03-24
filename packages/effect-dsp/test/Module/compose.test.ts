/**
 * Module composition graph contracts.
 */
import * as LanguageModel from "@effect/ai/LanguageModel"
import { describe, expect, it } from "@effect/vitest"
import { Effect, HashMap, Layer, Option, Ref, Schema } from "effect"
import * as Contracts from "effect-dsp/contracts"
import * as Module from "effect-dsp/Module"
import * as Signature from "effect-dsp/Signature"
import { MockLanguageModel } from "effect-dsp/test"
import * as Trace from "effect-dsp/Trace"

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

const decodeModuleId = (moduleName: string) =>
  Schema.decodeUnknown(Contracts.ModuleId)(moduleName).pipe(
    Effect.orDie
  )

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
      const lineage = Contracts.moduleGraphLineage(rootGraph, qaId)

      expect(traversal).toEqual([
        rootId,
        pipelineId,
        qaId
      ])
      expect(Option.isSome(lineage)).toBe(true)

      if (Option.isSome(lineage)) {
        expect(lineage.value.path).toEqual([
          rootId,
          pipelineId,
          qaId
        ])
      }
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
      const graph = traced[0]
      const entries = traced[1]
      const qaLineage = Contracts.moduleGraphLineage(graph, qaId)
      const secondaryLineage = Contracts.moduleGraphLineage(graph, secondaryId)

      expect(entries.map((entry) => entry.moduleName)).toEqual([
        "qa",
        "secondary"
      ])
      expect(Contracts.stableModuleGraphTraversal(graph)).toEqual([
        rootId,
        pipelineId,
        qaId,
        secondaryId
      ])
      expect(Option.isSome(qaLineage)).toBe(true)
      expect(Option.isSome(secondaryLineage)).toBe(true)

      if (Option.isSome(qaLineage)) {
        expect(qaLineage.value.path).toEqual([
          rootId,
          pipelineId,
          qaId
        ])
      }

      if (Option.isSome(secondaryLineage)) {
        expect(secondaryLineage.value.path).toEqual([
          rootId,
          secondaryId
        ])
      }
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
      const innerUsage = nested[0][1]
      const outerUsage = nested[1]

      expect(innerUsage.callCount).toBe(2)
      expect(outerUsage.callCount).toBe(2)
      expect(innerUsage.cachedCount).toBe(0)
      expect(outerUsage.cachedCount).toBe(0)
      expect(innerUsage.inputTokens).toBe(0)
      expect(outerUsage.inputTokens).toBe(0)
      expect(innerUsage.outputTokens).toBe(0)
      expect(outerUsage.outputTokens).toBe(0)
    }))
})
