/**
 * Runs a live ReAct research assistant that can chain a knowledge lookup and a
 * calculation, records the resulting trace, and evaluates exact-match answers.
 *
 * Required env:
 *   OPENAI_API_KEY=... (or ANTHROPIC_API_KEY, OPENROUTER_API_KEY)
 *
 * Run: bun run examples/09-react-tool-use-live-openai.ts
 */
import { BunRuntime } from "@effect/platform-bun"
import { Evaluate, Example, Metric, Module, Signature, Trace } from "@scenesystems/effect-dsp"
import { Array as Arr, Effect, Match, Option, Schema } from "effect"
import * as Tool from "effect/ai/Tool"
import * as Toolkit from "effect/ai/Toolkit"
import { withLiveLanguageModel } from "./shared/live-provider-runtime.js"

// Tools

const KnowledgeBase = Tool.make("KnowledgeBase", {
  description: "Look up a factual data point. Returns a concise string with the requested information.",
  parameters: Schema.Struct({
    query: Schema.String
  }),
  success: Schema.String
})

const Calculator = Tool.make("Calculator", {
  description: "Evaluate an arithmetic expression (e.g. '42 * 3') and return the numeric result as a string",
  parameters: Schema.Struct({
    expression: Schema.String
  }),
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

const tools = Toolkit.make(KnowledgeBase, Calculator)

// Dataset

const evalset = Arr.make(
  new Example.Example({
    input: { question: "What is the capital of Japan?" },
    labels: Option.some({ answer: "Tokyo" })
  }),
  new Example.Example({
    input: { question: "What is the combined population of France and Germany in millions?" },
    labels: Option.some({ answer: "152" })
  }),
  new Example.Example({
    input: { question: "What is the boiling point of water in Celsius?" },
    labels: Option.some({ answer: "100" })
  })
)

// Program

const program = Effect.gen(function*() {
  const toolkit = yield* tools.pipe(Effect.provide(tools.toLayer({
    KnowledgeBase: ({ query }) => Effect.succeed(lookupKnowledge(query)),
    Calculator: ({ expression }) => Effect.succeed(evaluateExpression(expression))
  })))
  const qaSignature = yield* Signature.make(
    "Answer factual questions. Use the KnowledgeBase tool to look up facts and the Calculator tool for any arithmetic. Return only the final answer.",
    {
      question: Signature.describe(Schema.String, "A factual question to answer")
    },
    {
      answer: Signature.describe(Schema.String, "The concise answer")
    }
  )

  const agent = yield* Module.react(
    new Module.ReactOptions({
      name: "research-agent",
      signature: qaSignature,
      toolkit,
      maxIterations: 5
    })
  )

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

  const report = yield* Evaluate.run(
    new Evaluate.Options({
      module: agent,
      examples: evalset,
      metrics: { exactMatch: Metric.exactMatch("answer") },
      concurrency: 1
    })
  )

  yield* Effect.log("Evaluation report", {
    exactMatch: report.overallScores.exactMatch,
    totalExamples: report.totalExamples,
    successCount: report.successCount,
    failureCount: report.failureCount
  })

  yield* Effect.forEach(report.outcomes, (r) =>
    Effect.log("  Example", {
      index: r.index,
      ...Match.valueTags(r, {
        Scored: (row) => ({ scores: row.scores }),
        Failed: (row) => ({ failure: row.failure })
      }),
      durationMs: r.durationMs
    }), { discard: true })
})

BunRuntime.runMain(
  withLiveLanguageModel(program)
)
