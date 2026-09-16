/**
 * GEPA reflective mutation — assembles few-shot failure examples and mutation
 * prompts that teach the model to improve its own instructions.
 *
 * @see {@link https://arxiv.org/abs/2507.19457 | Agrawal et al., "GEPA: Reflective Prompt Evolution Can Outperform Reinforcement Learning", 2025}
 * @since 0.1.0
 */
import * as Numeric from "@scenesystems/effect-math/Numeric"
import { Array as Arr, Match, Number, Option, Schema, String } from "effect"
import type { MetricResult } from "../../contracts/MetricResult.js"
import { ReflectiveExample } from "./model.js"
import type { ReflectiveDatasetSample } from "./model.js"

const EMPTY_FEEDBACK = ""

const normalizeIteration = (iteration: number): number => {
  const finiteIteration = Match.value(iteration).pipe(
    Match.when(Numeric.isFinite, Numeric.truncate),
    Match.orElse(() => 0)
  )

  return Number.max(0, finiteIteration)
}

const renderReflectiveExampleSection = (example: ReflectiveExample, index: number): string =>
  Arr.join(
    Arr.make(
      String.concat("# Example ", Schema.encodeSync(Schema.NumberFromString)(Number.increment(index))),
      "## Inputs",
      example.inputs,
      "## Generated Outputs",
      example.generatedOutputs,
      "## Expected Output",
      example.expectedOutput,
      "## Feedback",
      example.feedback
    ),
    "\n\n"
  )

/**
 * Prefix for explicit parse-failure feedback injected when an LLM response
 * failed to decode.
 *
 * @since 0.1.0
 * @category constants
 */
export const PARSE_FAILURE_FEEDBACK_PREFIX = "Your output failed to parse. Follow this structure:\n"

/**
 * Build parse-failure feedback with explicit structure guidance appended
 * after the prefix.
 *
 * @since 0.1.0
 * @category constructors
 */
export const formatParseFailureFeedback = (structureInstruction: string): string =>
  String.concat(PARSE_FAILURE_FEEDBACK_PREFIX, structureInstruction)

/**
 * Normalize `MetricResult.feedback` into a required string — empty feedback
 * stays empty, never `undefined`.
 *
 * @since 0.1.0
 * @category combinators
 */
export const normalizeMetricFeedback = (metricResult: MetricResult): string =>
  Option.match(Option.fromNullable(metricResult.feedback), {
    onNone: () => EMPTY_FEEDBACK,
    onSome: String.trim
  })

const reflectiveFeedback = (sample: ReflectiveDatasetSample): string =>
  Option.match(Option.fromNullable(sample.parseFailureStructure), {
    onNone: () => normalizeMetricFeedback(sample.metricResult),
    onSome: (structureInstruction) => formatParseFailureFeedback(structureInstruction)
  })

/**
 * Build one frozen reflective-example row from a runtime sample. Resolves
 * feedback from either metric results or parse-failure structure.
 *
 * @since 0.1.0
 * @category constructors
 */
export const buildReflectiveExample = (sample: ReflectiveDatasetSample): ReflectiveExample =>
  new ReflectiveExample({
    exampleId: sample.exampleId,
    predictorName: sample.predictorName,
    inputs: sample.inputs,
    generatedOutputs: sample.generatedOutputs,
    expectedOutput: sample.expectedOutput,
    feedback: reflectiveFeedback(sample),
    score: sample.metricResult.score
  })

/**
 * Build a reflective dataset from runtime samples for use in mutation prompts.
 *
 * @since 0.1.0
 * @category constructors
 */
export const buildReflectiveDataset = (
  samples: Iterable<ReflectiveDatasetSample>
) => Arr.map(Arr.fromIterable(samples), buildReflectiveExample)

/**
 * Select a predictor name using deterministic round-robin cycling across
 * iterations.
 *
 * @since 0.1.0
 * @category combinators
 */
export const selectPredictorRoundRobin = (
  predictorNames: Iterable<string>,
  iteration: number
): Option.Option<string> =>
  Arr.match(Arr.fromIterable(predictorNames), {
    onEmpty: () => Option.none<string>(),
    onNonEmpty: (names) => Arr.get(names, Number.remainder(normalizeIteration(iteration), Arr.length(names)))
  })

/**
 * Instructions and schema-encoded failure examples for reflective mutation.
 * @since 0.4.0
 * @category schemas
 */
export const ReflectivePromptOptions = Schema.Struct({
  predictorName: Schema.String,
  currentInstruction: Schema.String,
  examples: Schema.Array(ReflectiveExample)
})

/**
 * Assemble the reflective mutation prompt for one predictor — includes
 * current instruction, few-shot failure examples with feedback, and the task
 * description for the meta-LLM.
 *
 * @see {@link https://arxiv.org/abs/2507.19457 | Agrawal et al. (2025)}
 * @since 0.1.0
 * @category constructors
 */
export const buildReflectivePrompt = (options: typeof ReflectivePromptOptions.Type): string =>
  Arr.join(
    Arr.make(
      "I provided an assistant with the following instructions to perform a task for me:",
      "```",
      options.currentInstruction,
      "```",
      "The following are examples of different task inputs provided to the assistant",
      "along with the assistant's response for each of them, and some feedback on",
      "how the assistant's response could be better:",
      Arr.join(Arr.map(options.examples, renderReflectiveExampleSection), "\n\n"),
      "Your task is to write a new instruction for the assistant.",
      "Read the inputs carefully and identify the input format and infer detailed",
      "task description about the task I wish to solve with the assistant.",
      "Read all the assistant responses and the corresponding feedback. Identify",
      "all niche and domain specific factual information about the task and include",
      "it in the instruction. The assistant may have utilized a generalizable",
      "strategy to solve the task, if so, include that in the instruction as well.",
      String.concat("Target predictor: ", options.predictorName),
      "Provide the new instructions within ``` blocks."
    ),
    "\n\n"
  )
