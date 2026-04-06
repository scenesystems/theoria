/**
 * Optimization surface contracts for effect-search objective/dimension seams.
 */
import { describe, expect, it } from "@effect/vitest"
import { Effect, Option, Schema } from "effect"
import * as Contracts from "effect-dsp/contracts"
import { Demo } from "effect-dsp/Example"
import * as Trace from "effect-dsp/Trace"

const decodeModuleId = (moduleName: string) =>
  Schema.decodeUnknown(Contracts.ModuleId)(moduleName).pipe(
    Effect.orDie
  )

describe("contracts/OptimizationSurface", () => {
  it("pins ownership of generic search primitives to effect-search", () => {
    expect(Contracts.searchPrimitiveOwnership.traversal).toBe("effect-search")
    expect(Contracts.searchPrimitiveOwnership.sampler).toBe("effect-search")
    expect(Contracts.searchPrimitiveOwnership.pareto).toBe("effect-search")
  })

  it.effect("projects module params into deterministic parameter and dimension surfaces", () =>
    Effect.gen(function*() {
      const params = new Contracts.ModuleParams({
        instructions: "Answer with one token.",
        demos: [
          new Demo({
            input: { question: "What is the capital of France?" },
            output: { answer: "Paris" }
          })
        ],
        outputStrategy: "structured",
        temperature: 0.25,
        maxTokens: 32
      })

      const projectionA = Contracts.projectOptimizationParameters(params)
      const projectionB = Contracts.projectOptimizationParameters(params)
      const dimensions = Contracts.projectOptimizationDimensions(params)

      expect(projectionA).toEqual(projectionB)
      expect(dimensions.map((dimension) => dimension.name)).toEqual([
        "instructions",
        "demoCount",
        "outputStrategy",
        "temperature",
        "maxTokens"
      ])
    }))

  it.effect("projects trace entries into stable objective payload contracts", () =>
    Effect.gen(function*() {
      const traceEntry = new Trace.Entry({
        moduleName: "qa",
        signatureDescription: "Answer questions with concise factual answers",
        input: { question: "What is the capital of France?" },
        output: { answer: "Paris" },
        prompt: "Question: What is the capital of France?",
        rawResponse: "Paris",
        inputTokens: Option.some(18),
        outputTokens: Option.some(2),
        durationMs: 12,
        score: Trace.noScore,
        timestamp: 1_700_000_000_000
      })

      const projected = yield* Contracts.projectOptimizationObjective(traceEntry)
      const encoded = yield* Schema.encode(Contracts.OptimizationObjectiveSurface)(projected)
      const roundTrip = yield* Schema.decode(Contracts.OptimizationObjectiveSurface)(encoded)
      const reEncoded = yield* Schema.encode(Contracts.OptimizationObjectiveSurface)(roundTrip)

      expect(projected.signatureDescription).toBe(traceEntry.signatureDescription)
      expect(projected.input).toEqual(traceEntry.input)
      expect(projected.prompt).toBe(traceEntry.prompt)
      expect(projected.score).toEqual(traceEntry.score)
      expect(projected.durationMs).toBe(traceEntry.durationMs)
      expect(projected.usage.inputTokens).toEqual(traceEntry.inputTokens)
      expect(projected.usage.outputTokens).toEqual(traceEntry.outputTokens)
      expect(projected.totalTokens).toBe(20)
      expect(projected.usage.cached).toBe(false)
      expect(reEncoded).toEqual(encoded)
    }))

  it.effect("projects module graphs into deterministic optimization traversal surfaces", () =>
    Effect.gen(function*() {
      const rootId = yield* decodeModuleId("a-root")
      const pipelineId = yield* decodeModuleId("b-pipeline")
      const qaId = yield* decodeModuleId("c-qa")
      const graph = Contracts.makeModuleGraph({
        rootId,
        nodes: [
          new Contracts.ModuleGraphNode({
            moduleId: rootId,
            signature: Contracts.makeModuleNodeSignature("Root", "Root instructions"),
            subModuleIds: [pipelineId]
          }),
          new Contracts.ModuleGraphNode({
            moduleId: pipelineId,
            signature: Contracts.makeModuleNodeSignature("Pipeline", "Pipeline instructions"),
            subModuleIds: [qaId]
          }),
          new Contracts.ModuleGraphNode({
            moduleId: qaId,
            signature: Contracts.makeModuleNodeSignature("QA", "QA instructions"),
            subModuleIds: []
          })
        ],
        edges: [
          new Contracts.ModuleGraphEdge({ parentId: rootId, childId: pipelineId }),
          new Contracts.ModuleGraphEdge({ parentId: pipelineId, childId: qaId })
        ]
      })

      const projectionA = Contracts.projectOptimizationModuleGraph(graph)
      const projectionB = Contracts.projectOptimizationModuleGraph(graph)
      const encoded = yield* Schema.encode(Contracts.OptimizationModuleGraphSurface)(projectionA)
      const roundTrip = yield* Schema.decode(Contracts.OptimizationModuleGraphSurface)(encoded)

      expect(projectionA).toEqual(projectionB)
      expect(projectionA.traversal).toEqual([rootId, pipelineId, qaId])
      expect(projectionA.lineages).toHaveLength(3)
      expect(roundTrip).toEqual(projectionA)
    }))
})
