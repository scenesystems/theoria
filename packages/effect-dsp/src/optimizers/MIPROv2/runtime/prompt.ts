/**
 * Phase 2 prompt rendering — assembles grounded instruction proposals from
 * dataset context.
 *
 * @since 0.1.0
 * @internal
 */
import { Array as Arr, Match, Option, Predicate, Record } from "effect"
import type { Example } from "../../../Example/index.js"

/**
 * Simplified input/output pair used inside rendered proposal prompts.
 * Strips away `Demo` class machinery, keeping only the raw field records
 * needed for text serialization.
 *
 * @since 0.1.0
 * @category models
 */
export type PromptDemo = Readonly<{
  readonly input: Readonly<Record<string, unknown>>
  readonly output: Readonly<Record<string, unknown>>
}>

const renderUnknown = (value: unknown): string =>
  Match.value(value).pipe(
    Match.when(Predicate.isString, (text) => text),
    Match.when(Predicate.isNumber, (numberValue) => String(numberValue)),
    Match.when(Predicate.isBoolean, (booleanValue) => String(booleanValue)),
    Match.orElse(() => "[non-scalar]")
  )

const renderRecord = (record: Readonly<Record<string, unknown>>): string =>
  Arr.join(
    Arr.map(Record.toEntries(record), ([key, value]) => `${key}: ${renderUnknown(value)}`),
    "\n"
  )

const renderDemoBlock = (input: Readonly<Record<string, unknown>>, output: Readonly<Record<string, unknown>>): string =>
  `Input:\n${renderRecord(input)}\nOutput:\n${renderRecord(output)}`

/**
 * Produces a one-line statistical summary of a training set
 * (total / labeled / unlabeled counts) suitable for embedding in a
 * proposal prompt.
 *
 * @since 0.1.0
 * @category formatters
 */
export const datasetSummary = (trainset: ReadonlyArray<Example>): string => {
  const labeled = Arr.filter(trainset, (example) => Option.isSome(Option.fromNullable(example.output))).length
  const unlabeled = trainset.length - labeled

  return `examples=${trainset.length}; labeled=${labeled}; unlabeled=${unlabeled}`
}

/**
 * Projects a candidate's demo array into the lightweight {@link PromptDemo}
 * shape for prompt rendering.
 *
 * @since 0.1.0
 * @category constructors
 */
export const promptDemosFromCandidate = (
  demos: ReadonlyArray<
    Readonly<{ readonly input: Readonly<Record<string, unknown>>; readonly output: Readonly<Record<string, unknown>> }>
  >
): ReadonlyArray<PromptDemo> => Arr.map(demos, (demo) => ({ input: demo.input, output: demo.output }))

/**
 * Assembles the full text prompt sent to the meta-LLM for Phase 2
 * instruction proposal generation.
 *
 * The prompt includes the cache-bust marker, module description, dataset
 * summary, diversity tip, bootstrapped demo blocks, the baseline
 * instruction, and a closing directive to return one improved instruction.
 *
 * @since 0.1.0
 * @category constructors
 */
export const buildProposalPrompt = (options: {
  readonly marker: string
  readonly predictorName: string
  readonly moduleDescription: string
  readonly summary: string
  readonly tip: string
  readonly demos: ReadonlyArray<PromptDemo>
  readonly baselineInstruction: string
  readonly diversityTemperature: number
}): string =>
  [
    options.marker,
    `Program Description: ${options.moduleDescription}`,
    `Predictor: ${options.predictorName}`,
    `Dataset Summary: ${options.summary}`,
    `Tip: ${options.tip}`,
    `Diversity Temperature: ${options.diversityTemperature}`,
    `Baseline Instruction: ${options.baselineInstruction}`,
    "Bootstrapped Demos:",
    Arr.join(
      Arr.map(options.demos, (demo) => renderDemoBlock(demo.input, demo.output)),
      "\n---\n"
    ),
    "Return one improved instruction as plain text."
  ].join("\n\n")
