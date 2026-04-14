import * as LanguageModel from "@effect/ai/LanguageModel"
import { Array as Arr, Effect, Option, Predicate, Ref, Stream } from "effect"
import * as Evaluate from "effect-dsp/Evaluate"
import { Example as DspExample } from "effect-dsp/Example"
import * as Experimental from "effect-dsp/experimental"
import * as Module from "effect-dsp/Module"
import * as Optimizer from "effect-dsp/Optimizer"
import * as Signature from "effect-dsp/Signature"
import { MockLanguageModel } from "effect-dsp/test"
import { loadAmpThreadStrategyBenchmarkDataset } from "./amp-thread-strategy-benchmark.js"

type CodingPromptCase = Experimental.OpenAgentTrace.CodingPromptCase
type CodingPromptDatasetSplit = Experimental.OpenAgentTrace.CodingPromptDatasetSplit
const ImplementationStrategy = Experimental.OpenAgentTrace.ImplementationStrategy
const Execution = Experimental.OpenAgentTrace.Execution

const optimizerSplits: ReadonlyArray<CodingPromptDatasetSplit> = ["train"]
const validationSplits: ReadonlyArray<CodingPromptDatasetSplit> = ["validation"]
const evaluationSplits: ReadonlyArray<CodingPromptDatasetSplit> = ["holdout"]
export { evaluationSplits, optimizerSplits, validationSplits }

const IMPROVED_INSTRUCTION_MARKER = "derives exact products before runtime views"
export const STUDY_SEED = 19

export const BASELINE_INSTRUCTION =
  "Draft a concise implementation strategy that satisfies the compiler pragmatically, using helpers, aliases, or overloads when useful."

export const IMPROVED_INSTRUCTION =
  "Draft a concise implementation strategy that keeps the declared generic as source of truth, derives exact products before runtime views, splits authority at the real noun/mechanism seam, and avoids widening, helper indirection, sidecar witnesses, overload detours, or translation layers."

export const BAD_STRATEGY =
  "Introduce helper aliases and a witness type, broaden declarations into shared record families, add overload dispatch where narrowing gets hard, and use an intermediate runtime product before restoring the public surface."

export const GOOD_STRATEGY =
  "Keep the declared generic as the source of truth, derive exact products before runtime views, split noun and mechanism authority at the real seam, and avoid widening, helper indirection, sidecar witnesses, overload detours, or translation layers."

const strategyResponseForPrompt = (prompt: string): unknown =>
  prompt.includes("I provided an assistant with the following instructions to perform a task for me:")
    ? `\`\`\`\n${IMPROVED_INSTRUCTION}\n\`\`\``
    : prompt.toLowerCase().includes(IMPROVED_INSTRUCTION_MARKER)
    ? { strategy: GOOD_STRATEGY }
    : { strategy: BAD_STRATEGY }

type StrategyProjection = Readonly<{
  readonly caseId: string
  readonly threadId: string
  readonly split: CodingPromptDatasetSplit
  readonly task: string
  readonly canonicalStrategy: string
  readonly generatedStrategy: string
  readonly rubricScore: number
  readonly rubricFeedback: string
}>
type StrategyComparison = Readonly<{
  readonly caseId: string
  readonly threadId: string
  readonly split: CodingPromptDatasetSplit
  readonly task: string
  readonly canonicalStrategy: string
  readonly baselineStrategy: string
  readonly baselineScore: number
  readonly baselineFeedback: string
  readonly optimizedStrategy: string
  readonly optimizedScore: number
  readonly optimizedFeedback: string
}>

const executionMetadata = Execution.CodingExecutionMetricMetadata.of(
  Execution.COUNTER_ITEMS_EXECUTION_FIXTURE_ID
)

const promptCaseTask = (promptCase: CodingPromptCase): string =>
  Option.fromNullable(promptCase.input.task).pipe(
    Option.filter(Predicate.isString),
    Option.getOrElse(() => promptCase.task.summary)
  )

const withExecutionMetadata = (examples: ReadonlyArray<DspExample>): ReadonlyArray<DspExample> =>
  Arr.map(
    examples,
    (example) => new DspExample({ input: example.input, output: example.output, metadata: executionMetadata })
  )

