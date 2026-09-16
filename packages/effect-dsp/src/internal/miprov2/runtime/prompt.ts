/**
 * Phase 2 prompt rendering — assembles grounded instruction proposals from
 * dataset context.
 *
 * @since 0.1.0
 * @internal
 */
import { Array as Arr, Inspectable, Number as Num, Option, Schema, String as Str, Tuple } from "effect"
import { Documents as DemoDocuments, type Documents as DemoDocumentsType } from "../../../Demonstration.js"
import type { Example } from "../../../Example.js"

/**
 * Schema-owned inputs for one rendered instruction-proposal prompt.
 *
 * @since 0.1.0
 * @category models
 */
export class ProposalPromptOptions extends Schema.Class<ProposalPromptOptions>("MIPROv2ProposalPromptOptions")({
  marker: Schema.String,
  predictorName: Schema.String,
  moduleDescription: Schema.String,
  summary: Schema.String,
  tip: Schema.String,
  demos: Schema.Array(DemoDocuments),
  baselineInstruction: Schema.String,
  diversityTemperature: Schema.Number
}) {}

const renderDemoBlock = (demo: DemoDocumentsType): string =>
  Arr.join(
    Arr.make("Input:\n", Tuple.getFirst(demo), "\nOutput:\n", Tuple.getSecond(demo)),
    ""
  )

/**
 * Produces a one-line statistical summary of a training set
 * (total / labeled / unlabeled counts) suitable for embedding in a
 * proposal prompt.
 *
 * @since 0.1.0
 * @category formatters
 */
export const datasetSummary = (trainset: Schema.Array$<typeof Example>["Type"]): string => {
  const total = Arr.length(trainset)
  const labeled = Arr.length(Arr.filter(trainset, (example) => Option.isSome(Option.fromNullable(example.output))))
  const unlabeled = Num.subtract(total, labeled)

  return Arr.join(
    Arr.make(
      "examples=",
      Inspectable.toStringUnknown(total),
      "; labeled=",
      Inspectable.toStringUnknown(labeled),
      "; unlabeled=",
      Inspectable.toStringUnknown(unlabeled)
    ),
    ""
  )
}

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
export const buildProposalPrompt = (options: ProposalPromptOptions): string =>
  Arr.join(
    Arr.make(
      options.marker,
      Str.concat("Program Description: ", options.moduleDescription),
      Str.concat("Predictor: ", options.predictorName),
      Str.concat("Dataset Summary: ", options.summary),
      Str.concat("Tip: ", options.tip),
      Str.concat("Diversity Temperature: ", Inspectable.toStringUnknown(options.diversityTemperature)),
      Str.concat("Baseline Instruction: ", options.baselineInstruction),
      "Bootstrapped Demos:",
      Arr.join(
        Arr.map(options.demos, renderDemoBlock),
        "\n---\n"
      ),
      "Return one improved instruction as plain text."
    ),
    "\n\n"
  )
