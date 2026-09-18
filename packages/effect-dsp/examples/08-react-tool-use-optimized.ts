/**
 * Evaluates a live ReAct word-problem solver, bootstraps demonstrations from
 * teacher traces, and compares exact-match scores before and after optimization.
 * The calculator and unit-conversion tools can be called across multiple ReAct
 * iterations.
 *
 * Required env:
 *   OPENAI_API_KEY=... (or ANTHROPIC_API_KEY, OPENROUTER_API_KEY)
 *
 * Optional env:
 *   DSP_PROVIDER=openai|anthropic|openrouter
 *   DSP_PROVIDER_MODEL=gpt-4o-mini
 *
 * Run: bun run examples/08-react-tool-use-optimized.ts
 */
import * as Tool from "@effect/ai/Tool"
import * as Toolkit from "@effect/ai/Toolkit"
import { BunRuntime } from "@effect/platform-bun"
import { BootstrapFewShot, Evaluate, Example, Metric, Module, Signature, Trace } from "@scenesystems/effect-dsp"
import * as Numeric from "@scenesystems/effect-math/Numeric"
import { Array as Arr, Effect, Match, Number as Num, Option, Ref, Schema, String as Str } from "effect"
import { withLiveLanguageModel } from "./shared/live-provider-runtime.js"

// Tools

const Calculator = Tool.make("Calculator", {
  description:
    "Evaluate a simple arithmetic expression (e.g. '15 + 27', '120 * 8') and return the numeric result as a string",
  parameters: {
    expression: Schema.String
  },
  success: Schema.String
})

const UnitConverter = Tool.make("UnitConverter", {
  description: "Convert miles and kilometers, pounds and kilograms, or Fahrenheit and Celsius",
  parameters: {
    value: Schema.Number,
    from: Schema.String,
    to: Schema.String
  },
  success: Schema.String
})

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

const convertUnit = (value: number, from: string, to: string): string => {
  const units = { from: Str.toLowerCase(from), to: Str.toLowerCase(to) }

  return Match.value(units).pipe(
    Match.when({ from: "miles", to: "km" }, () => String(Numeric.round(Num.multiply(value, 1.60934), 2))),
    Match.when({ from: "km", to: "miles" }, () => String(Numeric.round(Num.unsafeDivide(value, 1.60934), 2))),
    Match.when({ from: "lbs", to: "kg" }, () => String(Numeric.round(Num.multiply(value, 0.453592), 2))),
    Match.when({ from: "kg", to: "lbs" }, () => String(Numeric.round(Num.unsafeDivide(value, 0.453592), 2))),
    Match.when(
      { from: "f", to: "c" },
      () => String(Numeric.round(Num.unsafeDivide(Num.multiply(Num.subtract(value, 32), 5), 9), 2))
    ),
    Match.when(
      { from: "c", to: "f" },
      () => String(Numeric.round(Num.sum(Num.unsafeDivide(Num.multiply(value, 9), 5), 32), 2))
    ),
    Match.orElse(() => String(value))
  )
}

const MathTools = Toolkit.make(Calculator, UnitConverter)
const MathToolsLive = MathTools.toLayer(MathTools.of({
  Calculator: ({ expression }) => Effect.succeed(evaluateExpression(expression)),
  UnitConverter: ({ from, to, value }) => Effect.succeed(convertUnit(value, from, to))
}))

// Datasets

const trainset = Arr.make(
  new Example.Example({
    input: { problem: "A store has 15 apples and receives 27 more. How many apples total?" },
    output: { answer: "42" }
  }),
  new Example.Example({
    input: { problem: "A factory produces 120 widgets per hour for 8 hours. How many widgets?" },
    output: { answer: "960" }
  }),
  new Example.Example({
    input: { problem: "A runner covers 26 miles. How many kilometers is that? Round to 2 decimal places." },
    output: { answer: "41.84" }
  }),
  new Example.Example({
    input: { problem: "A baker has 84 cookies and gives away 39. How many remain?" },
    output: { answer: "45" }
  })
)