export const runAmpThreadStrategyStudy = Effect.gen(function*() {
  const benchmarkDataset = yield* loadAmpThreadStrategyBenchmarkDataset()
  const optimizerExamplesBase = yield* Experimental.OpenAgentTrace.codingPromptDatasetToExamples(
    benchmarkDataset,
    optimizerSplits
  )
  const validationExamplesBase = yield* Experimental.OpenAgentTrace.codingPromptDatasetToExamples(
    benchmarkDataset,
    validationSplits
  )
  const evaluationCases = yield* Experimental.OpenAgentTrace.selectCodingPromptDatasetCases(
    benchmarkDataset,
    evaluationSplits
  )
  const evaluationExamplesBase = yield* Experimental.OpenAgentTrace.codingPromptCasesToExamples(evaluationCases)
  const optimizerExamples = withExecutionMetadata(optimizerExamplesBase)
  const validationExamples = withExecutionMetadata(validationExamplesBase)
  const evaluationExamples = withExecutionMetadata(evaluationExamplesBase)
  const signature = yield* Signature.make(
    ImplementationStrategy.signatureDescription,
    ImplementationStrategy.inputFields,
    ImplementationStrategy.outputFields
  )
  const module = yield* Module.predict("amp-thread-strategy", signature)
  const layer = MockLanguageModel.layer(
    LanguageModel.LanguageModel,
    MockLanguageModel.map(strategyResponseForPrompt)
  )
  const projectStrategyProjections = (promptCases: ReadonlyArray<CodingPromptCase>) =>
    Effect.forEach(
      promptCases,
      (promptCase) =>
        Effect.gen(function*() {
          const prediction = yield* module.forward(
            ImplementationStrategy.inputFromPromptCase(promptCase)
          ).pipe(Effect.provide(layer))
          const generatedStrategy = ImplementationStrategy.strategyText(prediction)
          const canonicalStrategy = ImplementationStrategy.strategyText(promptCase.expectedOutput ?? {})
          const metricResult = yield* ImplementationStrategy.rubricMetric.score(
            { strategy: generatedStrategy },
            { strategy: canonicalStrategy }
          )
          return {
            caseId: promptCase.caseId,
            threadId: promptCase.task.sessionId,
            split: promptCase.split,
            task: promptCaseTask(promptCase),
            canonicalStrategy,
            generatedStrategy,
            rubricScore: metricResult.score,
            rubricFeedback: metricResult.feedback ?? ""
          }
        }),
      { concurrency: 1 }
    )
  const compareStrategyProjections = (
    baseline: ReadonlyArray<StrategyProjection>,
    optimized: ReadonlyArray<StrategyProjection>
  ): ReadonlyArray<StrategyComparison> =>
    Arr.map(
      baseline,
      (baselineProjection, index) => ({
        caseId: baselineProjection.caseId,
        threadId: baselineProjection.threadId,
        split: baselineProjection.split,
        task: baselineProjection.task,
        canonicalStrategy: baselineProjection.canonicalStrategy,
        baselineStrategy: baselineProjection.generatedStrategy,
        baselineScore: baselineProjection.rubricScore,
        baselineFeedback: baselineProjection.rubricFeedback,
        optimizedStrategy: optimized[index]?.generatedStrategy ?? "",
        optimizedScore: optimized[index]?.rubricScore ?? 0,
        optimizedFeedback: optimized[index]?.rubricFeedback ?? ""
      })
    )

  const baselineReport = yield* Evaluate.run({
    module,
    examples: evaluationExamples,
    metrics: {
      strategyExecution: ImplementationStrategy.executionBackedMetric,
      strategyRubric: ImplementationStrategy.rubricMetric
    },
    concurrency: 1
  }).pipe(Effect.provide(layer))
  const baselineStrategyProjections = yield* projectStrategyProjections(evaluationCases)

  const events = yield* Stream.runCollect(
    Optimizer.gepaStream({
      module,
      trainset: optimizerExamples,
      valset: validationExamples,
      metric: ImplementationStrategy.executionBackedMetric,
      maxIterations: 3,
      seed: STUDY_SEED
    })
  ).pipe(Effect.provide(layer))

  const optimizedReport = yield* Evaluate.run({
    module,
    examples: evaluationExamples,
    metrics: {
      strategyExecution: ImplementationStrategy.executionBackedMetric,
      strategyRubric: ImplementationStrategy.rubricMetric
    },
    concurrency: 1
  }).pipe(Effect.provide(layer))
  const optimizedStrategyProjections = yield* projectStrategyProjections(evaluationCases)

  const finalParams = yield* Ref.get(module.params)

  return {
    baselineReport,
    baselineStrategyProjections,
    optimizedReport,
    optimizedStrategyProjections,
    strategyComparisons: compareStrategyProjections(
      baselineStrategyProjections,
      optimizedStrategyProjections
    ),
    benchmarkCaseIds: Arr.map(benchmarkDataset.cases, (promptCase) => promptCase.caseId),
    benchmarkThreadIds: Arr.map(benchmarkDataset.cases, (promptCase) => promptCase.task.sessionId),
    splitSummary: benchmarkDataset.splitSummary,
    gepaEvents: Arr.fromIterable(events),
    eventTags: Arr.map(Arr.fromIterable(events), (event) => event._tag),
    finalInstructions: finalParams.instructions,
    optimizerExampleCount: optimizerExamples.length,
    validationExampleCount: validationExamples.length,
    evaluationExampleCount: evaluationExamples.length
  }
})
