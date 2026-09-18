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
import * as Toolkit from "@effect/ai/Toolkit"
import { BunRuntime } from "@effect/platform-bun"
import { Evaluate, Example, Metric, Module, Signature, Trace } from "@scenesystems/effect-dsp"
import { Array as Arr, Effect, Number as Num, Option, Schema, String as Str } from "effect"
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
  const lowerQuery = Str.toLowerCase(query)
  const entry = Arr.findFirst(KNOWLEDGE, (entry) => Str.includes(entry.match)(lowerQuery))

  return Option.match(entry, {
    onSome: (found) => found.answer,
    onNone: () => `No data found for: ${query}`
  })
}

const evaluateExpression = (expr: string): string => {
  const cleaned = Str.trim(Str.replaceAll(",", "")(expr))
  const calculate = (pattern: RegExp, operation: (left: number, right: number) => number): Option.Option<string> =>
    Str.match(pattern)(cleaned).pipe(
      Option.flatMap((matched) => Option.all({ left: Arr.get(matched, 1), right: Arr.get(matched, 2) })),
      Option.map(({ left, right }) => String(operation(Number(left), Number(right))))
    )

  return calculate(/^(\d+(?:\.\d+)?)\s*\+\s*(\d+(?:\.\d+)?)$/u, Num.sum).pipe(
    Option.orElse(() => calculate(/^(\d+(?:\.\d+)?)\s*-\s*(\d+(?:\.\d+)?)$/u, Num.subtract)),
    Option.orElse(() => calculate(/^(\d+(?:\.\d+)?)\s*\*\s*(\d+(?:\.\d+)?)$/u, Num.multiply)),
    Option.orElse(() => calculate(/^(\d+(?:\.\d+)?)\s*\/\s*(\d+(?:\.\d+)?)$/u, Num.unsafeDivide)),
    Option.getOrElse(() => "0")
  )
}

const ResearchTools = Toolkit.make(KnowledgeBase, Calculator)
const ResearchToolsLive = ResearchTools.toLayer(ResearchTools.of({
  KnowledgeBase: ({ query }) => Effect.succeed(lookupKnowledge(query)),
  Calculator: ({ expression }) => Effect.succeed(evaluateExpression(expression))
}))

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
  const toolkit = yield* ResearchTools.pipe(Effect.provide(ResearchToolsLive))
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
      step: Num.increment(index),
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
