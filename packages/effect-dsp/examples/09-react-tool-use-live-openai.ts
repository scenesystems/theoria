/**
 * Runs a live ReAct research assistant that can chain a knowledge lookup and a
 * calculation, records the resulting trace, and evaluates exact-match answers.
 *
 * Required env:
 *   OPENAI_API_KEY=... (or ANTHROPIC_API_KEY, OPENROUTER_API_KEY)
 *
 * Run: bun run examples/09-react-tool-use-live-openai.ts
 */
import * as Tool from "@effect/ai/Tool"
import type * as Toolkit from "@effect/ai/Toolkit"
import { BunRuntime } from "@effect/platform-bun"
import { Evaluate, Example, Metric, Module, Signature, Trace } from "@scenesystems/effect-dsp"
import { Array as Arr, Effect, Schema } from "effect"
import { withLiveLanguageModel } from "./shared/live-provider-runtime.js"

// Tools

const KnowledgeBase = Tool.make("KnowledgeBase", {
  description: "Look up a factual data point. Returns a concise string with the requested information.",
  parameters: {
    query: Schema.String
  },
  success: Schema.String
})

const Calculator = Tool.make("Calculator", {
  description: "Evaluate an arithmetic expression (e.g. '42 * 3') and return the numeric result as a string",
  parameters: {
    expression: Schema.String
  },
  success: Schema.String
})

const KNOWLEDGE: ReadonlyArray<{ readonly match: string; readonly answer: string }> = [
  { match: "population of france", answer: "68 million" },
  { match: "population of germany", answer: "84 million" },
  { match: "capital of japan", answer: "Tokyo" },
  { match: "speed of light", answer: "299792458 meters per second" },
  { match: "boiling point of water", answer: "100 degrees Celsius at sea level" },
  { match: "earth radius", answer: "6371 km" },
  { match: "moon distance", answer: "384400 km" },
  { match: "pi value", answer: "3.14159265358979" }
]

const lookupKnowledge = (query: string): string => {
  const lowerQuery = query.toLowerCase()
  const entry = Arr.findFirst(KNOWLEDGE, (k) => lowerQuery.includes(k.match))

  return entry._tag === "Some"
    ? entry.value.answer
    : `No data found for: ${query}`
}

const evaluateExpression = (expr: string): string => {
  const cleaned = expr.replaceAll(",", "").trim()

  const addMatch = /^(\d+(?:\.\d+)?)\s*\+\s*(\d+(?:\.\d+)?)$/.exec(cleaned)
  if (addMatch) return String(Number(addMatch[1]) + Number(addMatch[2]))

  const subMatch = /^(\d+(?:\.\d+)?)\s*-\s*(\d+(?:\.\d+)?)$/.exec(cleaned)
  if (subMatch) return String(Number(subMatch[1]) - Number(subMatch[2]))

  const mulMatch = /^(\d+(?:\.\d+)?)\s*\*\s*(\d+(?:\.\d+)?)$/.exec(cleaned)
  if (mulMatch) return String(Number(mulMatch[1]) * Number(mulMatch[2]))

  const divMatch = /^(\d+(?:\.\d+)?)\s*\/\s*(\d+(?:\.\d+)?)$/.exec(cleaned)
  if (divMatch) return String(Number(divMatch[1]) / Number(divMatch[2]))

  return "0"
}

const toolkit: Toolkit.WithHandler<{
  readonly KnowledgeBase: typeof KnowledgeBase
  readonly Calculator: typeof Calculator
}> = {
  tools: { KnowledgeBase, Calculator },
  handle: (name, params) => {
    if (name === "KnowledgeBase" && "query" in params) {
      const answer = lookupKnowledge(params.query)
      const result: Tool.HandlerResult<typeof KnowledgeBase> = {
        isFailure: false,
        result: answer,
        encodedResult: answer
      }
      return Effect.succeed(result)
    }

    const computed = "expression" in params
      ? evaluateExpression(params.expression)
      : "0"
    const result: Tool.HandlerResult<typeof Calculator> = {
      isFailure: false,
      result: computed,
      encodedResult: computed
    }
    return Effect.succeed(result)
  }
}

// Dataset

const evalset = Arr.make(
  new Example.Example({
    input: { question: "What is the capital of Japan?" },
    output: { answer: "Tokyo" }
  }),
  new Example.Example({
    input: { question: "What is the combined population of France and Germany in millions?" },
    output: { answer: "152" }
  }),
  new Example.Example({
    input: { question: "What is the boiling point of water in Celsius?" },
    output: { answer: "100" }
  })
)

// Program

const program = Effect.gen(function*() {
  const qaSignature = yield* Signature.make(
    "Answer factual questions. Use the KnowledgeBase tool to look up facts and the Calculator tool for any arithmetic. Return only the final answer.",
    {
      question: Signature.describe(Schema.String, "A factual question to answer")
    },
    {
      answer: Signature.describe(Schema.String, "The concise answer")
    }
  )

  const agent = yield* Module.react({
    name: "research-agent",
    signature: qaSignature,
    toolkit,
    maxIterations: 5
  })

  // Run and inspect one multi-tool trace.
  yield* Effect.log("Single traced inference")

  const [result, traces] = yield* Trace.withTracing(
    agent.forward({
      question: "What is the combined population of France and Germany in millions?"
    })
  )

  yield* Effect.log("Answer", { answer: result.answer, reactSteps: traces.length })

  yield* Effect.forEach(traces, (entry, index) =>
    Effect.log("Trace step", {
      step: index + 1,
      module: entry.moduleName,
      responsePreview: entry.rawResponse.slice(0, 100),
      durationMs: entry.durationMs
    }), { discard: true })

  // 2. Simple factual lookup
  yield* Effect.log("Simple factual lookup")

  const [factResult, factTraces] = yield* Trace.withTracing(
    agent.forward({ question: "What is the capital of Japan?" })
  )

  yield* Effect.log("Answer", { answer: factResult.answer, reactSteps: factTraces.length })

  // 3. Evaluate over the dataset
  yield* Effect.log("Evaluation")

  const report = yield* Evaluate.run({
    module: agent,
    examples: evalset,
    metrics: { exactMatch: Metric.exactMatch("answer") },
    concurrency: 1
  })

  yield* Effect.log("Evaluation report", {
    exactMatch: report.overallScores.exactMatch,
    totalExamples: report.totalExamples,
    successCount: report.successCount,
    failureCount: report.failureCount
  })

  yield* Effect.forEach(report.results, (r) =>
    Effect.log("  Example", {
      index: r.index,
      scores: r.scores,
      durationMs: r.durationMs
    }), { discard: true })
})

BunRuntime.runMain(
  withLiveLanguageModel(program)
)
