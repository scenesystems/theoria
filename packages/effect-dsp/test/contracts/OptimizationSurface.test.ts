/**
 * Optimization surface contracts for effect-search objective/dimension seams.
 */
import * as Response from "@effect/ai/Response"
import { describe, expect, it } from "@effect/vitest"
import * as Contracts from "@scenesystems/effect-dsp/contracts"
import { Demo } from "@scenesystems/effect-dsp/Example"
import * as Trace from "@scenesystems/effect-dsp/Trace"
import { Array as Arr, Effect, Equal, Option, Schema, Tuple } from "effect"

const decodeModuleId = Schema.decodeUnknown(Contracts.ModuleId)

describe("contracts/OptimizationSurface", () => {
  it.effect("projects module params into deterministic parameter and dimension surfaces", () =>
    Effect.gen(function*() {
      const params = new Contracts.ModuleParams({
        instructions: "Answer with one token.",
        demos: Arr.make(
          new Demo({
            input: { question: "What is the capital of France?" },
            output: { answer: "Paris" }
          })
        ),
        outputStrategy: "structured",
        temperature: 0.25,
        maxTokens: 32
      })

      const projection = Contracts.projectOptimizationParameters(params)
      const dimensions = Contracts.projectOptimizationDimensions(params)

      expect(projection.instructions).toBe("Answer with one token.")
      expect(projection.demoCount).toBe(1)
      expect(projection.outputStrategy).toBe("structured")
      expect(projection.temperature).toEqual(Option.some(0.25))
      expect(projection.maxTokens).toEqual(Option.some(32))
      expect(Arr.map(dimensions, (dimension) => Tuple.make(dimension.name, dimension.value))).toEqual(Arr.make(
        Tuple.make("instructions", "Answer with one token."),
        Tuple.make("demoCount", 1),
        Tuple.make("outputStrategy", "structured"),
        Tuple.make("temperature", 0.25),
        Tuple.make("maxTokens", 32)
      ))
    }))

  it.effect("projects trace entries into stable objective payload contracts", () =>
    Effect.gen(function*() {
      const usage = new Response.Usage({
        inputTokens: 18,
        outputTokens: 2,
        totalTokens: 23,
        reasoningTokens: 3,
        cachedInputTokens: 4
      })
      const traceEntry = new Trace.Entry({
        moduleName: "qa",
        signatureDescription: "Answer questions with concise factual answers",
        input: { question: "What is the capital of France?" },
        output: { answer: "Paris" },
        prompt: "Question: What is the capital of France?",
        rawResponse: "Paris",
        usage,
        durationMs: 12,
        score: Trace.noScore,
        timestamp: 1_700_000_000_000
      })

      const projected = yield* Contracts.projectOptimizationObjective(traceEntry)

      expect(projected.signatureDescription).toBe(traceEntry.signatureDescription)
      expect(projected.input).toEqual(traceEntry.input)
      expect(projected.prompt).toBe(traceEntry.prompt)
      expect(projected.score).toEqual(traceEntry.score)
      expect(projected.durationMs).toBe(traceEntry.durationMs)
      expect(projected.rawResponse).toBe("Paris")
      expect(projected.output).toEqual({ answer: "Paris" })
      expect(Equal.equals(projected.usage, usage)).toBe(true)
      expect(projected.usage.reasoningTokens).toBe(3)
      expect(projected.usage.cachedInputTokens).toBe(4)
    }))

  it.effect("projects module graphs into deterministic optimization traversal surfaces", () =>
    Effect.gen(function*() {
      const rootId = yield* decodeModuleId("a-root")
      const pipelineId = yield* decodeModuleId("b-pipeline")
      const qaId = yield* decodeModuleId("c-qa")
      const graph = Contracts.makeModuleGraph({
        rootId,
        nodes: Arr.make(
          new Contracts.ModuleGraphNode({
            moduleId: rootId,
            signature: Contracts.makeModuleNodeSignature("Root", "Root instructions"),
            subModuleIds: Arr.make(pipelineId)
          }),
          new Contracts.ModuleGraphNode({
            moduleId: pipelineId,
            signature: Contracts.makeModuleNodeSignature("Pipeline", "Pipeline instructions"),
            subModuleIds: Arr.make(qaId)
          }),
          new Contracts.ModuleGraphNode({
            moduleId: qaId,
            signature: Contracts.makeModuleNodeSignature("QA", "QA instructions"),
            subModuleIds: Arr.empty()
          })
        ),
        edges: Arr.make(
          new Contracts.ModuleGraphEdge({ parentId: rootId, childId: pipelineId }),
          new Contracts.ModuleGraphEdge({ parentId: pipelineId, childId: qaId })
        )
      })

      const projection = Contracts.projectOptimizationModuleGraph(graph)

      expect(projection.traversal).toEqual(Arr.make(rootId, pipelineId, qaId))
      expect(Arr.map(projection.lineages, (lineage) => lineage.path)).toEqual(Arr.make(
        Arr.make(rootId),
        Arr.make(rootId, pipelineId),
        Arr.make(rootId, pipelineId, qaId)
      ))
    }))
})