const evalset = Arr.make(
  new Example.Example({
    input: { problem: "A garden has 48 flowers and 23 more are planted. How many flowers total?" },
    output: { answer: "71" }
  }),
  new Example.Example({
    input: { problem: "A warehouse ships 250 boxes but 78 are returned. How many net shipped?" },
    output: { answer: "172" }
  }),
  new Example.Example({
    input: { problem: "A cyclist rides 100 km. How many miles is that? Round to 2 decimal places." },
    output: { answer: "62.14" }
  })
)

// Program

const program = Effect.gen(function*() {
  const toolkit = yield* MathTools.pipe(Effect.provide(MathToolsLive))
  // 1. Define signature
  const mathSignature = yield* Signature.make(
    "Solve math and unit-conversion word problems step-by-step. Use the Calculator tool for arithmetic and the UnitConverter tool for unit conversions. Return only the final number.",
    {
      problem: Signature.describe(Schema.String, "A math or conversion word problem to solve")
    },
    {
      answer: Signature.describe(Schema.String, "The numerical answer as a string")
    }
  )

  // 2. Create ReAct module with both tools
  const solver = yield* Module.react({
    name: "math-solver",
    signature: mathSignature,
    toolkit,
    maxIterations: 5
  })

  // Inspect one traced ReAct run.
  const [singleResult, singleTraces] = yield* Trace.withTracing(
    solver.forward({
      problem: "A car travels 65 miles per hour for 4 hours. How many kilometers is that? Round to 2 decimal places."
    })
  )

  yield* Effect.log("Single inference (multi-step)", {
    answer: singleResult.answer,
    reactIterations: singleTraces.length
  })

  yield* Effect.forEach(singleTraces, (entry, index) =>
    Effect.log("Trace step", {
      step: Num.increment(index),
      rawResponsePreview: entry.rawResponse.slice(0, 120),
      durationMs: entry.durationMs
    }), { discard: true })

  // 4. Baseline evaluation
  const metrics = { exactMatch: Metric.exactMatch("answer") }
  const baseline = yield* Evaluate.run({
    module: solver,
    examples: evalset,
    metrics,
    concurrency: 1
  })

  yield* Effect.log("Baseline evaluation", {
    exactMatch: baseline.overallScores.exactMatch,
    totalExamples: baseline.totalExamples,
    successCount: baseline.successCount,
    failureCount: baseline.failureCount
  })

  // 5. Optimize with BootstrapFewShot
  yield* BootstrapFewShot.run({
    module: solver,
    trainset,
    metric: Metric.exactMatch("answer"),
    maxRounds: 2,
    maxBootstrappedDemos: 3,
    threshold: 1,
    fallbackToLabeledFewShot: false
  })

  const optimizedParams = yield* Ref.get(solver.params)

  // 6. Post-optimization evaluation
  const optimized = yield* Evaluate.run({
    module: solver,
    examples: evalset,
    metrics,
    concurrency: 1
  })

  const optimizedScore = Option.getOrElse(Option.fromNullable(optimized.overallScores.exactMatch), () => 0)
  const baselineScore = Option.getOrElse(Option.fromNullable(baseline.overallScores.exactMatch), () => 0)

  yield* Effect.log("Optimized evaluation", {
    exactMatch: optimizedScore,
    learnedDemoCount: optimizedParams.demos.length,
    improvement: Num.subtract(optimizedScore, baselineScore)
  })

  yield* Effect.log("react-tool-use-optimized summary", {
    baselineExactMatch: baseline.overallScores.exactMatch,
    optimizedExactMatch: optimized.overallScores.exactMatch,
    demoCount: optimizedParams.demos.length,
    tools: ["Calculator", "UnitConverter"],
    moduleType: "react",
    maxIterations: 5
  })
})

BunRuntime.runMain(
  withLiveLanguageModel(program)
)
